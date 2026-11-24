"""Compare <project>.edl.ai.tsv vs <project>.edl.final.tsv purely by code for /cap-nhat-skill."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from common import ensure_project
from edl_utils import EdlRow, read_edl


def _row_key(r: EdlRow) -> tuple[float, float]:
    return (round(r.start, 2), round(r.end, 2))


def _match_ai_to_final(ai_rows: list[EdlRow], final_rows: list[EdlRow]) -> dict[str, Any]:
    """Match rows by overlapping time intervals or identical text."""
    used_final: set[int] = set()
    matches: list[tuple[int, int]] = []

    for i, a in enumerate(ai_rows):
        best_j = -1
        best_score = 0.0
        for j, f in enumerate(final_rows):
            if j in used_final:
                continue
            ov = min(a.end, f.end) - max(a.start, f.start)
            if ov > 0:
                score = ov / max(0.1, max(a.end - a.start, f.end - f.start))
            elif a.text and a.text == f.text:
                score = 0.85
            else:
                score = 0.0
            if score > best_score:
                best_score = score
                best_j = j
        if best_j >= 0 and best_score >= 0.35:
            used_final.add(best_j)
            matches.append((i, best_j))

    re_enabled: list[dict[str, Any]] = []
    disabled: list[dict[str, Any]] = []
    trimmed: list[dict[str, Any]] = []
    reordered: list[dict[str, Any]] = []
    label_or_text_edited: list[dict[str, Any]] = []
    notes: list[dict[str, Any]] = []

    kept_order_ai = [i for i, r in enumerate(ai_rows) if r.keep == 1]
    kept_order_final = [j for j, r in enumerate(final_rows) if r.keep == 1]
    ai_kept_pos = {idx: pos for pos, idx in enumerate(kept_order_ai)}
    final_kept_pos = {idx: pos for pos, idx in enumerate(kept_order_final)}

    # Check relative order inversions among matched kept segments
    kept_pairs = [(i, j) for (i, j) in matches if ai_rows[i].keep == 1 and final_rows[j].keep == 1]
    for p_idx, (i, j) in enumerate(kept_pairs):
        for i2, j2 in kept_pairs[p_idx + 1:]:
            if (ai_kept_pos[i] < ai_kept_pos[i2] and final_kept_pos[j] > final_kept_pos[j2]) or (
                ai_kept_pos[i] > ai_kept_pos[i2] and final_kept_pos[j] < final_kept_pos[j2]
            ):
                reordered.append({
                    "segment": final_rows[j].text,
                    "ai_pos": ai_kept_pos[i] + 1,
                    "final_pos": final_kept_pos[j] + 1,
                    "time": f"{final_rows[j].start:.2f}-{final_rows[j].end:.2f}s",
                })
                break

    for i, j in matches:
        a = ai_rows[i]
        f = final_rows[j]
        if a.keep == 0 and f.keep == 1:
            re_enabled.append({"start": f.start, "end": f.end, "text": f.text, "note": f.note})
        elif a.keep == 1 and f.keep == 0:
            disabled.append({"start": f.start, "end": f.end, "text": f.text, "note": f.note})

        d_start = round(f.start - a.start, 3)
        d_end = round(f.end - a.end, 3)
        if abs(d_start) >= 0.05 or abs(d_end) >= 0.05:
            trimmed.append({
                "text": f.text,
                "ai_range": f"{a.start:.2f}-{a.end:.2f}s",
                "final_range": f"{f.start:.2f}-{f.end:.2f}s",
                "delta_start": d_start,
                "delta_end": d_end,
            })

        if a.label != f.label or a.text != f.text:
            label_or_text_edited.append({
                "time": f"{f.start:.2f}-{f.end:.2f}s",
                "ai_label": a.label,
                "final_label": f.label,
                "ai_text": a.text,
                "final_text": f.text,
            })

        if f.note.strip() and f.note.strip() != a.note.strip():
            notes.append({
                "time": f"{f.start:.2f}-{f.end:.2f}s",
                "keep": f.keep,
                "text": f.text,
                "note": f.note.strip(),
            })

    matched_final_idx = {j for _, j in matches}
    added_rows = [
        {"start": final_rows[j].start, "end": final_rows[j].end, "text": final_rows[j].text, "note": final_rows[j].note}
        for j in range(len(final_rows))
        if j not in matched_final_idx
    ]
    for j in range(len(final_rows)):
        if j not in matched_final_idx and final_rows[j].note.strip():
            notes.append({
                "time": f"{final_rows[j].start:.2f}-{final_rows[j].end:.2f}s",
                "keep": final_rows[j].keep,
                "text": final_rows[j].text,
                "note": final_rows[j].note.strip(),
            })

    return {
        "re_enabled": re_enabled,
        "disabled": disabled,
        "reordered": reordered,
        "trimmed": trimmed,
        "label_or_text_edited": label_or_text_edited,
        "added_rows": added_rows,
        "notes": notes,
        "total_changes": (
            len(re_enabled) + len(disabled) + len(reordered)
            + len(trimmed) + len(label_or_text_edited) + len(added_rows) + len(notes)
        ),
    }


def format_diff_markdown(project_name: str, diff: dict[str, Any]) -> str:
    lines = [
        f"# EDL Diff — Dự án `{project_name}`",
        "",
        f"Tổng số thay đổi phát hiện: **{diff['total_changes']}**",
        "",
        "| Loại thay đổi | Số lượng | Chi tiết |",
        "|---|---|---|",
        f"| Bật lại (AI tắt -> Bạn bật) | {len(diff['re_enabled'])} | "
        + ("; ".join(f"[{x['start']:.1f}-{x['end']:.1f}s] {x['text']}" for x in diff["re_enabled"]) or "—")
        + " |",
        f"| Tắt đi (AI giữ -> Bạn tắt) | {len(diff['disabled'])} | "
        + ("; ".join(f"[{x['start']:.1f}-{x['end']:.1f}s] {x['text']}" for x in diff["disabled"]) or "—")
        + " |",
        f"| Đổi thứ tự cảnh | {len(diff['reordered'])} | "
        + ("; ".join(f"#{x['ai_pos']}->#{x['final_pos']} ({x['time']}) {x['segment']}" for x in diff["reordered"]) or "—")
        + " |",
        f"| Chỉnh thời lượng (>=0.05s) | {len(diff['trimmed'])} | "
        + ("; ".join(f"{x['ai_range']} -> {x['final_range']} ({x['text']})" for x in diff["trimmed"]) or "—")
        + " |",
        f"| Sửa nhãn / phụ đề | {len(diff['label_or_text_edited'])} | "
        + ("; ".join(f"[{x['time']}] {x['ai_label']}->{x['final_label']}" for x in diff["label_or_text_edited"]) or "—")
        + " |",
        f"| Ghi chú mới (`note`) | {len(diff['notes'])} | "
        + ("; ".join(f"[{x['time']}] {x['note']}" for x in diff["notes"]) or "—")
        + " |",
    ]
    return "\n".join(lines)


def diff_project(project_name: str) -> dict[str, Any]:
    proj_dir = ensure_project(project_name)
    ai_path = proj_dir / "03_working" / f"{project_name}.edl.ai.tsv"
    final_path = proj_dir / "03_working" / f"{project_name}.edl.final.tsv"
    if not final_path.exists():
        final_path = proj_dir / "03_working" / f"{project_name}.edl.tsv"
    if not ai_path.exists():
        raise FileNotFoundError(f"Chưa có {ai_path}")
    if not final_path.exists():
        raise FileNotFoundError(f"Chưa có {final_path}")

    ai_rows = read_edl(ai_path)
    final_rows = read_edl(final_path)
    diff = _match_ai_to_final(ai_rows, final_rows)
    diff["ai_file"] = str(ai_path)
    diff["final_file"] = str(final_path)

    out_json = proj_dir / "03_working" / f"{project_name}.edl_diff.json"
    out_md = proj_dir / "06_logs" / f"{project_name}.edl_diff.md"
    out_json.write_text(json.dumps(diff, ensure_ascii=False, indent=2), encoding="utf-8")
    out_md.write_text(format_diff_markdown(project_name, diff), encoding="utf-8")
    return diff


def main() -> None:
    parser = argparse.ArgumentParser(description="So sánh .edl.ai.tsv và .edl.final.tsv.")
    parser.add_argument("--project", required=True)
    parser.add_argument("--format", choices=["md", "json"], default="md")
    args = parser.parse_args()
    diff = diff_project(args.project)
    if args.format == "json":
        print(json.dumps(diff, ensure_ascii=False, indent=2))
    else:
        print(format_diff_markdown(args.project, diff))


if __name__ == "__main__":
    main()
