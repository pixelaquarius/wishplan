"""Technical QA check on rendered 9:16 video + Remotion props + frame extraction."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Any

from common import ensure_project, ffprobe_json, parse_ratio, refresh_windows_path


def run_qa_check(project_name: str, video_path: Path) -> dict[str, Any]:
    refresh_windows_path()
    proj_dir = ensure_project(project_name)
    info = ffprobe_json(video_path)

    v_stream = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
    a_stream = next((s for s in info.get("streams", []) if s.get("codec_type") == "audio"), {})
    duration = float(info.get("format", {}).get("duration", 0.0) or 0.0)
    width = int(v_stream.get("width", 0) or 0)
    height = int(v_stream.get("height", 0) or 0)
    fps = round(parse_ratio(v_stream.get("avg_frame_rate")), 2)
    v_codec = v_stream.get("codec_name", "")
    a_codec = a_stream.get("codec_name", "")

    warnings: list[str] = []
    if width != 1080 or height != 1920:
        warnings.append(f"Độ phân giải lệch chuẩn 1080x1920 (9:16): {width}x{height}")
    if abs(fps - 30.0) > 0.5:
        warnings.append(f"FPS lệch chuẩn 30fps: {fps}")
    if v_codec != "h264":
        warnings.append(f"Video codec không phải h264: {v_codec}")
    if a_codec and a_codec != "aac":
        warnings.append(f"Audio codec không phải aac: {a_codec}")
    if duration < 15 or duration > 75:
        warnings.append(f"Thời lượng {duration:.1f}s ngoài khoảng lý tưởng 30-65s (chấp nhận nếu clip demo ngắn)")

    # Kiểm tra âm lượng đỉnh & im lặng kéo dài
    vol_res = subprocess.run(
        ["ffmpeg", "-i", str(video_path), "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    mean_db = None
    max_db = None
    m_mean = re.search(r"mean_volume:\s*([-\d.]+)\s*dB", vol_res.stderr)
    m_max = re.search(r"max_volume:\s*([-\d.]+)\s*dB", vol_res.stderr)
    if m_mean:
        mean_db = float(m_mean.group(1))
    if m_max:
        max_db = float(m_max.group(1))
        if max_db > -0.2:
            warnings.append(f"Đỉnh âm lượng sát clipping ({max_db} dB)")

    sil_res = subprocess.run(
        ["ffmpeg", "-i", str(video_path), "-af", "silencedetect=noise=-42dB:d=1.5", "-f", "null", "-"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    long_silences = re.findall(r"silence_duration:\s*([\d.]+)", sil_res.stderr)
    if long_silences:
        warnings.append(f"Có {len(long_silences)} khoảng lặng > 1.5s ({', '.join(long_silences)})")

    # Kiểm tra độ dài phụ đề & logo lạ trong remotion_props.json
    props_path = proj_dir / "03_working" / f"{project_name}.remotion_props.json"
    if props_path.exists():
        props = json.loads(props_path.read_text(encoding="utf-8"))
        long_caps = [c["id"] for c in props.get("captions", []) if len(c.get("text", "")) > 65]
        if long_caps:
            warnings.append(f"Có {len(long_caps)} câu phụ đề hơi dài (>65 ký tự): {', '.join(long_caps[:5])}")
        stray_logos = [lb.get("src") or lb.get("brand") for lb in props.get("logoBadges", []) if lb.get("brand") == "tiktokshop"]
        if stray_logos:
            warnings.append(f"Phát hiện logo TikTok Shop tự động không mong muốn: {stray_logos}")

    # Trích 6 khung hình theo từng phân cảnh vào 06_logs/qa_frames/ + ghép bảng Contact Sheet 3x2
    from PIL import Image, ImageDraw

    qa_frames_dir = proj_dir / "06_logs" / "qa_frames"
    qa_frames_dir.mkdir(parents=True, exist_ok=True)
    frame_lumas: list[float] = []
    frame_clips: list[float] = []
    scene_frames: list[str] = []
    sample_points = [
        ("scene_01_hook", min(0.8, max(0.2, duration * 0.04))),
        ("scene_02", max(0.5, duration * 0.20)),
        ("scene_03", max(0.5, duration * 0.40)),
        ("scene_04", max(0.5, duration * 0.60)),
        ("scene_05", max(0.5, duration * 0.80)),
        ("scene_06_outro", max(0.5, duration - 1.0)),
    ]
    extracted_images: list[tuple[str, float, Image.Image]] = []
    for label, ts in sample_points:
        if ts < duration:
            out_jpg = qa_frames_dir / f"{video_path.stem}_{label}.jpg"
            subprocess.run(
                [
                    "ffmpeg", "-y", "-ss", f"{ts:.2f}", "-i", str(video_path),
                    "-frames:v", "1", "-q:v", "3", str(out_jpg),
                ],
                capture_output=True,
            )
            if out_jpg.exists():
                scene_frames.append(out_jpg.name)
                im_rgb = Image.open(out_jpg).convert("RGB")
                extracted_images.append((label, ts, im_rgb))
                im_l = im_rgb.convert("L")
                hist = im_l.histogram()
                tot = max(1, sum(hist))
                frame_lumas.append(sum(lv * cnt for lv, cnt in enumerate(hist)) / tot)
                frame_clips.append(sum(hist[240:]) / tot * 100.0)

    contact_sheet_name = ""
    if extracted_images:
        cell_w, cell_h = 360, 640
        cols, rows_cnt = 3, 2
        sheet = Image.new("RGB", (cell_w * cols, cell_h * rows_cnt), (9, 13, 22))
        draw = ImageDraw.Draw(sheet)
        for idx, (lbl, ts, im_rgb) in enumerate(extracted_images[:6]):
            r_i, c_i = divmod(idx, cols)
            thumb = im_rgb.resize((cell_w, cell_h))
            sheet.paste(thumb, (c_i * cell_w, r_i * cell_h))
            draw.rectangle([(c_i * cell_w + 8, r_i * cell_h + 8), (c_i * cell_w + 185, r_i * cell_h + 34)], fill=(9, 13, 22))
            draw.text((c_i * cell_w + 14, r_i * cell_h + 14), f"{lbl} @ {ts:.1f}s", fill=(56, 189, 248))
        cs_path = qa_frames_dir / f"{video_path.stem}_contact_sheet.jpg"
        sheet.save(cs_path, format="JPEG", quality=90)
        contact_sheet_name = cs_path.name

    avg_luma = round(sum(frame_lumas) / len(frame_lumas), 1) if frame_lumas else None
    max_clip_pct = round(max(frame_clips), 2) if frame_clips else None
    if max_clip_pct is not None and max_clip_pct > 9.0:
        warnings.append(f"Vùng sáng bị cháy nhẹ ở vài khung ({max_clip_pct:.1f}% > 240); hãy giảm Brightness hoặc chọn Sony S-Cinetone / Dark Matte")

    report = {
        "video": str(video_path),
        "width": width,
        "height": height,
        "fps": fps,
        "duration_sec": round(duration, 2),
        "video_codec": v_codec,
        "audio_codec": a_codec,
        "mean_volume_db": mean_db,
        "max_volume_db": max_db,
        "mean_luma": avg_luma,
        "max_highlight_clip_pct": max_clip_pct,
        "long_silences_gt_1_5s": len(long_silences),
        "scene_frames": scene_frames,
        "contact_sheet": contact_sheet_name,
        "warnings": warnings,
        "passed": len(warnings) == 0,
    }
    report_path = proj_dir / "06_logs" / f"{project_name}.qa_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Kiểm tra QA bản render.")
    parser.add_argument("--project", required=True)
    parser.add_argument("--video", required=True)
    args = parser.parse_args()
    rep = run_qa_check(args.project, Path(args.video))
    print(json.dumps(rep, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
