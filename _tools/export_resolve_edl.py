"""Export EDL TSV to CMX3600 EDL compatible with DaVinci Resolve."""

from __future__ import annotations

import argparse
from pathlib import Path

from common import ensure_project, find_raw_videos
from edl_utils import read_edl


def sec_to_tc(seconds: float, fps: int = 30) -> str:
    total_frames = max(0, int(round(seconds * fps)))
    ff = total_frames % fps
    total_sec = total_frames // fps
    ss = total_sec % 60
    mm = (total_sec // 60) % 60
    hh = total_sec // 3600
    return f"{hh:02d}:{mm:02d}:{ss:02d}:{ff:02d}"


def export_cmx3600(
    project_name: str,
    edl_tsv_path: Path,
    out_edl_path: Path,
    fps: int = 30,
) -> Path:
    proj_dir = ensure_project(project_name)
    rows = [r for r in read_edl(edl_tsv_path) if r.keep == 1]

    raw_clips = find_raw_videos(proj_dir)
    clip_name = raw_clips[0].name if raw_clips else f"{project_name}.mp4"
    reel = "AX"

    lines = [
        f"TITLE: ANTHINH_{project_name.upper()}",
        "FCM: NON-DROP FRAME",
        "",
    ]

    rec_cursor = 0.0
    for idx, row in enumerate(rows, start=1):
        src_in = sec_to_tc(row.start, fps)
        src_out = sec_to_tc(row.end, fps)
        rec_in = sec_to_tc(rec_cursor, fps)
        rec_out = sec_to_tc(rec_cursor + row.duration, fps)
        rec_cursor += row.duration

        lines.append(f"{idx:03d}  {reel:<8s} V     C        {src_in} {src_out} {rec_in} {rec_out}")
        lines.append(f"* FROM CLIP NAME: {clip_name}")
        if row.text:
            lines.append(f"* COMMENT: [{row.label}] {row.text[:120]}")
        lines.append("")

    out_edl_path.parent.mkdir(parents=True, exist_ok=True)
    out_edl_path.write_text("\n".join(lines), encoding="utf-8")
    return out_edl_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Xuất file EDL CMX3600 cho DaVinci Resolve.")
    parser.add_argument("--project", required=True)
    parser.add_argument("--edl", default="", help="Đường dẫn EDL TSV đầu vào")
    parser.add_argument("--out", default="", help="Đường dẫn file .edl đầu ra")
    args = parser.parse_args()

    proj_dir = ensure_project(args.project)
    edl_path = Path(args.edl) if args.edl else (
        proj_dir / "03_working" / f"{args.project}.edl.final.tsv"
        if (proj_dir / "03_working" / f"{args.project}.edl.final.tsv").exists()
        else proj_dir / "03_working" / f"{args.project}.edl.tsv"
    )
    out_path = Path(args.out) if args.out else (proj_dir / "05_output" / "tiktok_9x16" / f"anthinh_{args.project}_v1.edl")
    res = export_cmx3600(args.project, edl_path, out_path)
    print(f"Đã xuất CMX3600 EDL: {res}")


if __name__ == "__main__":
    main()
