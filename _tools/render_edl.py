"""Render EDL TSV -> FFmpeg splice cuts (0.03s audio fades, 1080x1920 30fps)
-> Audio mix (loudnorm + music duck + SFX) -> Remotion overlays -> Final MP4 + Thumb + Resolve EDL + QA.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

from audio_mix import mix_project_audio
from color_engine import analyze_video_color_and_luts, build_ffmpeg_color_filter
from common import (
    REMOTION_DIR,
    append_log,
    ensure_project,
    ffprobe_json,
    find_raw_videos,
    refresh_windows_path,
    resolve_portable_path,
    sanitize_natural_filename,
    sha256_text,
    slugify_vi,
)
from edl_utils import read_edl
from export_resolve_edl import export_cmx3600
from hardware import get_power_settings, get_remotion_flags, get_video_encode_args
from qa_check import run_qa_check
from remotion_props import build_props_and_layers


def _rgb_hex_to_ass_bgr(hex_color: str, alpha: str = "00") -> str:
    """Convert #RRGGBB to ASS &HAABBGGRR& color format."""
    c = hex_color.strip().lstrip("#")
    if len(c) != 6:
        return f"&H{alpha}FFFFFF&"
    r, g, b = c[0:2], c[2:4], c[4:6]
    return f"&H{alpha}{b.upper()}{g.upper()}{r.upper()}&"


def _fmt_ass_time(sec: float) -> str:
    s = max(0.0, float(sec))
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    rem = s % 60
    return f"{h}:{m:02d}:{rem:05.2f}"


def _build_ass_subtitle_file(props: dict[str, Any], ass_path: Path) -> Path:
    """Compile Remotion props (Hook, Captions with keyword colors, InfoCards, Watermark) into native ASS."""
    import re

    fps = float(props.get("fps", 30))
    w = int(props.get("width", 1080))
    h = int(props.get("height", 1920))
    st = props.get("style", {})
    accent_ass = _rgb_hex_to_ass_bgr(st.get("accentColor", "#38BDF8"))
    num_ass = _rgb_hex_to_ass_bgr(st.get("numberColor", "#FACC15"))
    base_ass = _rgb_hex_to_ass_bgr(st.get("captionColor", "#FFFFFF"))
    font_size = int(st.get("captionFontSize", 52))
    bottom_px = int(st.get("captionBottomPx", 320))
    hook_top_px = int(st.get("hookTopPx", 88))
    dur_sec = float(props.get("durationInFrames", 150)) / fps

    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {w}",
        f"PlayResY: {h}",
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: SubMain,Be Vietnam Pro,{font_size},{base_ass},{base_ass},&H28000000&,&H88000000&,-1,0,0,0,100,100,0,0,1,3.2,2.5,2,64,136,{bottom_px},1",
        f"Style: SubNote,Be Vietnam Pro,{max(26, int(font_size * 0.54))},&H00F0E2E8&,&H00FFFFFF&,&H40000000&,&H902A170F&,-1,0,0,0,100,100,0,0,3,8,0,2,64,136,{max(220, bottom_px - 58)},1",
        f"Style: HookEye,Be Vietnam Pro,26,&H00FFFFFF&,&H00FFFFFF&,&H00EB6325&,&H00EB6325&,-1,0,0,0,100,100,1,0,3,10,0,8,64,64,{hook_top_px},1",
        f"Style: HookMain,Be Vietnam Pro,48,&H00FFFFFF&,&H00FFFFFF&,&H20000000&,&H90000000&,-1,0,0,0,100,100,0,0,1,3.5,3.0,8,64,64,{hook_top_px + 54},1",
        "Style: InfoCard,Be Vietnam Pro,30,&H002A170F&,&H002A170F&,&H00FAFCFF&,&H00FAFCFF&,-1,0,0,0,100,100,0,0,3,12,2,2,64,136,445,1",
        "Style: DarkCard,Be Vietnam Pro,34,&H00FFFFFF&,&H00FFFFFF&,&H002A170F&,&HC81E0F09&,-1,0,0,0,100,100,0,0,3,16,0,5,72,72,0,1",
        "Style: Watermark,Be Vietnam Pro,24,&H45FFFFFF&,&H45FFFFFF&,&H60000000&,&H00000000&,-1,0,0,0,100,100,0,0,1,1.5,1.5,7,44,44,46,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    wm = str(props.get("watermarkHandle", "") or "").strip()
    if wm and wm != "@thinhchapmach":
        lines.append(f"Dialogue: 1,0:00:00.00,{_fmt_ass_time(dur_sec)},Watermark,,0,0,0,,{wm}")

    for ds in props.get("darkScenes", []):
        t0 = _fmt_ass_time(float(ds.get("startFrame", 0)) / fps)
        t1 = _fmt_ass_time(float(ds.get("endFrame", 90)) / fps)
        title = str(ds.get("title", "TÓM TẮT Ý CHÍNH")).strip().upper()
        bullets = [str(b).strip() for b in ds.get("bullets", []) if str(b).strip()]
        ds_body = f"{{\\c{accent_ass}}}{title}{{\\c{base_ass}}}"
        if bullets:
            ds_body += "\\N" + "\\N".join(f"• {b}" for b in bullets[:3])
        lines.append(f"Dialogue: 6,{t0},{t1},DarkCard,,0,0,0,,{{\\fad(120,150)}}  {ds_body}  ")

    hook = props.get("hook") or {}
    if hook.get("enabled") and hook.get("title"):
        t0 = _fmt_ass_time(float(hook.get("startFrame", 0)) / fps)
        t1 = _fmt_ass_time(float(hook.get("endFrame", 90)) / fps)
        if hook.get("eyebrow"):
            lines.append(f"Dialogue: 3,{t0},{t1},HookEye,,0,0,0,,  {hook['eyebrow'].upper()}  ")
        words = str(hook["title"]).strip().upper().split()
        if len(words) > 3:
            lead = " ".join(words[:-3])
            focus = " ".join(words[-3:])
            h_txt = f"{lead} {{\\c{accent_ass}}}{focus}{{\\c{base_ass}}}"
        else:
            h_txt = " ".join(words)
        lines.append(f"Dialogue: 3,{t0},{t1},HookMain,,0,0,0,,{{\\fad(120,180)}}{h_txt}")

    for ic in props.get("infoCards", []):
        t0 = _fmt_ass_time(float(ic.get("startFrame", 0)) / fps)
        t1 = _fmt_ass_time(float(ic.get("endFrame", 60)) / fps)
        lbl = str(ic.get("label", "")).strip()
        det = str(ic.get("detail", "")).strip()
        body = f"◆ {lbl}" + (f" · {det}" if det else "")
        lines.append(f"Dialogue: 4,{t0},{t1},InfoCard,,0,0,0,,{{\\fad(120,150)}}  {body}  ")

    for cap in props.get("captions", []):
        t0 = _fmt_ass_time(float(cap.get("startFrame", 0)) / fps)
        t1 = _fmt_ass_time(float(cap.get("endFrame", 30)) / fps)
        txt = str(cap.get("text", "")).strip()
        kws = [k.strip() for k in cap.get("keywords", []) if k and k.strip()]
        if kws:
            kws_sorted = sorted(kws, key=len, reverse=True)
            pat = re.compile("(" + "|".join(re.escape(k) for k in kws_sorted) + ")", flags=re.IGNORECASE)

            def _repl(m: re.Match) -> str:
                word = m.group(0)
                col = num_ass if any(ch.isdigit() for ch in word) else accent_ass
                return f"{{\\c{col}}}{word}{{\\c{base_ass}}}"

            txt = pat.sub(_repl, txt)
        lines.append(
            f"Dialogue: 5,{t0},{t1},SubMain,,0,0,0,,{{\\fscx94\\fscy94\\t(0,80,\\fscx100\\fscy100)}}{txt}"
        )
        sub = str(cap.get("subtext", "")).strip()
        if sub:
            lines.append(f"Dialogue: 5,{t0},{t1},SubNote,,0,0,0,,  {sub}  ")

    ass_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return ass_path


def _ffmpeg_has_filter(filter_name: str = "ass") -> bool:
    """Return True if the installed ffmpeg binary includes the specified filter (e.g. libass 'ass')."""
    try:
        proc = subprocess.run(
            ["ffmpeg", "-hide_banner", "-filters"],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return f" {filter_name} " in (proc.stdout or "")
    except Exception:
        return False


def _hex_to_rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = str(hex_color or "#FFFFFF").strip().lstrip("#")
    if len(h) != 6:
        return (255, 255, 255, alpha)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def _load_pil_font(proj_dir: Path, weight: str, size: int):
    from PIL import ImageFont
    from common import TEMPLATE_DIR

    for base in (proj_dir / "04_assets" / "fonts", TEMPLATE_DIR / "04_assets" / "fonts"):
        cand = base / f"BeVietnamPro-{weight}.ttf"
        if cand.exists():
            try:
                return ImageFont.truetype(str(cand), size=size)
            except Exception:
                pass
    return ImageFont.load_default()


def _draw_stroked_centered_lines(
    draw,
    canvas_w: int,
    start_y: int,
    wrapped_lines: list[list[tuple[str, tuple[int, int, int, int]]]],
    font,
    line_gap: int = 12,
    stroke_w: int = 4,
) -> int:
    """Draw multi-word colored lines centered horizontally with crisp dark stroke."""
    cur_y = start_y
    space_bbox = draw.textbbox((0, 0), " ", font=font)
    space_w = max(8, space_bbox[2] - space_bbox[0])
    for tokens in wrapped_lines:
        widths = []
        max_h = 0
        for word, _ in tokens:
            bb = draw.textbbox((0, 0), word, font=font)
            widths.append(bb[2] - bb[0])
            max_h = max(max_h, bb[3] - bb[1])
        total_w = sum(widths) + space_w * max(0, len(tokens) - 1)
        cur_x = int((canvas_w - total_w) / 2)
        for (word, col_rgba), w_px in zip(tokens, widths):
            draw.text(
                (cur_x, cur_y),
                word,
                font=font,
                fill=col_rgba,
                stroke_width=stroke_w,
                stroke_fill=(6, 10, 20, 245),
            )
            cur_x += w_px + space_w
        cur_y += max_h + line_gap
    return cur_y


def _render_pillow_text_overlays(
    proj_dir: Path,
    props: dict[str, Any],
    work_dir: Path,
) -> list[tuple[Path, float, float, str]]:
    """Render Hook, Captions, InfoCards, DarkScenes & Watermark as transparent PNGs when ffmpeg lacks libass."""
    import re
    from PIL import Image, ImageDraw

    ov_dir = work_dir / "_text_overlays"
    ov_dir.mkdir(parents=True, exist_ok=True)
    for old in ov_dir.glob("*.png"):
        try:
            old.unlink()
        except OSError:
            pass

    fps = float(props.get("fps", 30))
    w = int(props.get("width", 1080))
    h = int(props.get("height", 1920))
    st = props.get("style", {})
    accent_rgba = _hex_to_rgba(st.get("accentColor", "#38BDF8"))
    num_rgba = _hex_to_rgba(st.get("numberColor", "#FACC15"))
    base_rgba = _hex_to_rgba(st.get("captionColor", "#FFFFFF"))
    font_size = int(st.get("captionFontSize", 52))
    bottom_px = int(st.get("captionBottomPx", 320))
    hook_top_px = int(st.get("hookTopPx", 88))
    dur_sec = float(props.get("durationInFrames", 150)) / fps

    overlays: list[tuple[Path, float, float, str]] = []

    # 1. Hook Banner (first ~3s)
    hook = props.get("hook") or {}
    if hook.get("enabled") and hook.get("title"):
        t0 = float(hook.get("startFrame", 0)) / fps
        t1 = float(hook.get("endFrame", 90)) / fps
        h_img = Image.new("RGBA", (w, 340), (0, 0, 0, 0))
        draw = ImageDraw.Draw(h_img)
        cur_y = 14
        eyebrow = str(hook.get("eyebrow", "") or "").strip().upper()
        if eyebrow:
            f_eye = _load_pil_font(proj_dir, "ExtraBold", 24)
            ebb = draw.textbbox((0, 0), eyebrow, font=f_eye)
            ew, eh = ebb[2] - ebb[0], ebb[3] - ebb[1]
            px0 = int((w - ew) / 2) - 24
            px1 = int((w + ew) / 2) + 24
            draw.rounded_rectangle([(px0, cur_y), (px1, cur_y + eh + 20)], radius=22, fill=(14, 165, 233, 240))
            draw.text((int((w - ew) / 2), cur_y + 8), eyebrow, font=f_eye, fill=(255, 255, 255, 255))
            cur_y += eh + 36

        f_hook = _load_pil_font(proj_dir, "Black", 48)
        words = str(hook["title"]).strip().upper().split()
        focus_set = set(range(max(0, len(words) - 3), len(words))) if len(words) > 3 else set()
        lines_tok: list[list[tuple[str, tuple[int, int, int, int]]]] = []
        cur_line: list[tuple[str, tuple[int, int, int, int]]] = []
        cur_chars = 0
        for idx_w, wd in enumerate(words):
            col = accent_rgba if idx_w in focus_set else (255, 255, 255, 255)
            if cur_line and (cur_chars + len(wd) > 20):
                lines_tok.append(cur_line)
                cur_line = [(wd, col)]
                cur_chars = len(wd)
            else:
                cur_line.append((wd, col))
                cur_chars += len(wd) + 1
        if cur_line:
            lines_tok.append(cur_line)
        _draw_stroked_centered_lines(draw, w, cur_y, lines_tok[:3], f_hook, line_gap=10, stroke_w=5)
        hook_png = ov_dir / "ov_hook.png"
        h_img.save(hook_png, format="PNG")
        overlays.append((hook_png, t0, t1, f"0:{max(24, hook_top_px)}"))

    # 2. InfoCards
    for ic_idx, ic in enumerate(props.get("infoCards", [])[:6]):
        t0 = float(ic.get("startFrame", 0)) / fps
        t1 = float(ic.get("endFrame", 60)) / fps
        ic_img = Image.new("RGBA", (w, 130), (0, 0, 0, 0))
        draw = ImageDraw.Draw(ic_img)
        lbl = str(ic.get("label", "")).strip()
        det = str(ic.get("detail", "")).strip()
        f_lbl = _load_pil_font(proj_dir, "ExtraBold", 30)
        f_det = _load_pil_font(proj_dir, "SemiBold", 22)
        body = f"◆ {lbl}" + (f" · {det}" if det else "")
        bb = draw.textbbox((0, 0), body, font=f_lbl)
        bw = min(w - 100, bb[2] - bb[0] + 64)
        x0 = int((w - bw) / 2)
        draw.rounded_rectangle([(x0, 12), (x0 + bw, 108)], radius=44, fill=(248, 250, 252, 245), outline=(56, 189, 248, 255), width=3)
        draw.text((x0 + 28, 28), f"◆ {lbl}", font=f_lbl, fill=(15, 23, 42, 255))
        if det:
            draw.text((x0 + 34, 68), det[:48], font=f_det, fill=(71, 85, 105, 255))
        ic_png = ov_dir / f"ov_ic_{ic_idx:02d}.png"
        ic_img.save(ic_png, format="PNG")
        overlays.append((ic_png, t0, t1, f"0:{h - bottom_px - 280}"))

    # 3. Captions (with keyword & number highlight)
    f_cap = _load_pil_font(proj_dir, "ExtraBold", font_size)
    f_sub = _load_pil_font(proj_dir, "SemiBold", max(24, int(font_size * 0.52)))
    cap_band_h = 280
    cap_y = max(980, h - bottom_px - 190)

    for c_idx, cap in enumerate(props.get("captions", [])):
        t0 = float(cap.get("startFrame", 0)) / fps
        t1 = float(cap.get("endFrame", 30)) / fps
        txt = str(cap.get("text", "")).strip()
        if not txt:
            continue
        kws = [k.strip().lower() for k in cap.get("keywords", []) if k and k.strip()]
        raw_words = txt.split()
        # Highlight words that belong to a keyword phrase or contain digits
        full_low = txt.lower()
        kw_spans: list[tuple[int, int]] = []
        for kw in kws:
            for m in re.finditer(re.escape(kw), full_low):
                kw_spans.append((m.start(), m.end()))

        colored_words: list[tuple[str, tuple[int, int, int, int]]] = []
        pos_cursor = 0
        for wd in raw_words:
            idx_in_txt = full_low.find(wd.lower(), pos_cursor)
            if idx_in_txt < 0:
                idx_in_txt = pos_cursor
            end_in_txt = idx_in_txt + len(wd)
            pos_cursor = end_in_txt
            in_kw = any(s <= idx_in_txt and end_in_txt <= e for s, e in kw_spans)
            has_num = any(ch.isdigit() for ch in wd)
            if has_num:
                col = num_rgba
            elif in_kw:
                col = accent_rgba
            else:
                col = base_rgba
            colored_words.append((wd, col))

        lines_tok = []
        cur_line = []
        cur_chars = 0
        for wd, col in colored_words:
            if cur_line and (cur_chars + len(wd) > 22):
                lines_tok.append(cur_line)
                cur_line = [(wd, col)]
                cur_chars = len(wd)
            else:
                cur_line.append((wd, col))
                cur_chars += len(wd) + 1
        if cur_line:
            lines_tok.append(cur_line)

        c_img = Image.new("RGBA", (w, cap_band_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(c_img)
        end_y = _draw_stroked_centered_lines(draw, w, 16, lines_tok[:3], f_cap, line_gap=10, stroke_w=5)
        sub = str(cap.get("subtext", "") or "").strip()
        if sub and end_y + 42 < cap_band_h:
            sbb = draw.textbbox((0, 0), sub, font=f_sub)
            sw, sh = sbb[2] - sbb[0], sbb[3] - sbb[1]
            sx0 = int((w - sw) / 2) - 18
            sx1 = int((w + sw) / 2) + 18
            draw.rounded_rectangle([(sx0, end_y + 4), (sx1, end_y + sh + 18)], radius=16, fill=(15, 23, 42, 200))
            draw.text((int((w - sw) / 2), end_y + 9), sub, font=f_sub, fill=(226, 232, 240, 255))

        c_png = ov_dir / f"ov_cap_{c_idx:03d}.png"
        c_img.save(c_png, format="PNG")
        overlays.append((c_png, t0, t1, f"0:{cap_y}"))

    return overlays


def _render_fast_gpu_pipeline(
    proj_dir: Path,
    base_cuts_mp4: Path,
    mixed_wav: Path,
    props: dict[str, Any],
    final_mp4: Path,
    thumb_path: Path,
) -> None:
    """Ultra-fast C/GPU FFmpeg render (~5-12s): composites B-rolls + Subtitles (libass or Pillow PNGs) + Hardware Encoder."""
    work_dir = proj_dir / "03_working"
    ass_path = work_dir / "fast_subs.ass"
    _build_ass_subtitle_file(props, ass_path)

    fps = float(props.get("fps", 30))
    inputs: list[str] = ["-i", str(base_cuts_mp4), "-i", str(mixed_wav)]
    filter_chains: list[str] = []
    cur_v = "[0:v]"
    in_idx = 2

    # Overlay BOTH Video B-rolls (.mp4/.mov — muted close-up cutaways) AND Image B-rolls (.png/.jpg)
    for idx, br in enumerate(props.get("broll", [])[:8]):
        src_name = Path(str(br.get("src", ""))).name
        cand = proj_dir / "04_assets" / "broll" / src_name
        if not cand.exists():
            continue
        ext = cand.suffix.lower()
        t0 = float(br.get("startFrame", 0)) / fps
        t1 = float(br.get("endFrame", 60)) / fps
        if ext in {".mp4", ".mov", ".mkv", ".webm"}:
            inputs.extend(["-stream_loop", "-1", "-i", str(cand)])
            pts_shift = f"setpts=PTS-STARTPTS+{t0:.3f}/TB,"
            if br.get("layout") == "full":
                filter_chains.append(
                    f"[{in_idx}:v]{pts_shift}fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[br{idx}];"
                    f"{cur_v}[br{idx}]overlay=0:0:enable='between(t,{t0:.2f},{t1:.2f})':eof_action=pass[vbr{idx}]"
                )
            else:
                filter_chains.append(
                    f"[{in_idx}:v]{pts_shift}fps=30,scale=860:-1[br{idx}];"
                    f"{cur_v}[br{idx}]overlay=(W-w)/2:168:enable='between(t,{t0:.2f},{t1:.2f})':eof_action=pass[vbr{idx}]"
                )
            cur_v = f"[vbr{idx}]"
            in_idx += 1
        elif ext in {".png", ".jpg", ".jpeg", ".webp"}:
            inputs.extend(["-i", str(cand)])
            if br.get("layout") == "full":
                filter_chains.append(
                    f"[{in_idx}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[br{idx}];"
                    f"{cur_v}[br{idx}]overlay=0:0:enable='between(t,{t0:.2f},{t1:.2f})'[vbr{idx}]"
                )
            else:
                filter_chains.append(
                    f"[{in_idx}:v]scale=860:-1[br{idx}];"
                    f"{cur_v}[br{idx}]overlay=(W-w)/2:148:enable='between(t,{t0:.2f},{t1:.2f})'[vbr{idx}]"
                )
            cur_v = f"[vbr{idx}]"
            in_idx += 1

    # Áp dụng AI Auto Color + 3D LUT (.cube/.3dl) + Adjustment Layer nếu bật
    color_cfg = props.get("color") or {}
    color_analysis = analyze_video_color_and_luts(proj_dir.name) if color_cfg.get("autoColorEnabled") else None
    color_filter = build_ffmpeg_color_filter(proj_dir, color_cfg, color_analysis)
    if color_filter:
        filter_chains.append(f"{cur_v}{color_filter}[vcol]")
        cur_v = "[vcol]"

    if _ffmpeg_has_filter("ass"):
        filter_chains.append(f"{cur_v}ass=fast_subs.ass:fontsdir=../04_assets/fonts[vfinal]")
    else:
        pil_overlays = _render_pillow_text_overlays(proj_dir, props, work_dir)
        if not pil_overlays:
            filter_chains.append(f"{cur_v}null[vfinal]")
        else:
            for ov_i, (png_path, t0, t1, pos_xy) in enumerate(pil_overlays):
                inputs.extend(["-i", str(png_path)])
                out_tag = "[vfinal]" if ov_i == len(pil_overlays) - 1 else f"[vtxt{ov_i}]"
                filter_chains.append(
                    f"{cur_v}[{in_idx}:v]overlay={pos_xy}:enable='between(t,{t0:.2f},{t1:.2f})'{out_tag}"
                )
                cur_v = out_tag
                in_idx += 1

    filter_complex = ";".join(filter_chains)
    fc_script_path = work_dir / "fast_filter_complex.txt"
    fc_script_path.write_text(filter_complex, encoding="utf-8")
    v_enc = get_video_encode_args("final")

    total_dur_sec = float(props.get("durationInFrames", 150)) / fps
    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex_script", str(fc_script_path),
        "-map", "[vfinal]", "-map", "1:a:0",
        *v_enc,
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-t", f"{total_dur_sec:.3f}",
        "-movflags", "+faststart",
        str(final_mp4),
    ]
    subprocess.run(cmd, cwd=str(work_dir), check=True, capture_output=True)

    thumb_sec = min(1.15, max(0.0, (int(props.get("durationInFrames", 30)) - 1) / 30.0))
    subprocess.run(
        [
            "ffmpeg", "-y", "-ss", f"{thumb_sec:.2f}",
            "-i", str(final_mp4),
            "-frames:v", "1",
            str(thumb_path),
        ],
        check=True,
        capture_output=True,
    )


def _link_or_copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def _next_output_version(out_dir: Path, raw_title: str, overwrite: bool = False) -> tuple[Path, int, str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    clean_title = sanitize_natural_filename(raw_title, fallback="Video WishEdit")
    first_cand = out_dir / f"{clean_title}.mp4"
    if overwrite or not first_cand.exists():
        return first_cand, 1, clean_title
    v = 2
    while (out_dir / f"{clean_title} ({v}).mp4").exists():
        v += 1
    stem = f"{clean_title} ({v})"
    return out_dir / f"{stem}.mp4", v, stem


def _cut_and_concat_segments(
    source_video: Path,
    kept_rows: list,
    out_base_mp4: Path,
    fade_sec: float = 0.03,
    speech_speed: float = 1.0,
    preserve_native_res: bool = False,
    enable_dynamic_framing: bool = True,
    video_scale: float = 1.0,
    video_offset_x: float = 0.0,
    video_offset_y: float = 0.0,
) -> tuple[Path, int, int]:
    """Cut EDL segments standardized to 1080x1920 30fps with smooth fades, user zoom/pan, and multi-angle crop variety."""
    src_info = ffprobe_json(source_video)
    src_dur = float(src_info.get("format", {}).get("duration", 0.0) or 0.0)
    v_stream = next((s for s in src_info.get("streams", []) if s.get("codec_type") == "video"), {})
    src_w = int(v_stream.get("width", 1080) or 1080)

    # Luôn chuẩn hóa canvas đầu ra về 1080x1920 (9:16) để phụ đề, Hook và thẻ đồ họa không bao giờ bị thu nhỏ 50% trên nguồn 4K
    out_w, out_h = 1080, 1920
    sharp = ",unsharp=5:5:0.45:3:3:0.0" if src_w < 1080 else ""
    u_scale = max(1.0, min(2.5, float(video_scale or 1.0)))
    pan_x = max(-0.45, min(0.45, float(video_offset_x or 0.0) / 100.0))
    pan_y = max(-0.45, min(0.45, float(video_offset_y or 0.0) / 100.0))

    if u_scale > 1.01 or abs(pan_x) > 0.005 or abs(pan_y) > 0.005:
        cx_ratio = max(0.0, min(1.0, 0.5 - pan_x))
        cy_ratio = max(0.0, min(1.0, 0.5 - pan_y))
        base_scale = (
            f"scale={int(round(out_w * u_scale))}:{int(round(out_h * u_scale))}:flags=lanczos:force_original_aspect_ratio=increase,"
            f"crop={out_w}:{out_h}:(iw-ow)*{cx_ratio:.3f}:(ih-oh)*{cy_ratio:.3f}{sharp}"
        )
    else:
        base_scale = (
            f"scale={out_w}:{out_h}:flags=lanczos:force_original_aspect_ratio=increase,"
            f"crop={out_w}:{out_h}{sharp}"
        )

    speed = max(0.85, min(1.4, float(speech_speed)))
    v_speed = f",setpts=PTS/{speed:.4f}" if abs(speed - 1.0) > 0.005 else ""
    a_speed = f",atempo={speed:.4f}" if abs(speed - 1.0) > 0.005 else ""

    filter_lines: list[str] = []
    concat_labels: list[str] = []
    last_idx = len(kept_rows) - 1

    for i, r in enumerate(kept_rows):
        seg_start = float(r.start)
        seg_end = float(r.end)
        # Bảo vệ câu CTA cuối video không bao giờ bị cắt cụt âm đuôi
        if i == last_idx:
            cap_end = src_dur if src_dur > 0 else seg_end + 0.45
            seg_end = min(cap_end, seg_end + 0.35)
        dur = max(0.05, seg_end - seg_start)
        f_d_in = min(fade_sec, dur / 4.0)
        f_d_out = min(0.14 if i == last_idx else fade_sec, dur / 3.0)
        fade_out_st = max(0.0, dur - f_d_out)

        # Xen kẽ góc máy (1.00x Toàn -> 1.13x Cận -> 1.06x Trung) để không bị 1 góc quay cố định nhàm chán
        if enable_dynamic_framing and i > 0 and i % 3 == 1:
            v_frame = f"crop=iw/1.13:ih/1.13:(iw-ow)/2:(ih-oh)*0.26,scale={out_w}:{out_h}:flags=lanczos"
        elif enable_dynamic_framing and i > 0 and i % 3 == 2:
            v_frame = f"crop=iw/1.07:ih/1.07:(iw-ow)/2:(ih-oh)*0.30,scale={out_w}:{out_h}:flags=lanczos"
        else:
            v_frame = base_scale

        filter_lines.append(
            f"[0:v]trim=start={seg_start:.3f}:end={seg_end:.3f},setpts=PTS-STARTPTS"
            f"{v_speed},fps=30,{v_frame},setsar=1[v{i}];"
        )
        filter_lines.append(
            f"[0:a]atrim=start={seg_start:.3f}:end={seg_end:.3f},asetpts=PTS-STARTPTS,"
            f"aresample=48000,aformat=channel_layouts=stereo,"
            f"afade=t=in:st=0:d={f_d_in:.3f},afade=t=out:st={fade_out_st:.3f}:d={f_d_out:.3f}"
            f"{a_speed}[a{i}];"
        )
        concat_labels.append(f"[v{i}][a{i}]")

    filter_lines.append(
        "".join(concat_labels) + f"concat=n={len(kept_rows)}:v=1:a=1[vout][aout]"
    )
    filter_text = "\n".join(filter_lines)
    script_path = out_base_mp4.with_suffix(".filter.txt")
    script_path.write_text(filter_text, encoding="utf-8")

    fc_args = (
        ["-filter_complex", filter_text]
        if len(filter_text) < 8000
        else ["-/filter_complex", str(script_path)]
    )
    v_enc = get_video_encode_args("base_cuts")
    cmd = [
        "ffmpeg", "-y", "-i", str(source_video),
        *fc_args,
        "-map", "[vout]", "-map", "[aout]",
        *v_enc,
        "-c:a", "aac", "-b:a", "256k",
        str(out_base_mp4),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return out_base_mp4, out_w, out_h


def render_project(
    project_name: str,
    edl_path: Path | None = None,
    topic: str | None = None,
    overwrite: bool = False,
    export_other_platforms: bool = False,
    render_engine: str = "remotion",
) -> dict[str, Any]:
    refresh_windows_path()
    t0 = time.time()
    proj_dir = ensure_project(project_name)

    if edl_path is None:
        final_edl = proj_dir / "03_working" / f"{project_name}.edl.final.tsv"
        work_edl = proj_dir / "03_working" / f"{project_name}.edl.tsv"
        if work_edl.exists() and (not final_edl.exists() or work_edl.stat().st_mtime >= final_edl.stat().st_mtime):
            edl_path = work_edl
        else:
            edl_path = final_edl if final_edl.exists() else work_edl
    if not edl_path.exists():
        raise FileNotFoundError(f"Không tìm thấy EDL tại {edl_path}")

    rows = read_edl(edl_path)
    kept = [r for r in rows if r.keep == 1]
    if not kept:
        raise ValueError("EDL không có dòng nào được giữ (keep=1).")

    ingest_path = proj_dir / "03_working" / f"{project_name}.ingest.json"
    if ingest_path.exists():
        ingest_data = json.loads(ingest_path.read_text(encoding="utf-8"))
        source_video = resolve_portable_path(proj_dir, ingest_data.get("work_video", ""), "03_working")
        if not source_video.exists():
            raw = find_raw_videos(proj_dir)
            if raw:
                source_video = raw[0]
    else:
        raw = find_raw_videos(proj_dir)
        if not raw:
            raise FileNotFoundError("Không tìm thấy video gốc trong 01_raw/")
        source_video = raw[0]

    print("[Render 1/5] Sinh Remotion props & kiểm tra layers...")
    props = build_props_and_layers(project_name, edl_path=edl_path, preserve_user_layers=True)

    layers_path = proj_dir / "03_working" / f"{project_name}.layers.json"
    layers_data = json.loads(layers_path.read_text(encoding="utf-8"))
    audio_cfg = layers_data.get("audio", {})
    video_cfg = layers_data.get("video", {})
    if video_cfg.get("exportOtherPlatforms"):
        export_other_platforms = True
    speech_speed = float(video_cfg.get("speechSpeed", 1.08))
    preserve_native_res = False
    enable_dynamic_framing = bool(video_cfg.get("enableSubtleZoom", True))
    video_scale = float(video_cfg.get("videoScale", 1.0))
    video_offset_x = float(video_cfg.get("videoOffsetX", 0.0))
    video_offset_y = float(video_cfg.get("videoOffsetY", 0.0))

    base_cuts_mp4 = proj_dir / "03_working" / f"{project_name}.base_cuts.mp4"
    cuts_hash_file = proj_dir / "03_working" / f"{project_name}.base_cuts.sha256"
    cuts_sig = sha256_text(
        json.dumps(
            {
                "ver": "v5_1080p_wishedit",
                "src": str(source_video),
                "mtime": source_video.stat().st_mtime if source_video.exists() else 0,
                "speed": round(speech_speed, 3),
                "dynamic_framing": enable_dynamic_framing,
                "vscale": round(video_scale, 3),
                "vox": round(video_offset_x, 2),
                "voy": round(video_offset_y, 2),
                "rows": [(round(r.start, 3), round(r.end, 3)) for r in kept],
            },
            sort_keys=True,
        )
    )
    if base_cuts_mp4.exists() and cuts_hash_file.exists() and cuts_hash_file.read_text(encoding="utf-8").strip() == cuts_sig:
        v_st = next((s for s in ffprobe_json(base_cuts_mp4).get("streams", []) if s.get("codec_type") == "video"), {})
        out_w, out_h = int(v_st.get("width", 1080) or 1080), int(v_st.get("height", 1920) or 1920)
        print(f"[Render 2/5] Dùng lại base_cuts.mp4 đã cache ({cuts_sig[:10]})...")
    else:
        print(f"[Render 2/5] Cắt & nối {len(kept)} đoạn EDL chuẩn 1080x1920 (speed={speech_speed:.2f}x, multicam_zoom={enable_dynamic_framing})...")
        _, out_w, out_h = _cut_and_concat_segments(
            source_video,
            kept,
            base_cuts_mp4,
            fade_sec=0.03,
            speech_speed=speech_speed,
            preserve_native_res=preserve_native_res,
            enable_dynamic_framing=enable_dynamic_framing,
            video_scale=video_scale,
            video_offset_x=video_offset_x,
            video_offset_y=video_offset_y,
        )
        cuts_hash_file.write_text(cuts_sig, encoding="utf-8")
    actual_dur = float(ffprobe_json(base_cuts_mp4).get("format", {}).get("duration", 0.0) or 0.0)
    if actual_dur > 0.2:
        props["durationInFrames"] = max(30, int(round(actual_dur * 30)))
    props["width"] = 1080
    props["height"] = 1920

    mixed_wav = proj_dir / "03_working" / f"{project_name}.mixed_audio.wav"
    print("[Render 3/5] Mix giọng nói (-14 LUFS), nhạc nền & SFX...")
    mix_info = mix_project_audio(
        proj_dir=proj_dir,
        speech_video_path=base_cuts_mp4,
        out_audio_wav=mixed_wav,
        audio_cfg=audio_cfg,
        sfx_events=props.get("sfxEvents", []),
        fps=30,
    )

    hook_title_default = str((props.get("hook") or {}).get("title") or "").strip().title() or "Video WishEdit"
    raw_topic = topic if (topic and topic not in ("_demo", "demo", "tim-ugc-mien-phi")) else hook_title_default
    out_dir = proj_dir / "05_output" / "tiktok_9x16"
    final_mp4, ver_num, clean_stem = _next_output_version(out_dir, raw_topic, overwrite=overwrite)
    thumb_path = proj_dir / "05_output" / "thumbnails" / f"{clean_stem}_thumb.png"
    thumb_path.parent.mkdir(parents=True, exist_ok=True)

    if render_engine == "fast_gpu":
        print(f"[Render 4-5/5] ⚡ Xuất siêu tốc bằng FFmpeg ASS + GPU ({final_mp4.name})...")
        _render_fast_gpu_pipeline(proj_dir, base_cuts_mp4, mixed_wav, props, final_mp4, thumb_path)
    else:
        # Chuẩn bị hardlink vào _tools/remotion/public/_render/<project>/ để Remotion load ổn định
        stage_dir = REMOTION_DIR / "public" / "_render" / project_name
        if stage_dir.exists():
            shutil.rmtree(stage_dir, ignore_errors=True)
        stage_dir.mkdir(parents=True, exist_ok=True)

        remotion_visual_mp4 = proj_dir / "03_working" / f"{project_name}.remotion_visual.mp4"
        try:
            staged_base = stage_dir / "base_cuts.mp4"
            color_cfg = props.get("color") or {}
            color_analysis = analyze_video_color_and_luts(proj_dir.name) if color_cfg.get("autoColorEnabled") else None
            color_filter = build_ffmpeg_color_filter(proj_dir, color_cfg, color_analysis)
            if color_filter:
                v_enc_col = get_video_encode_args("base_cuts")
                subprocess.run(
                    [
                        "ffmpeg", "-y", "-i", str(base_cuts_mp4),
                        "-vf", color_filter,
                        *v_enc_col,
                        "-an",
                        str(staged_base),
                    ],
                    cwd=str(proj_dir / "03_working"),
                    check=True,
                    capture_output=True,
                )
            else:
                _link_or_copy(base_cuts_mp4, staged_base)

            render_props = dict(props)
            render_props["videoSrc"] = f"_render/{project_name}/base_cuts.mp4"
            render_props["muteVideo"] = True

            staged_broll = []
            for item in props.get("broll", []):
                src_name = Path(item.get("src", "")).name
                cand = proj_dir / "04_assets" / "broll" / src_name
                if not cand.exists():
                    cand = proj_dir / "04_assets" / "overlays" / src_name
                if cand.exists():
                    _link_or_copy(cand, stage_dir / src_name)
                    new_item = dict(item)
                    new_item["src"] = f"_render/{project_name}/{src_name}"
                    staged_broll.append(new_item)
            render_props["broll"] = staged_broll

            staged_logos = []
            for lb in props.get("logoBadges", []):
                new_lb = dict(lb)
                src_name = Path(lb.get("src", "")).name if lb.get("src") else ""
                if src_name:
                    cand = proj_dir / "04_assets" / "logo" / src_name
                    if cand.exists():
                        _link_or_copy(cand, stage_dir / src_name)
                        new_lb["src"] = f"_render/{project_name}/{src_name}"
                    else:
                        new_lb["src"] = ""
                staged_logos.append(new_lb)
            render_props["logoBadges"] = staged_logos

            render_props_path = proj_dir / "03_working" / f"{project_name}.render_props.tmp.json"
            render_props_path.write_text(json.dumps(render_props, ensure_ascii=False, indent=2), encoding="utf-8")

            npx_exe = "npx.cmd" if os.name == "nt" else "npx"
            hw_remotion_flags = get_remotion_flags()
            print(f"[Render 4/5] Render đồ họa & phụ đề tiếng Việt bằng Remotion ({' '.join(hw_remotion_flags)})...")
            proc = subprocess.Popen(
                [
                    npx_exe, "remotion", "render",
                    "src/index.ts", "AnThinhVideo", str(remotion_visual_mp4),
                    f"--props={render_props_path}",
                    "--muted",
                    "--codec=h264",
                    "--image-format=jpeg",
                    "--jpeg-quality=95",
                    "--pixel-format=yuv420p",
                    "--crf=14",
                    *hw_remotion_flags,
                ],
                cwd=str(REMOTION_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="ignore",
            )
            last_pct = -10
            tail_lines: list[str] = []
            assert proc.stdout is not None
            for raw_line in proc.stdout:
                line = raw_line.strip()
                if not line:
                    continue
                tail_lines.append(line)
                if len(tail_lines) > 25:
                    tail_lines.pop(0)
                m_pct = re.search(r"(\d+)/(\d+)", line)
                if m_pct and ("Rendered" in line or "Encoded" in line or "frames" in line.lower()):
                    cur_f, tot_f = int(m_pct.group(1)), max(1, int(m_pct.group(2)))
                    pct = int(round((cur_f / tot_f) * 100))
                    if pct >= last_pct + 8 or pct == 100:
                        last_pct = pct
                        print(f"[Render 4/5] Remotion: {pct}% ({cur_f}/{tot_f} frames)")
                elif "Bundling" in line or "Rendering" in line or "Encoding" in line:
                    print(f"[Render 4/5] {line[:120]}")
            ret_code = proc.wait()
            if ret_code != 0:
                raise subprocess.CalledProcessError(ret_code, "remotion render", output="\n".join(tail_lines))

            thumb_sec = min(1.15, max(0.0, (int(render_props.get("durationInFrames", 30)) - 1) / 30.0))
            subprocess.run(
                [
                    "ffmpeg", "-y", "-ss", f"{thumb_sec:.2f}",
                    "-i", str(remotion_visual_mp4),
                    "-frames:v", "1",
                    str(thumb_path),
                ],
                check=True,
                capture_output=True,
            )
        finally:
            shutil.rmtree(stage_dir, ignore_errors=True)

        print(f"[Render 5/5] Ghép hình + âm thanh xuất file cuối {final_mp4.name}...")
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", str(remotion_visual_mp4),
                "-i", str(mixed_wav),
                "-map", "0:v:0", "-map", "1:a:0",
                "-c:v", "copy",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                "-movflags", "+faststart", "-shortest",
                str(final_mp4),
            ],
            check=True,
            capture_output=True,
        )

    other_out: Path | None = None
    if export_other_platforms:
        other_dir = proj_dir / "05_output" / "other_platforms"
        other_dir.mkdir(parents=True, exist_ok=True)
        other_out = other_dir / f"{clean_stem} Reels Shorts.mp4"
        shutil.copy2(final_mp4, other_out)

    resolve_edl_path = out_dir / f"{clean_stem}.edl"
    export_cmx3600(project_name, edl_path, resolve_edl_path, fps=30)

    qa_report = run_qa_check(project_name, final_mp4)
    print(f"[Render QA] Hoàn tất: {'ĐẠT CHUẨN' if qa_report.get('passed') else 'CẢNH BÁO'} ({final_mp4.name})")
    elapsed = round(time.time() - t0, 2)

    summary = {
        "project": project_name,
        "output_video": str(final_mp4),
        "thumbnail": str(thumb_path),
        "resolve_edl": str(resolve_edl_path),
        "other_platform_video": str(other_out) if other_out else None,
        "mix_info": mix_info,
        "qa_passed": qa_report["passed"],
        "qa_warnings": qa_report["warnings"],
        "qa_frames": qa_report.get("scene_frames", []),
        "duration_sec": qa_report["duration_sec"],
        "elapsed_sec": elapsed,
    }
    append_log(
        proj_dir,
        "render_edl",
        f"python _tools/render_edl.py --project {project_name} --topic \"{clean_stem}\"",
        summary,
    )
    webhook_url = str(get_power_settings().get("remote_webhook_url") or "").strip()
    if webhook_url.startswith(("http://", "https://")):
        try:
            import urllib.request

            req = urllib.request.Request(
                webhook_url,
                data=json.dumps(summary, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(req, timeout=5).read()
        except Exception:
            pass
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Render video từ EDL TSV sang 1080x1920 30fps.")
    parser.add_argument("--project", required=True)
    parser.add_argument("--edl", default="", help="Đường dẫn EDL TSV tùy chọn")
    parser.add_argument("--topic", default="", help="Tên file xuất tự nhiên")
    parser.add_argument("--overwrite", action="store_true", help="Ghi đè bản xuất hiện tại")
    parser.add_argument("--other-platforms", action="store_true", help="Xuất thêm bản dự phòng")
    parser.add_argument("--engine", default="remotion", choices=["fast_gpu", "remotion"], help="Engine render: remotion (mặc định) hoặc fast_gpu")
    args = parser.parse_args()

    res = render_project(
        project_name=args.project,
        edl_path=Path(args.edl) if args.edl else None,
        topic=args.topic or None,
        overwrite=args.overwrite,
        export_other_platforms=args.other_platforms,
        render_engine=args.engine,
    )
    print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
