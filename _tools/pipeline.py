"""Steps 1-3 of the anthinh semi-automatic video pipeline:
1. Ingest & faster-whisper Vietnamese transcription (.sentences.json, .words.json)
2. Code-only silence/filler/stumble cutting aligned to word boundaries (+0.05s padding)
3. AI Gate evaluation -> skip (0 tokens) or run cached compressed retake/hook/claims check -> EDL TSV
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
from pathlib import Path
from typing import Any

from ai_client import (
    analyze_content_and_source_gaps,
    call_ai_cached,
    is_hard_traffic_or_policy_violation,
    load_project_brief,
    load_prompt_preset,
    sanitize_traffic_and_policy_text,
    scan_watchlist,
    smart_local_retake_pairs,
    smart_local_structure,
)
from common import (
    append_log,
    ensure_project,
    ffprobe_json,
    find_raw_videos,
    load_state,
    load_wav_16k_float32,
    parse_ratio,
    refresh_windows_path,
    resolve_portable_path,
    save_state,
    sha256_file,
    sha256_text,
)
from edl_utils import EdlRow, edl_summary, write_edl
from hardware import get_video_encode_args

FILLER_WORDS = {
    "ờ", "ừm", "à", "ừ", "ơ", "ờm", "hả", "á", "ấy", "thì", "là", "mà",
}
PURE_FILLERS = {"ờ", "ừm", "à", "ừ", "ơ", "ờm", "uh", "um", "ah"}
DEFAULT_INITIAL_PROMPT = (
    "Chia sẻ trải nghiệm thực tế, review sản phẩm, máy đọc sách, màn hình E-Ink, Kindle, XTEINK, "
    "iPhone, MagSafe, Type-C, thương mại điện tử, công nghệ, cuốn sách, sạc pin, phím cứng, gọn nhẹ."
)


def _strip_punct(word: str) -> str:
    return re.sub(r"[^\wÀ-ỹ]", "", word.lower())


def step1_ingest(project_dir: Path, project_name: str, state: dict[str, Any]) -> dict[str, Any]:
    """Probe raw videos in 01_raw/, normalize if VFR/multi-clip, and extract 16kHz mono WAV."""
    raw_videos = find_raw_videos(project_dir)
    if not raw_videos:
        raise FileNotFoundError(f"Không tìm thấy video nào trong {project_dir / '01_raw'}")

    raw_hashes = [{"file": p.name, "sha256": sha256_file(p), "size": p.stat().st_size} for p in raw_videos]
    input_sig = sha256_text(json.dumps(raw_hashes, sort_keys=True))

    ingest_json_path = project_dir / "03_working" / f"{project_name}.ingest.json"
    wav_path = project_dir / "03_working" / f"{project_name}.audio.wav"
    prev = state.get("steps", {}).get("ingest", {})
    if (
        prev.get("signature") == input_sig
        and ingest_json_path.exists()
        and wav_path.exists()
        and Path(prev.get("work_video", "")).exists()
    ):
        print(f"[Bước 1a/Ingest] Bỏ qua (state khớp hash {input_sig[:10]}).")
        return json.loads(ingest_json_path.read_text(encoding="utf-8"))

    clips_meta = []
    needs_normalize = len(raw_videos) > 1
    for p in raw_videos:
        info = ffprobe_json(p)
        v_stream = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
        a_stream = next((s for s in info.get("streams", []) if s.get("codec_type") == "audio"), {})
        r_fps = parse_ratio(v_stream.get("r_frame_rate"))
        avg_fps = parse_ratio(v_stream.get("avg_frame_rate"))
        duration = float(info.get("format", {}).get("duration", 0.0) or 0.0)
        is_vfr = abs(r_fps - avg_fps) > 0.5
        if is_vfr or abs(r_fps - 30.0) > 0.5:
            needs_normalize = True
        clips_meta.append({
            "filename": p.name,
            "path": str(p),
            "width": int(v_stream.get("width", 0) or 0),
            "height": int(v_stream.get("height", 0) or 0),
            "r_fps": round(r_fps, 3),
            "avg_fps": round(avg_fps, 3),
            "is_vfr": is_vfr,
            "duration": round(duration, 3),
            "audio_sample_rate": int(a_stream.get("sample_rate", 0) or 0),
        })

    work_video = raw_videos[0]
    if needs_normalize:
        norm_path = project_dir / "03_working" / f"{project_name}.work_source.mp4"
        v_enc = get_video_encode_args("work_source")
        if len(raw_videos) == 1:
            # Giữ nguyên độ phân giải gốc trong ingest (chỉ chuẩn hóa fps=30 CFR chất lượng cao)
            cmd = [
                "ffmpeg", "-y", "-i", str(raw_videos[0]),
                "-vf", "fps=30",
                *v_enc,
                "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "256k",
                str(norm_path),
            ]
            subprocess.run(cmd, check=True, capture_output=True)
        else:
            inputs: list[str] = []
            filters: list[str] = []
            target_w = max((c["width"] for c in clips_meta), default=1080)
            target_h = max((c["height"] for c in clips_meta), default=1920)
            for idx, vp in enumerate(raw_videos):
                inputs.extend(["-i", str(vp)])
                filters.append(
                    f"[{idx}:v]fps=30,scale={target_w}:{target_h}:flags=lanczos:force_original_aspect_ratio=increase,"
                    f"crop={target_w}:{target_h},setsar=1[v{idx}];"
                    f"[{idx}:a]aresample=48000,aformat=channel_layouts=stereo[a{idx}];"
                )
            concat_inputs = "".join(f"[v{i}][a{i}]" for i in range(len(raw_videos)))
            filter_complex = "".join(filters) + f"{concat_inputs}concat=n={len(raw_videos)}:v=1:a=1[vout][aout]"
            cmd = [
                "ffmpeg", "-y", *inputs,
                "-filter_complex", filter_complex,
                "-map", "[vout]", "-map", "[aout]",
                *v_enc,
                "-c:a", "aac", "-b:a", "256k",
                str(norm_path),
            ]
            subprocess.run(cmd, check=True, capture_output=True)
        work_video = norm_path

    # Tách audio mono 16kHz cho faster-whisper
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(work_video), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav_path)],
        check=True,
        capture_output=True,
    )
    work_info = ffprobe_json(work_video)
    work_duration = float(work_info.get("format", {}).get("duration", 0.0) or 0.0)

    ingest_data = {
        "project": project_name,
        "signature": input_sig,
        "raw_clips": clips_meta,
        "normalized": needs_normalize,
        "work_video": str(work_video),
        "work_duration": round(work_duration, 3),
        "audio_wav": str(wav_path),
    }
    ingest_json_path.write_text(json.dumps(ingest_data, ensure_ascii=False, indent=2), encoding="utf-8")
    state.setdefault("steps", {})["ingest"] = {
        "signature": input_sig,
        "work_video": str(work_video),
        "completed": True,
    }
    save_state(project_dir, project_name, state)
    print(f"[Bước 1a/Ingest] Xong {len(raw_videos)} clip -> thời lượng {work_duration:.2f}s (normalized={needs_normalize}).")
    return ingest_data


def _split_words_into_sentences(all_words: list[dict[str, Any]], max_words: int = 13) -> list[dict[str, Any]]:
    """Split word stream into natural short Vietnamese sentences for EDL and captions."""
    sentences: list[dict[str, Any]] = []
    buf: list[dict[str, Any]] = []

    def flush() -> None:
        if not buf:
            return
        idx = len(sentences) + 1
        text = " ".join(w["word"].strip() for w in buf).strip()
        text = re.sub(r"\s+([,.!?;:])", r"\1", text)
        sentences.append({
            "id": f"S{idx:02d}",
            "start": round(buf[0]["start"], 3),
            "end": round(buf[-1]["end"], 3),
            "text": text,
            "words": buf.copy(),
        })
        buf.clear()

    for w in all_words:
        if buf:
            gap = w["start"] - buf[-1]["end"]
            prev_text = buf[-1]["word"].strip()
            if gap > 0.35 or prev_text.endswith((".", "!", "?", ";")) or len(buf) >= max_words:
                flush()
        buf.append(w)
    flush()
    return sentences


def step1_transcribe(
    project_dir: Path,
    project_name: str,
    ingest_data: dict[str, Any],
    state: dict[str, Any],
    whisper_model: str = "small",
) -> list[dict[str, Any]]:
    """Run local faster-whisper with Vietnamese word timestamps."""
    wav_path = resolve_portable_path(project_dir, ingest_data.get("audio_wav", ""), "03_working")
    wav_hash = sha256_file(wav_path)
    words_path = project_dir / "02_transcripts" / f"{project_name}.words.json"
    sentences_path = project_dir / "02_transcripts" / f"{project_name}.sentences.json"

    prev = state.get("steps", {}).get("transcribe", {})
    if (
        prev.get("wav_sha256") == wav_hash
        and prev.get("model") == whisper_model
        and sentences_path.exists()
        and words_path.exists()
    ):
        print(f"[Bước 1b/Transcribe] Bỏ qua (state khớp hash {wav_hash[:10]}, model={whisper_model}).")
        return json.loads(sentences_path.read_text(encoding="utf-8"))

    import ctranslate2
    from faster_whisper import WhisperModel

    device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    print(f"[Bước 1b/Transcribe] Đang nạp model faster-whisper={whisper_model} ({device}/{compute_type}) — lần đầu có thể mất 20–60s để tải model...")
    t0 = time.time()
    model = WhisperModel(whisper_model, device=device, compute_type=compute_type)
    print(f"[Bước 1b/Transcribe] Đã nạp xong model, đang tách lời từ {wav_path.name}...")
    audio_arr = load_wav_16k_float32(wav_path)
    segments, _ = model.transcribe(
        audio_arr,
        language="vi",
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 300},
        initial_prompt=DEFAULT_INITIAL_PROMPT,
    )

    all_words: list[dict[str, Any]] = []
    for seg in segments:
        if seg.words:
            for w in seg.words:
                token = w.word.strip()
                if not token:
                    continue
                all_words.append({
                    "word": token,
                    "start": round(float(w.start), 3),
                    "end": round(float(w.end), 3),
                    "probability": round(float(getattr(w, "probability", 1.0)), 3),
                })
        elif seg.text.strip():
            all_words.append({
                "word": seg.text.strip(),
                "start": round(float(seg.start), 3),
                "end": round(float(seg.end), 3),
                "probability": 1.0,
            })

    sentences = _split_words_into_sentences(all_words)
    words_path.write_text(json.dumps(all_words, ensure_ascii=False, indent=2), encoding="utf-8")
    sentences_path.write_text(json.dumps(sentences, ensure_ascii=False, indent=2), encoding="utf-8")

    state.setdefault("steps", {})["transcribe"] = {
        "wav_sha256": wav_hash,
        "model": whisper_model,
        "sentence_count": len(sentences),
        "elapsed_sec": round(time.time() - t0, 2),
        "completed": True,
    }
    save_state(project_dir, project_name, state)
    print(f"[Bước 1b/Transcribe] Tạo xong {len(sentences)} câu ({len(all_words)} từ) trong {time.time() - t0:.2f}s.")
    return sentences


_VI_ASR_FIXES: list[tuple[str, Any]] = [
    (r"\btế\s+(?:tóc|tốc)\b", "TikTok"),
    (r"\btíc\s+(?:tóc|tốc)\b", "TikTok"),
    (r"\bcho\s+(?:tế|đến)\s+(?:tốc|tóc)\b", "trên TikTok"),
    (r"\bxíu\s+xíu\s+hoát\b", "siêu hot"),
    (r"\b[eE]\s*-\s*[iI]n\b", "E-Ink"),
    (r"\bmàn\s+e\s+in\b", "màn E-Ink"),
    (r"\bE-Ink\s+chắn\b", "E-Ink trắng"),
    (r"\bít\s+tê\s+in\b", "XTEINK"),
    (r"\bsự\s+hủ\b", "sở hữu"),
    (r"\bthực\s+sở\s+hữu\b", "thực sự sở hữu"),
    (r"\bcảm\s+nhát\b", "cảm giác"),
    (r"\bmáy\s+đột\b", "máy đọc"),
    (r"\bmáy\s+đọc\s+sát\b", "máy đọc sách"),
    (r"\bcuốn\s+sát\b", "cuốn sách"),
    (r"\b(?:độc|đọc)\s+sát\b", "đọc sách"),
    (r"\bsát\s+điện\s+tử\b", "sách điện tử"),
    (r"\bsát\s+giấy\b", "sách giấy"),
    (r"\bcái\s+sát\s+này\b", "cuốn sách này"),
    (r"\bmàng\s+hình\s+của\s+đó\s+là\s+màng\s+hình\b", "màn hình của nó là màn hình"),
    (r"\bmàng\s+hình\b", "màn hình"),
    (r"\bmàng\s+nó\s+đẹp\b", "màn nó đẹp"),
    (r"\bmàng\s+E-Ink\b", "màn E-Ink"),
    (r"\bnhỏ\s+vàng\b", "ngả vàng"),
    (r"\bngã\s+vàng\b", "ngả vàng"),
    (r"\b(\d+)\s+in\b", r"\1 inch"),
    (r"\b(?:chôi|choi)\s+trang\b", "trôi trang"),
    (r"\bbực\s+bình\b", "bực mình"),
    (r"\bsiêu\s+châu\b", "siêu trâu"),
    (r"\b(hết|ít|tốn|có|bao)\s+(?:bin|biên|bên)\b", r"\1 pin"),
    (r"\bsản\s+bên\b", "sạc pin"),
    (r"\bbên\s+con\s+này\b", "pin con này"),
    (r"\bbên\s+bao\s+nhiêu\b", "pin bao nhiêu"),
    (r"\btôi\s+sản\b", "tôi sạc"),
    (r"\b(?:sản|sạch)\s+(?:pin|bin|bằng|được|có|rất)\b", lambda m: m.group(0).replace("sản", "sạc").replace("sạch", "sạc").replace("bin", "pin")),
    (r"\btay\s+xê\b", "Type-C"),
    (r"\bsạc\s+bằng\s+(?:1\s+cái\s+)?cháu\b", lambda m: m.group(0).replace("cháu", "chấu")),
    (r"\btôi\s+nhúng\b", "tôi dùng"),
    (r"\bcưng\s+nhát\s+mà\b", "cân nhắc mà"),
    (r"\bcưng\s+nhát\s+màn\b", "cân nhắc và anh"),
    (r"\bcưng\s+nhát\b", "cân nhắc"),
    (r"\bdạy\s+pháp\b", "giải pháp"),
    (r"\bcân\s+ngạng\b", "cân nặng"),
    (r"\bcải\s+nghiệm\b", "trải nghiệm"),
    (r"\banh\s+em\s+tác\b", "anh em tắt"),
    (r"\biPhone\s+12\s+chả\s+lời\s+là\s+được\b", "iPhone 12 trở lên là được"),
    (r"\bchỉ\s+cảm,\s*con\s+này\s+chỉ\s+có\s+thể\s+chuyển\s+cho\s+em\s+và\b", "chỉ chuyển trang bằng"),
    (r"\bchỉ\s+cảm,\s*con\s+này\s+chỉ\s+có\s+thể\s+chuyển\s+cho\s+em\b", "chỉ chuyển trang"),
    (r"\b10,\s*12\s+tí\b", "10, 12 tiếng"),
    (r"\bXíu\s+xíu\s+nhẹ\b", "Siêu siêu nhẹ"),
    (r"\bTIC\b", "Type-C"),
    (r"\bchóp\s+ha\b", "chốt ha"),
    (r"\bở\s+lúc\s+mà\s+nơi\b", "ở mọi lúc mọi nơi"),
    (r"\bcú\s+sách\b", "cuốn sách"),
    (r"\bhót\b", "hot"),
    (r"\bdám\s+và\s+nó\s+hít\b", "dán và nó hít"),
]


def _clean_vi_asr_text(text: str) -> str:
    """Normalize common Vietnamese faster-whisper homophones and soften traffic-throttling terms."""
    out = text
    for pat, repl in _VI_ASR_FIXES:
        out = re.sub(pat, repl, out, flags=re.IGNORECASE if not pat.startswith(r"\bTIC") else 0)
    out, _ = sanitize_traffic_and_policy_text(out)
    return out


def step2_silence_filler_cut(
    project_dir: Path,
    project_name: str,
    sentences: list[dict[str, Any]],
    ingest_data: dict[str, Any],
    state: dict[str, Any],
    pad_sec: float = 0.05,
) -> list[dict[str, Any]]:
    """Step 2 (code-only): strip filler words, tiny stumbles, pad 0.05s at word boundaries."""
    sent_hash = sha256_text("asr_norm_v8_wishedit|" + json.dumps(sentences, ensure_ascii=False))
    out_path = project_dir / "03_working" / f"{project_name}.cleaned_segments.json"

    prev = state.get("steps", {}).get("clean_cut", {})
    if prev.get("sentences_sha256") == sent_hash and out_path.exists():
        print(f"[Bước 2/Silence-Filler-Cut] Bỏ qua (state khớp hash {sent_hash[:10]}).")
        return json.loads(out_path.read_text(encoding="utf-8"))

    max_dur = float(ingest_data.get("work_duration", 9999.0))
    cleaned: list[dict[str, Any]] = []

    for sent in sentences:
        words = sent.get("words", [])
        if not words:
            continue
        # Bỏ từ đệm thuần túy ở đầu/cuối câu hoặc đứng lẻ
        filtered = list(words)
        while filtered and _strip_punct(filtered[0]["word"]) in PURE_FILLERS:
            filtered.pop(0)
        while filtered and _strip_punct(filtered[-1]["word"]) in PURE_FILLERS:
            filtered.pop()
        # Lọc từ đệm thuần túy xen giữa
        filtered = [w for w in filtered if _strip_punct(w["word"]) not in PURE_FILLERS]
        if not filtered:
            continue

        # Phát hiện đoạn vấp ngắn (< 3 từ, ngay trước câu lặp đầu giống hệt)
        clean_tokens = [_strip_punct(w["word"]) for w in filtered if _strip_punct(w["word"])]
        if not clean_tokens:
            continue
        if len(clean_tokens) == 1 and clean_tokens[0] in FILLER_WORDS:
            continue

        start = max(0.0, round(filtered[0]["start"] - pad_sec, 3))
        last_word = filtered[-1]
        last_prob = float(last_word.get("probability", 1.0))
        tail_pad = 0.18 if last_prob < 0.65 or str(last_word.get("word", "")).lower().strip(".!?") in {"ha", "nha", "nhé", "ạ", "rồi", "được"} else pad_sec
        end = min(max_dur, round(last_word["end"] + tail_pad, 3))
        if end - start < 0.35:
            continue

        text = " ".join(w["word"].strip() for w in filtered).strip()
        text = re.sub(r"\s+([,.!?;:])", r"\1", text)
        text = _clean_vi_asr_text(text)
        clean_tokens = [_strip_punct(t) for t in text.split() if _strip_punct(t)]
        if (text.endswith("...") or text.endswith("…")) and len(clean_tokens) <= 4:
            continue
        avg_prob = sum(float(w.get("probability", 1.0)) for w in filtered) / len(filtered)

        cleaned.append({
            "id": sent["id"],
            "start": start,
            "end": end,
            "duration": round(end - start, 3),
            "text": text,
            "tokens": clean_tokens,
            "avg_prob": round(avg_prob, 3),
        })

    # Bỏ câu vấp ngắn ngay trước câu bắt đầu bằng cùng 2 từ khóa đầu
    final_cleaned: list[dict[str, Any]] = []
    for i, cur in enumerate(cleaned):
        if i + 1 < len(cleaned):
            nxt = cleaned[i + 1]
            cur_t = cur["tokens"]
            nxt_t = nxt["tokens"]
            if (
                len(cur_t) <= 3
                and len(nxt_t) > len(cur_t)
                and (nxt["start"] - cur["end"]) <= 0.6
                and cur_t[0] == nxt_t[0]
            ):
                continue
        final_cleaned.append(cur)

    # Tránh chồng lấn giữa hai đoạn liền kề sau khi thêm đệm 0.05s
    for i in range(len(final_cleaned) - 1):
        if final_cleaned[i]["end"] > final_cleaned[i + 1]["start"]:
            mid = round((final_cleaned[i]["end"] + final_cleaned[i + 1]["start"]) / 2, 3)
            final_cleaned[i]["end"] = mid
            final_cleaned[i + 1]["start"] = mid
            final_cleaned[i]["duration"] = round(mid - final_cleaned[i]["start"], 3)
            final_cleaned[i + 1]["duration"] = round(final_cleaned[i + 1]["end"] - mid, 3)

    out_path.write_text(json.dumps(final_cleaned, ensure_ascii=False, indent=2), encoding="utf-8")
    state.setdefault("steps", {})["clean_cut"] = {
        "sentences_sha256": sent_hash,
        "kept_segments": len(final_cleaned),
        "total_clean_duration": round(sum(c["duration"] for c in final_cleaned), 2),
        "completed": True,
    }
    save_state(project_dir, project_name, state)
    print(
        f"[Bước 2/Silence-Filler-Cut] Giữ {len(final_cleaned)}/{len(sentences)} câu "
        f"(tổng sạch: {sum(c['duration'] for c in final_cleaned):.2f}s, đệm={pad_sec}s)."
    )
    return final_cleaned


def step3_gate_and_edl(
    project_dir: Path,
    project_name: str,
    cleaned: list[dict[str, Any]],
    state: dict[str, Any],
    target_duration: float = 0.0,
    force_ai: bool = False,
    preset_name: str = "retake_select",
) -> dict[str, Any]:
    """Evaluate AI Gate using video content + 00_brief/, export EDL, and detect source gaps."""
    total_clean_sec = round(sum(c["duration"] for c in cleaned), 2)
    retake_pairs = smart_local_retake_pairs(cleaned)
    brief_data = load_project_brief(project_dir)
    brief_points = brief_data.get("outline_points", [])

    raw_rows = [
        EdlRow(keep=1, start=c["start"], end=c["end"], label="main", text=c["text"], note="")
        for c in cleaned
    ]
    watchlist_hits = scan_watchlist(raw_rows, only_kept=True)
    claims_path = project_dir / "03_working" / f"{project_name}.claims_report.json"
    claims_path.write_text(json.dumps(watchlist_hits, ensure_ascii=False, indent=2), encoding="utf-8")

    reasons: list[str] = []
    if retake_pairs:
        reasons.append(f"retake_pairs={len(retake_pairs)}")
    if target_duration and target_duration > 0 and total_clean_sec > target_duration * 1.5:
        reasons.append(f"duration={total_clean_sec}s > 1.5x({target_duration}s)")
    if brief_points:
        reasons.append(f"brief_points={len(brief_points)}")
    if watchlist_hits:
        reasons.append(f"watchlist_hits={len(watchlist_hits)}")
    if force_ai:
        reasons.append("force_ai=True")

    ai_meta: dict[str, Any] = {"ai_called": False, "cache_hit": False, "provider": "none"}
    ai_calls = 0

    if not reasons:
        reasons.append("semantic_edit_and_traffic_guard")

    print(f"[Bước 3/AI Edit] Đang biên tập cấu trúc & lọc từ bóp tương tác — Lý do: {', '.join(reasons)}")
    brief_ctx = ""
    if brief_points:
        brief_ctx = "\n\nBRIEF / DÀN Ý MỤC TIÊU (giữ đủ các ý này):\n" + "\n".join(f"- {bp}" for bp in brief_points)
    cap_hint = (
        f"Nếu có thể gói gọn dưới ~{target_duration:.0f}s mà vẫn đủ ý chính."
        if target_duration and target_duration > 0
        else "KHÔNG cắt gọt cứng theo số giây; giữ toàn bộ ý rõ ràng khớp Brief, chỉ bỏ retake/câu vấp/nói thừa và câu chèo kéo mua bán/giá cả. KHÔNG giữ câu đại từ/liên từ nếu thiếu câu danh từ làm rõ chủ ngữ ngay trước nó."
    )
    compressed = "\n".join(f"{c['id']}|{c['duration']:.1f}|{c['text']}" for c in cleaned) + brief_ctx
    prompt_preset = load_prompt_preset(preset_name)
    prompt_text = (
        f"{prompt_preset}\n\n"
        f"{cap_hint} Chỉ trả về JSON thuần gồm: "
        "selected_ids (mảng ID giữ theo thứ tự phát), dropped (mảng {id, reason}), hook_id, hook_title, text_fixes (tùy chọn)."
    )
    broll_dir = project_dir / "04_assets" / "broll"
    broll_kws = [
        tok for p in broll_dir.iterdir()
        if p.is_file() and not p.name.startswith("ai_") and p.name != ".gitkeep"
        for tok in re.split(r"[^a-zA-Z0-9À-ỹ]+", p.stem.lower())
        if len(tok) >= 3
    ] if broll_dir.exists() else []
    decision, ai_meta = call_ai_cached(
        project_dir=project_dir,
        project_name=project_name,
        task_name=f"step3_v2_{preset_name}",
        prompt_text=prompt_text,
        compressed_payload=compressed,
        fallback_fn=lambda: smart_local_structure(
            cleaned,
            target_duration=target_duration,
            preset=preset_name,
            brief_points=brief_points,
            broll_keywords=broll_kws,
        ),
    )
    if ai_meta.get("ai_called"):
        ai_calls = 1

    by_id = {c["id"]: c for c in cleaned}
    selected_ids = [sid for sid in decision.get("selected_ids", []) if sid in by_id]
    if not selected_ids:
        selected_ids = [c["id"] for c in cleaned]
    dropped_reasons = {d["id"]: d.get("reason", "dropped") for d in decision.get("dropped", []) if "id" in d}
    hook_id = decision.get("hook_id", "")

    ordered_ids = list(selected_ids)
    if hook_id and hook_id in ordered_ids and ordered_ids[0] != hook_id:
        ordered_ids.remove(hook_id)
        ordered_ids.insert(0, hook_id)

    raw_fixes = decision.get("text_fixes") if isinstance(decision.get("text_fixes"), dict) else {}
    text_fixes = {str(k): str(v).strip() for k, v in raw_fixes.items() if str(v).strip()}
    final_rows = []
    for idx_pos, sid in enumerate(ordered_ids):
        c = by_id[sid]
        lbl = "hook" if (sid == hook_id or idx_pos == 0 and c["duration"] <= 3.8) else "main"
        row_txt = _clean_vi_asr_text(text_fixes.get(sid, c["text"]))
        final_rows.append(EdlRow(keep=1, start=c["start"], end=c["end"], label=lbl, text=row_txt, note=""))

    for c in cleaned:
        if c["id"] not in ordered_ids:
            final_rows.append(
                EdlRow(
                    keep=0,
                    start=c["start"],
                    end=c["end"],
                    label="drop",
                    text=_clean_vi_asr_text(c["text"]),
                    note=dropped_reasons.get(c["id"], "dropped_by_gate"),
                )
            )

    # Gắn cờ note cho câu dính watchlist
    hit_texts = {h["text"] for h in watchlist_hits}
    for r in final_rows:
        if r.keep == 1 and r.text in hit_texts and "watchlist" not in r.note:
            r.note = (r.note + "; " if r.note else "") + "watchlist: kiểm tra câu cam kết/chính sách"

    edl_ai_path = project_dir / "03_working" / f"{project_name}.edl.ai.tsv"
    edl_work_path = project_dir / "03_working" / f"{project_name}.edl.tsv"
    edl_final_path = project_dir / "03_working" / f"{project_name}.edl.final.tsv"
    write_edl(edl_ai_path, final_rows)
    write_edl(edl_work_path, final_rows)
    write_edl(edl_final_path, final_rows)

    # Khi EDL được tái tạo mới ở Bước 3, reset cờ captions_edited để phụ đề tự đồng bộ 100% với EDL mới
    layers_path = project_dir / "03_working" / f"{project_name}.layers.json"
    if layers_path.exists():
        try:
            ldata = json.loads(layers_path.read_text(encoding="utf-8"))
            ldata["captions_edited"] = False
            layers_path.write_text(json.dumps(ldata, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass

    gaps_report = analyze_content_and_source_gaps(project_dir, final_rows, brief_data=brief_data)
    summary = edl_summary(final_rows)
    state.setdefault("steps", {})["gate_edl"] = {
        "gate_triggered": bool(reasons),
        "reasons": reasons,
        "ai_calls": ai_calls,
        "ai_meta": ai_meta,
        "summary": summary,
        "gap_count": gaps_report["gap_count"],
        "completed": True,
    }
    save_state(project_dir, project_name, state)
    print(
        f"[Bước 3/EDL] Đã xuất {edl_work_path.name}: {summary} | "
        f"ai_calls={ai_calls} ({ai_meta.get('provider')}) | gợi ý source trám={gaps_report['gap_count']}."
    )
    return {
        "reasons": reasons,
        "ai_calls": ai_calls,
        "ai_meta": ai_meta,
        "summary": summary,
        "watchlist_hits": len(watchlist_hits),
        "gaps_summary": {
            "gap_count": gaps_report["gap_count"],
            "brief_coverage_pct": gaps_report["brief_coverage_pct"],
        },
    }


def run_pipeline(
    project_name: str,
    up_to: int = 3,
    whisper_model: str = "small",
    target_duration: float = 0.0,
    force_ai: bool = False,
    preset_name: str = "retake_select",
) -> dict[str, Any]:
    """Run pipeline stages 1..up_to for a project."""
    refresh_windows_path()
    t0 = time.time()
    proj_dir = ensure_project(project_name)
    state = load_state(proj_dir, project_name)

    ingest_data = step1_ingest(proj_dir, project_name, state)
    sentences = step1_transcribe(proj_dir, project_name, ingest_data, state, whisper_model=whisper_model)
    result: dict[str, Any] = {"project": project_name, "sentences": len(sentences)}

    if up_to >= 2:
        cleaned = step2_silence_filler_cut(proj_dir, project_name, sentences, ingest_data, state)
        result["cleaned_segments"] = len(cleaned)
    else:
        cleaned = []

    if up_to >= 3:
        gate_res = step3_gate_and_edl(
            proj_dir,
            project_name,
            cleaned,
            state,
            target_duration=target_duration,
            force_ai=force_ai,
            preset_name=preset_name,
        )
        result["gate"] = gate_res

    elapsed = round(time.time() - t0, 2)
    result["elapsed_sec"] = elapsed
    append_log(
        proj_dir,
        f"pipeline_1_to_{up_to}",
        f"python _tools/pipeline.py --project {project_name} --up-to {up_to} --whisper-model {whisper_model}"
        + (" --force-ai" if force_ai else ""),
        result,
    )
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Chạy pipeline bước 1-3 cho dự án anthinh.")
    parser.add_argument("--project", required=True, help="Tên thư mục dự án trong Projects/")
    parser.add_argument("--up-to", type=int, default=3, choices=[1, 2, 3], help="Dừng ở bước nào (1, 2 hoặc 3)")
    parser.add_argument("--whisper-model", default="small", help="Model faster-whisper (tiny/base/small/medium)")
    parser.add_argument("--target-duration", type=float, default=0.0, help="Giới hạn giây tùy chọn (0 = Tự động theo nội dung & Brief)")
    parser.add_argument("--force-ai", action="store_true", help="Ép bật cổng AI ở bước 3")
    parser.add_argument("--preset", default="retake_select", help="Preset prompt trong _tools/prompts/")
    args = parser.parse_args()

    res = run_pipeline(
        project_name=args.project,
        up_to=args.up_to,
        whisper_model=args.whisper_model,
        target_duration=args.target_duration,
        force_ai=args.force_ai,
        preset_name=args.preset,
    )
    print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
