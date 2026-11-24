"""Build Remotion props JSON and editable layers JSON from EDL + word timestamps."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from ai_client import distill_clean_hook_title, generate_content_popups
from common import IMAGE_EXTS, VIDEO_EXTS, ensure_project, sha256_text
from color_engine import default_color_config
from edl_utils import EdlRow, read_edl

DEFAULT_STYLE = {
    "accentColor": "#38BDF8",
    "numberColor": "#FACC15",
    "captionColor": "#FFFFFF",
    "captionFontSize": 52,
    "captionBottomPx": 320,
    "hookTopPx": 88,
    "enableSubtleZoom": True,
    "stylePreset": "editorial",
    "videoScale": 1.0,
    "videoOffsetX": 0.0,
    "videoOffsetY": 0.0,
}

KEYWORD_HINTS = [
    "thương mại điện tử", "tmđt", "ugc",
    "đơn hàng", "tỷ lệ chuyển đổi", "livestream", "affiliate",
    "doanh thu", "lợi nhuận", "sai lầm", "bí quyết", "lưu ý", "shop mới",
    "tương tác", "khách hàng", "sản phẩm",
    "notebooklm", "google", "chatbot", "chatgpt", "claude", "gemini", "capcut",
    "dữ liệu", "bộ nhớ", "chiến dịch", "tổng hợp", "tóm tắt", "pdf", "file word",
    "ai", "doanh nghiệp", "công cụ", "tự động",
    "máy đọc sách", "e-ink", "xteink", "kindle", "iphone", "magsafe", "type-c",
    "4 inch", "55g", "nhỏ nhất thế giới", "phím cứng", "trôi trang", "pin",
]

INFO_CARD_CUES = [
    ("bước 1", "check", "Bước 1"),
    ("bước 2", "check", "Bước 2"),
    ("bước 3", "check", "Bước 3"),
    ("thứ nhất", "check", "Điểm nổi bật"),
    ("thứ hai", "check", "Điểm tiếp theo"),
    ("thứ ba", "check", "Điểm thứ 3"),
    ("đầu tiên", "bolt", "Điểm đầu tiên"),
    ("sai lầm", "alert", "Lưu ý quan trọng"),
    ("lưu ý", "alert", "Điểm cần chú ý"),
    ("tỷ lệ", "chart", "Tối ưu chuyển đổi"),
    ("đơn hàng", "bag", "Tối ưu đơn hàng"),
    ("3 giây", "clock", "Hook 3 giây đầu"),
    ("e-ink", "bolt", "Màn hình E-Ink sắc nét"),
    ("4 inch", "bolt", "Kích thước siêu gọn 4 inch"),
    ("siêu mỏng", "bolt", "Thiết kế siêu mỏng"),
    ("mỏng", "bolt", "Siêu mỏng nhẹ"),
    ("hít", "check", "Hít MagSafe tiện lợi"),
    ("không cảm ứng", "alert", "Không cảm ứng"),
    ("phím cứng", "check", "Phím cứng chống trôi trang"),
    ("pin", "bolt", "Pin trâu dùng lâu"),
    ("55g", "bolt", "Siêu nhẹ chỉ 55g"),
    ("siêu nhẹ", "bolt", "Cầm 1 tay siêu nhẹ"),
    ("type-c", "bolt", "Sạc nhanh Type-C"),
]

BRAND_CUES = [
    ("notebooklm", "notebooklm", "NotebookLM"),
    ("tiktok shop", "tiktokshop", "TikTok Shop"),
    ("tiktok", "tiktok", "TikTok"),
    ("chatgpt", "chatgpt", "ChatGPT"),
    ("claude", "claude", "Claude AI"),
    ("gemini", "gemini", "Google Gemini"),
    ("google", "google", "Google"),
    ("capcut", "capcut", "CapCut"),
    ("chatbot", "ai", "AI Chatbot"),
]


def _pick_keywords(text: str) -> list[str]:
    low = text.lower()
    found: list[str] = []
    for kw in KEYWORD_HINTS:
        if kw in low:
            m = re.search(re.escape(kw), text, flags=re.IGNORECASE)
            if m and m.group(0) not in found:
                found.append(m.group(0))
            if len(found) >= 2:
                return found
    nums = re.findall(r"\b\d+(?:[.,]\d+)?%?\b", text)
    for n in nums:
        if n not in found:
            found.append(n)
        if len(found) >= 2:
            return found
    return found[:2]


def _attach_word_frames(
    chunk_words: list[str],
    chunk_start_sec: float,
    chunk_end_sec: float,
    matched_raw_words: list[dict[str, Any]],
    src_start: float,
    out_start: float,
    speech_speed: float,
    fps: int = 30,
) -> list[dict[str, Any]]:
    """Build per-word frame timing from .words.json (or proportional fallback) for word-level animation."""
    if not chunk_words:
        return []
    n = len(chunk_words)
    dur = max(0.15, chunk_end_sec - chunk_start_sec)
    result: list[dict[str, Any]] = []

    if len(matched_raw_words) == n:
        for w_txt, rw in zip(chunk_words, matched_raw_words):
            w_out_s = max(chunk_start_sec, out_start + max(0.0, float(rw["start"]) - src_start) / speech_speed)
            w_out_e = min(chunk_end_sec, out_start + max(0.05, float(rw["end"]) - src_start) / speech_speed)
            if w_out_e <= w_out_s:
                w_out_e = min(chunk_end_sec, w_out_s + dur / n)
            sf = int(round(w_out_s * fps))
            ef = max(sf + 2, int(round(w_out_e * fps)))
            result.append({"word": w_txt, "startFrame": sf, "endFrame": ef})
        return result

    total_chars = max(1, sum(len(w) for w in chunk_words))
    cur = chunk_start_sec
    for idx, w_txt in enumerate(chunk_words):
        w_dur = dur * (len(w_txt) / total_chars)
        nxt = chunk_end_sec if idx == n - 1 else round(cur + w_dur, 3)
        sf = int(round(cur * fps))
        ef = max(sf + 2, int(round(nxt * fps)))
        result.append({"word": w_txt, "startFrame": sf, "endFrame": ef})
        cur = nxt
    return result


def _split_caption_chunks(
    text: str,
    start_sec: float,
    end_sec: float,
    max_words: int = 5,
    raw_seg_words: list[dict[str, Any]] | None = None,
    src_start: float = 0.0,
    speech_speed: float = 1.08,
    fps: int = 30,
) -> list[dict[str, Any]]:
    words = text.split()
    seg_words = raw_seg_words or []
    if len(words) <= max_words:
        return [{
            "startSec": start_sec,
            "endSec": end_sec,
            "text": text,
            "keywords": _pick_keywords(text),
            "subtext": "",
            "words": _attach_word_frames(words, start_sec, end_sec, seg_words, src_start, start_sec, speech_speed, fps),
        }]

    # Chia đều số từ mỗi cụm để tránh rớt 1 từ lẻ ở cụm cuối
    num_parts = (len(words) + max_words - 1) // max_words
    base, rem = divmod(len(words), num_parts)
    parts: list[list[str]] = []
    raw_parts: list[list[dict[str, Any]]] = []
    idx = 0
    for p_i in range(num_parts):
        size = base + (1 if p_i < rem else 0)
        parts.append(words[idx:idx + size])
        raw_parts.append(seg_words[idx:idx + size] if len(seg_words) == len(words) else [])
        idx += size

    chunks: list[dict[str, Any]] = []
    total_chars = max(1, sum(len(" ".join(p)) for p in parts))
    cur = start_sec
    total_dur = max(0.2, end_sec - start_sec)
    for p_idx, p in enumerate(parts):
        chunk_text = " ".join(p)
        rp = raw_parts[p_idx]
        if rp:
            c_start = max(cur, start_sec + max(0.0, float(rp[0]["start"]) - src_start) / speech_speed) if p_idx > 0 else cur
            c_end = end_sec if p_idx == len(parts) - 1 else min(end_sec, start_sec + max(0.1, float(rp[-1]["end"]) - src_start) / speech_speed)
            if c_end <= c_start + 0.18:
                ratio = len(chunk_text) / total_chars
                c_end = end_sec if p_idx == len(parts) - 1 else round(cur + total_dur * ratio, 3)
            nxt = c_end
        else:
            ratio = len(chunk_text) / total_chars
            nxt = end_sec if p_idx == len(parts) - 1 else round(cur + total_dur * ratio, 3)
        c_end_safe = max(cur + 0.25, nxt)
        chunks.append({
            "startSec": cur,
            "endSec": c_end_safe,
            "text": chunk_text,
            "keywords": _pick_keywords(chunk_text),
            "subtext": "",
            "words": _attach_word_frames(p, cur, c_end_safe, rp, src_start, start_sec, speech_speed, fps),
        })
        cur = nxt
    return chunks


def _default_hook_title(rows: list[EdlRow]) -> str:
    kept = [r for r in rows if r.keep == 1]
    if not kept:
        return ""
    return distill_clean_hook_title(kept[0].text)


def _discover_broll_suggestions(proj_dir: Path, kept_timeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    broll_dir = proj_dir / "04_assets" / "broll"
    if not broll_dir.exists():
        return []
    assets = [
        p for p in sorted(broll_dir.iterdir())
        if p.is_file() and not p.name.startswith("ai_") and p.suffix.lower() in (IMAGE_EXTS | VIDEO_EXTS)
    ]
    if not assets or not kept_timeline:
        return []

    items: list[dict[str, Any]] = []
    for idx, asset in enumerate(assets):
        stem_tokens = [t for t in re.split(r"[^a-zA-Z0-9À-ỹ]+", asset.stem.lower()) if len(t) >= 3]
        matched_seg = None
        for seg in kept_timeline:
            low_txt = seg["text"].lower()
            if any(tok in low_txt for tok in stem_tokens):
                matched_seg = seg
                break
        if matched_seg is None and idx == 0 and len(kept_timeline) > 1:
            matched_seg = kept_timeline[min(1, len(kept_timeline) - 1)]
        if matched_seg:
            start_f = int(round(matched_seg["outStart"] * 30))
            end_f = min(int(round(matched_seg["outEnd"] * 30)), start_f + 90)
            if end_f > start_f + 15:
                items.append({
                    "id": f"BR{idx+1}",
                    "src": asset.name,
                    "mediaType": "video" if asset.suffix.lower() in VIDEO_EXTS else "image",
                    "layout": "pip_top",
                    "caption": "",
                    "startFrame": start_f,
                    "endFrame": end_f,
                })
    return items


def _discover_logo_badges(proj_dir: Path, kept_timeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return empty list by default so unrequested brand logos (like TikTok Shop) never pop up automatically."""
    return []


def _build_zoom_and_transitions(kept_timeline: list[dict[str, Any]], fps: int = 30) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Generate sparse, subtle zoom accents and crisp cut transitions without constant zooming."""
    zoom_patterns = [
        (1.00, 1.05),  # zoom vào nhẹ ở điểm nhấn
        (1.05, 1.00),  # lùi ra êm ái
    ]
    trans_types = ["whip_left", "flash", "whip_right", "zoom_pop"]

    zoom_segments: list[dict[str, Any]] = []
    cut_transitions: list[dict[str, Any]] = []
    last_zoom_end = -180  # ít nhất ~7s giữa các lần nhấn zoom để không bị zoom mãi

    for idx, seg in enumerate(kept_timeline):
        sf = int(round(seg["outStart"] * fps))
        ef = max(sf + 15, int(round(seg["outEnd"] * fps)))
        dur_frames = ef - sf

        # Chỉ gắn zoom nhẹ ở một vài đoạn điểm nhấn đủ dài và cách quãng
        if idx > 0 and dur_frames >= 45 and (sf - last_zoom_end >= 180):
            z_from, z_to = zoom_patterns[len(zoom_segments) % len(zoom_patterns)]
            zoom_segments.append({
                "startFrame": sf,
                "endFrame": ef,
                "fromScale": z_from,
                "toScale": z_to,
                "originY": "36%",
            })
            last_zoom_end = ef

        if idx > 0:
            # Gắn hiệu ứng cắt cảnh ở các mối nối cách nhau >= 3.0s (90 frames)
            if not cut_transitions or (sf - cut_transitions[-1]["frame"] >= 90):
                cut_transitions.append({
                    "frame": sf,
                    "type": trans_types[idx % len(trans_types)],
                })
    return zoom_segments, cut_transitions


def _normalize_broll_items(items: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for idx, raw in enumerate(items or []):
        item = dict(raw)
        src = str(item.get("src", "")).strip()
        if not src:
            continue
        ext = Path(src).suffix.lower()
        if item.get("mediaType") not in ("image", "video"):
            item["mediaType"] = "video" if ext in VIDEO_EXTS else "image"
        elif ext in VIDEO_EXTS and item.get("mediaType") != "video":
            item["mediaType"] = "video"
        raw_layout = item.get("layout") or item.get("mode") or "pip_top"
        item["layout"] = "full" if raw_layout == "full" else "pip_top"
        item.pop("mode", None)
        item.setdefault("id", f"BR{idx+1}")
        item.setdefault("caption", "")
        sf = max(0, int(item.get("startFrame", 0) or 0))
        ef = max(sf + 15, int(item.get("endFrame", sf + 60) or (sf + 60)))
        item["startFrame"] = sf
        item["endFrame"] = ef
        normalized.append(item)
    return normalized


def build_props_and_layers(
    project_name: str,
    edl_path: Path | None = None,
    preserve_user_layers: bool = True,
) -> dict[str, Any]:
    """Generate editable layers JSON and Remotion props JSON."""
    proj_dir = ensure_project(project_name)
    if edl_path is None:
        final_edl = proj_dir / "03_working" / f"{project_name}.edl.final.tsv"
        work_edl = proj_dir / "03_working" / f"{project_name}.edl.tsv"
        if work_edl.exists() and (not final_edl.exists() or work_edl.stat().st_mtime >= final_edl.stat().st_mtime):
            edl_path = work_edl
        else:
            edl_path = final_edl if final_edl.exists() else work_edl

    rows = read_edl(edl_path)
    kept_rows = [r for r in rows if r.keep == 1]

    layers_path = proj_dir / "03_working" / f"{project_name}.layers.json"
    existing_layers: dict[str, Any] = {}
    if preserve_user_layers and layers_path.exists():
        try:
            existing_layers = json.loads(layers_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing_layers = {}

    video_cfg = existing_layers.get("video") or {
        "enableSubtleZoom": True,
        "speechSpeed": 1.08,
        "preserveNativeResolution": False,
        "watermarkHandle": "",
        "exportOtherPlatforms": False,
        "videoScale": 1.0,
        "videoOffsetX": 0.0,
        "videoOffsetY": 0.0,
    }
    if video_cfg.get("watermarkHandle") == "@thinhchapmach":
        video_cfg["watermarkHandle"] = ""
    video_cfg.setdefault("videoScale", 1.0)
    video_cfg.setdefault("videoOffsetX", 0.0)
    video_cfg.setdefault("videoOffsetY", 0.0)
    speech_speed = max(0.85, min(1.4, float(video_cfg.get("speechSpeed", 1.08))))

    words_path = proj_dir / "02_transcripts" / f"{project_name}.words.json"
    all_raw_words: list[dict[str, Any]] = []
    if words_path.exists():
        try:
            all_raw_words = json.loads(words_path.read_text(encoding="utf-8"))
        except Exception:
            all_raw_words = []

    fps = 30
    cur_sec = 0.0
    kept_timeline: list[dict[str, Any]] = []
    captions: list[dict[str, Any]] = []
    info_cards: list[dict[str, Any]] = []
    dark_scenes: list[dict[str, Any]] = []
    last_card_sec = -10.0

    for idx, row in enumerate(kept_rows):
        seg_dur = row.duration / speech_speed
        out_start = round(cur_sec, 3)
        out_end = round(cur_sec + seg_dur, 3)
        kept_timeline.append({
            "index": idx,
            "label": row.label,
            "text": row.text,
            "outStart": out_start,
            "outEnd": out_end,
        })

        seg_raw_words = [
            w for w in all_raw_words
            if float(w.get("end", 0)) > row.start + 0.02 and float(w.get("start", 0)) < row.end - 0.02
        ]
        for c_idx, ch in enumerate(
            _split_caption_chunks(
                row.text,
                out_start,
                out_end,
                raw_seg_words=seg_raw_words,
                src_start=row.start,
                speech_speed=speech_speed,
                fps=fps,
            )
        ):
            sf = int(round(ch["startSec"] * fps))
            ef = max(sf + 5, int(round(ch["endSec"] * fps)))
            captions.append({
                "id": f"C{idx+1}_{c_idx+1}",
                "startFrame": sf,
                "endFrame": ef,
                "text": ch["text"],
                "keywords": ch["keywords"],
                "subtext": ch["subtext"],
                "words": ch.get("words", []),
            })

        if row.label == "dark":
            bullets = [p.strip() for p in re.split(r"[,;.]", row.text) if p.strip()][:3]
            dark_scenes.append({
                "id": f"DS{idx+1}",
                "title": "TÓM TẮT Ý CHÍNH",
                "metric": "",
                "bullets": bullets or [row.text],
                "startFrame": int(round(out_start * fps)),
                "endFrame": int(round(out_end * fps)),
            })

        cur_sec = out_end

    total_frames = max(30, int(round(cur_sec * fps)))

    full_kept_low = " ".join(r.text.lower() for r in kept_rows)
    auto_eyebrow = (
        "REVIEW THỰC TẾ"
        if any(k in full_kept_low for k in ("review", "máy đọc sách", "kindle", "e-ink", "xteink", "sản phẩm"))
        and not any(k in full_kept_low for k in ("tiktok shop", "tỷ lệ chuyển đổi", "ugc", "affiliate"))
        else "THỰC CHIẾN TMĐT"
    )
    hook_cfg = existing_layers.get("hook") or {
        "enabled": True,
        "eyebrow": auto_eyebrow,
        "title": _default_hook_title(rows),
        "startFrame": 0,
        "endFrame": min(90, total_frames),
    }
    if hook_cfg.get("title") in ("", "ĐÂY LÀ CHIẾC MÁY ĐỌC SÁCH GẦN"):
        hook_cfg["title"] = _default_hook_title(rows)

    music_files = sorted(
        p.name for p in (proj_dir / "04_assets" / "music").iterdir()
        if p.is_file() and p.name != ".gitkeep"
    ) if (proj_dir / "04_assets" / "music").exists() else []

    audio_cfg = existing_layers.get("audio") or {
        "normalizeSpeech": True,
        "denoiseSpeech": True,
        "musicFile": music_files[0] if music_files else "",
        "musicDb": -22.0,
        "enableSfx": True,
        "sfxDb": -16.0,
    }

    style_cfg = dict(DEFAULT_STYLE)
    if existing_layers.get("style"):
        style_cfg.update(existing_layers["style"])
    style_cfg["enableSubtleZoom"] = bool(video_cfg.get("enableSubtleZoom", True))
    style_cfg["videoScale"] = float(video_cfg.get("videoScale", 1.0))
    style_cfg["videoOffsetX"] = float(video_cfg.get("videoOffsetX", 0.0))
    style_cfg["videoOffsetY"] = float(video_cfg.get("videoOffsetY", 0.0))

    edl_text_sig = sha256_text("|".join(f"{r.start:.2f}-{r.end:.2f}:{r.text}" for r in kept_rows))[:12]
    can_reuse_captions = (
        bool(existing_layers.get("captions_edited"))
        and existing_layers.get("captions_edl_sig") == edl_text_sig
        and bool(existing_layers.get("captions"))
    )
    use_captions = existing_layers.get("captions") if can_reuse_captions else captions
    use_cards = (
        existing_layers.get("infoCards")
        if existing_layers.get("infoCards_edited")
        else generate_content_popups(proj_dir, project_name, kept_timeline, fps=fps)
    )
    use_dark = existing_layers.get("darkScenes") if existing_layers.get("darkScenes_edited") else dark_scenes
    raw_broll = existing_layers.get("broll") if existing_layers.get("broll_edited") else _discover_broll_suggestions(proj_dir, kept_timeline)
    use_broll = _normalize_broll_items(raw_broll)
    auto_zoom, auto_trans = _build_zoom_and_transitions(kept_timeline, fps=fps)
    use_zoom = existing_layers.get("zoomSegments") if existing_layers.get("zoomSegments_edited") else (auto_zoom if style_cfg["enableSubtleZoom"] else [])
    use_trans = existing_layers.get("cutTransitions") if existing_layers.get("cutTransitions_edited") else auto_trans
    raw_logos = existing_layers.get("logoBadges") if existing_layers.get("logoBadges_edited") else []
    use_logos = [lb for lb in (raw_logos or []) if lb.get("src") != "logo_tiktokshop.png" and lb.get("brand") != "tiktokshop"]

    color_cfg = default_color_config()
    if existing_layers.get("color"):
        color_cfg.update(existing_layers["color"])

    layers = {
        "project": project_name,
        "fps": fps,
        "durationInFrames": total_frames,
        "durationSec": round(cur_sec, 2),
        "video": video_cfg,
        "hook": hook_cfg,
        "style": style_cfg,
        "color": color_cfg,
        "autoBrollEnabled": bool(existing_layers.get("autoBrollEnabled", False)),
        "captions": use_captions,
        "captions_edited": can_reuse_captions,
        "captions_edl_sig": edl_text_sig,
        "infoCards": use_cards,
        "infoCards_edited": bool(existing_layers.get("infoCards_edited", False)),
        "darkScenes": use_dark,
        "darkScenes_edited": bool(existing_layers.get("darkScenes_edited", False)),
        "broll": use_broll,
        "broll_edited": bool(existing_layers.get("broll_edited", False)),
        "zoomSegments": use_zoom,
        "zoomSegments_edited": bool(existing_layers.get("zoomSegments_edited", False)),
        "cutTransitions": use_trans,
        "cutTransitions_edited": bool(existing_layers.get("cutTransitions_edited", False)),
        "logoBadges": use_logos,
        "logoBadges_edited": bool(existing_layers.get("logoBadges_edited", False)),
        "voiceoverEvents": existing_layers.get("voiceoverEvents", []),
        "markers": existing_layers.get("markers", []),
        "audio": audio_cfg,
    }
    layers_path.write_text(json.dumps(layers, ensure_ascii=False, indent=2), encoding="utf-8")

    # Sinh sự kiện SFX khớp hook, thẻ thông tin, cảnh tối, B-roll, chuyển cảnh và AI Voice-Over
    sfx_events: list[dict[str, Any]] = []
    for vo in layers.get("voiceoverEvents", []):
        if vo.get("file"):
            sfx_events.append({
                "frame": int(vo.get("startFrame", 0)),
                "sfx": str(vo["file"]),
                "gain_db": 0.0,
                "reason": f"voiceover:{vo.get('id', 'vo')}",
            })
    last_sfx_frame = -45
    if hook_cfg.get("enabled") and hook_cfg.get("title"):
        sfx_events.append({"frame": 2, "sfx": "pop.wav", "reason": "hook"})
        last_sfx_frame = 2
    for c in use_cards:
        f = int(c.get("startFrame", 0))
        if f - last_sfx_frame >= 45:
            sfx_events.append({"frame": f, "sfx": "ding.wav", "reason": f"card:{c.get('id')}"})
            last_sfx_frame = f
    for d in use_dark:
        f = int(d.get("startFrame", 0))
        if f - last_sfx_frame >= 45:
            sfx_events.append({"frame": f, "sfx": "whoosh.wav", "reason": f"dark:{d.get('id')}"})
            last_sfx_frame = f
    for lb in use_logos:
        f = int(lb.get("startFrame", 0))
        if f - last_sfx_frame >= 45:
            sfx_events.append({"frame": f, "sfx": "pop.wav", "reason": f"logo:{lb.get('id')}"})
            last_sfx_frame = f
    for tr in use_trans:
        f = int(tr.get("frame", 0))
        if tr.get("type") in ("whip_left", "whip_right") and f - last_sfx_frame >= 55:
            sfx_events.append({"frame": f, "sfx": "whoosh.wav", "reason": f"trans:{tr.get('type')}"})
            last_sfx_frame = f
    sfx_events.sort(key=lambda x: x["frame"])

    remotion_props = {
        "projectName": project_name,
        "fps": fps,
        "width": 1080,
        "height": 1920,
        "durationInFrames": total_frames,
        "videoSrc": "",
        "muteVideo": True,
        "style": style_cfg,
        "hook": hook_cfg,
        "captions": use_captions,
        "infoCards": use_cards,
        "darkScenes": use_dark,
        "broll": use_broll,
        "zoomSegments": use_zoom,
        "cutTransitions": use_trans,
        "logoBadges": use_logos,
        "watermarkHandle": video_cfg.get("watermarkHandle", ""),
        "color": color_cfg,
        "sfxEvents": sfx_events,
    }
    props_path = proj_dir / "03_working" / f"{project_name}.remotion_props.json"
    props_path.write_text(json.dumps(remotion_props, ensure_ascii=False, indent=2), encoding="utf-8")
    return remotion_props


def main() -> None:
    parser = argparse.ArgumentParser(description="Sinh remotion_props.json và layers.json từ EDL.")
    parser.add_argument("--project", required=True)
    parser.add_argument("--reset-layers", action="store_true", help="Tái tạo toàn bộ layers từ EDL")
    args = parser.parse_args()
    props = build_props_and_layers(args.project, preserve_user_layers=not args.reset_layers)
    print(
        f"Đã tạo props Remotion: {props['durationInFrames']} frames, "
        f"{len(props['captions'])} sub, {len(props['infoCards'])} thẻ, "
        f"{len(props['zoomSegments'])} zoom, {len(props['cutTransitions'])} chuyển cảnh, {len(props['logoBadges'])} logo."
    )


if __name__ == "__main__":
    main()
