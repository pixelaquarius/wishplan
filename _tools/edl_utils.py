"""Read, write, validate, and summarize EDL TSV files."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

EDL_COLUMNS = ["keep", "start", "end", "label", "text", "note"]


@dataclass
class EdlRow:
    keep: int
    start: float
    end: float
    label: str
    text: str
    note: str = ""

    @property
    def duration(self) -> float:
        return max(0.0, round(self.end - self.start, 3))

    def to_dict(self) -> dict:
        return {
            "keep": self.keep,
            "start": round(self.start, 3),
            "end": round(self.end, 3),
            "duration": self.duration,
            "label": self.label,
            "text": self.text,
            "note": self.note,
        }


def sanitize_cell(value: str) -> str:
    """Prevent embedded tabs or newlines from breaking TSV structure."""
    return " ".join(str(value or "").replace("\t", " ").splitlines()).strip()


def read_edl(path: Path) -> list[EdlRow]:
    """Read a 6-column TSV EDL file into EdlRow items."""
    if not path.exists():
        return []
    rows: list[EdlRow] = []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for raw in reader:
            if not raw:
                continue
            try:
                keep = int(str(raw.get("keep", "1")).strip() or "1")
                start = float(str(raw.get("start", "0")).strip())
                end = float(str(raw.get("end", "0")).strip())
            except ValueError:
                continue
            if end <= start:
                continue
            rows.append(
                EdlRow(
                    keep=1 if keep else 0,
                    start=round(start, 3),
                    end=round(end, 3),
                    label=sanitize_cell(raw.get("label", "main")) or "main",
                    text=sanitize_cell(raw.get("text", "")),
                    note=sanitize_cell(raw.get("note", "")),
                )
            )
    return rows


def write_edl(path: Path, rows: Iterable[EdlRow]) -> Path:
    """Write EdlRow items to a 6-column UTF-8 TSV file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerow(EDL_COLUMNS)
        for r in rows:
            writer.writerow([
                1 if r.keep else 0,
                f"{r.start:.3f}",
                f"{r.end:.3f}",
                sanitize_cell(r.label) or "main",
                sanitize_cell(r.text),
                sanitize_cell(r.note),
            ])
    return path


def edl_summary(rows: list[EdlRow]) -> dict:
    """Compute counts and total kept duration for UI and logs."""
    kept = [r for r in rows if r.keep == 1]
    noted = [r for r in rows if r.note.strip()]
    return {
        "total_rows": len(rows),
        "kept_rows": len(kept),
        "dropped_rows": len(rows) - len(kept),
        "kept_duration": round(sum(r.duration for r in kept), 2),
        "noted_rows": len(noted),
    }
