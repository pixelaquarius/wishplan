"""Stage 4 helper: extract 2-second frames, scene-cut timestamps, and transcripts from _style_refs/."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Any

from common import STYLE_REFS_DIR, VIDEO_EXTS, ffprobe_json, load_wav_16k_float32, parse_ratio, refresh_windows_path


def analyze_style_refs(interval_sec: float = 2.0, whisper_model: str = "small") -> dict[str, Any]:
    refresh_windows_path()
    if not STYLE_REFS_DIR.exists():
        raise FileNotFoundError(f"Không thấy thư mục {STYLE_REFS_DIR}")

    videos = sorted(
        p for p in STYLE_REFS_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in VIDEO_EXTS
    )
    if not videos:
        return {"videos_found": 0, "message": "Chưa có video tham khảo trong _style_refs/."}

    import ctranslate2
    from faster_whisper import WhisperModel

    device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    model = WhisperModel(whisper_model, device=device, compute_type=compute_type)

    frames_root = STYLE_REFS_DIR / "_frames"
    frames_root.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []

    for vp in videos:
        clip_dir = frames_root / vp.stem
        clip_dir.mkdir(parents=True, exist_ok=True)

        info = ffprobe_json(vp)
        v_stream = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
        duration = float(info.get("format", {}).get("duration", 0.0) or 0.0)
        fps = parse_ratio(v_stream.get("avg_frame_rate"))

        # Tách khung hình mỗi 2 giây
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(vp),
                "-vf", f"fps=1/{interval_sec},scale=540:-1",
                "-q:v", "4",
                str(clip_dir / "frame_%03d.jpg"),
            ],
            check=True,
            capture_output=True,
        )

        # Đo điểm cắt cảnh bằng FFmpeg scene detector
        sc_res = subprocess.run(
            [
                "ffmpeg", "-i", str(vp),
                "-vf", "select='gt(scene,0.30)',showinfo",
                "-f", "null", "-",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
        scene_times = [float(x) for x in re.findall(r"pts_time:([\d.]+)", sc_res.stderr)]
        avg_shot_sec = round(duration / (len(scene_times) + 1), 2) if duration > 0 else 0.0

        # Tách audio WAV 16kHz mono để transcribe không phụ thuộc PyAV
        tmp_wav = clip_dir / "_tmp_16k.wav"
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(vp), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(tmp_wav)],
            check=True,
            capture_output=True,
        )
        segs, _ = model.transcribe(load_wav_16k_float32(tmp_wav), language="vi", vad_filter=True)
        tmp_wav.unlink(missing_ok=True)
        texts = [s.text.strip() for s in segs if s.text.strip()]
        full_text = " ".join(texts)
        word_count = len(full_text.split())
        wpm = round((word_count / duration) * 60, 1) if duration > 0 else 0.0

        results.append({
            "file": vp.name,
            "duration_sec": round(duration, 2),
            "resolution": f"{v_stream.get('width')}x{v_stream.get('height')}",
            "fps": round(fps, 2),
            "scene_cuts_count": len(scene_times),
            "avg_shot_sec": avg_shot_sec,
            "scene_timestamps": [round(t, 2) for t in scene_times[:40]],
            "words_per_minute": wpm,
            "frames_dir": str(clip_dir),
            "transcript": full_text,
        })

    summary_path = frames_root / "style_metrics.json"
    summary_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"videos_found": len(videos), "summary_file": str(summary_path), "clips": results}


def main() -> None:
    parser = argparse.ArgumentParser(description="Trích khung hình 2s, nhịp cắt và transcript từ _style_refs/.")
    parser.add_argument("--interval", type=float, default=2.0)
    parser.add_argument("--whisper-model", default="small")
    args = parser.parse_args()
    res = analyze_style_refs(interval_sec=args.interval, whisper_model=args.whisper_model)
    print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
