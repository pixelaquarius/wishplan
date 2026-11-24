"""Audit all 17 skills for /ra-soat-skill: line limits, versions, duplicates, and promotion candidates."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from common import AGENTS_DIR, TOOLS_DIR

SKILLS_DIR = AGENTS_DIR / "skills"
INDEX_PATH = TOOLS_DIR / "docs" / "SKILLS.md"


def _parse_frontmatter(text: str) -> dict[str, str]:
    m = re.match(r"^---\s*\n(.*?)\n---", text, flags=re.DOTALL)
    if not m:
        return {}
    data: dict[str, str] = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            data[k.strip()] = v.strip()
    return data


def _parse_index_versions() -> dict[str, str]:
    if not INDEX_PATH.exists():
        return {}
    versions: dict[str, str] = {}
    for line in INDEX_PATH.read_text(encoding="utf-8").splitlines():
        m = re.search(r"\[`([^`]+)`\].*?\|\s*`(\d+\.\d+\.\d+)`\s*\|", line)
        if m:
            versions[m.group(1)] = m.group(2)
    return versions


def audit_skills() -> dict[str, Any]:
    index_versions = _parse_index_versions()
    rows: list[dict[str, Any]] = []

    for skill_dir in sorted(p for p in SKILLS_DIR.iterdir() if p.is_dir()):
        skill_md = skill_dir / "SKILL.md"
        lessons_md = skill_dir / "references" / "lessons.md"
        changelog_md = skill_dir / "CHANGELOG.md"

        issues: list[str] = []
        if not skill_md.exists():
            issues.append("Thiếu SKILL.md")
            rows.append({"name": skill_dir.name, "issues": issues, "status": "ERROR"})
            continue

        txt = skill_md.read_text(encoding="utf-8")
        lines = len(txt.splitlines())
        chars = len(txt)
        fm = _parse_frontmatter(txt)
        ver = fm.get("version", "MISSING")

        if lines >= 150:
            issues.append(f"SKILL.md dài {lines} dòng (>=150)")
        if chars >= 12000:
            issues.append(f"SKILL.md dài {chars} ký tự (>=12000)")
        if not fm.get("name") or not fm.get("description"):
            issues.append("Thiếu name/description frontmatter")
        if index_versions.get(skill_dir.name) != ver:
            issues.append(f"Lệch version với SKILLS.md ({ver} vs {index_versions.get(skill_dir.name)})")
        if not lessons_md.exists():
            issues.append("Thiếu references/lessons.md")
        if not changelog_md.exists():
            issues.append("Thiếu CHANGELOG.md")

        lesson_entries: list[str] = []
        unverified_count = 0
        distinct_projects: set[str] = set()
        if lessons_md.exists():
            for line in lessons_md.read_text(encoding="utf-8").splitlines():
                s = line.strip()
                if s.startswith("- "):
                    lesson_entries.append(s)
                    if "giả thuyết ban đầu" in s.lower():
                        unverified_count += 1
                    parts = [p.strip() for p in s[2:].split("|")]
                    if len(parts) >= 2 and parts[1] not in ("Khởi tạo", ""):
                        distinct_projects.add(parts[1])

        # Kiểm tra trùng lặp ý gần giống nhau
        norm_entries = [re.sub(r"\W+", " ", e.lower()).strip() for e in lesson_entries]
        duplicate_count = len(norm_entries) - len(set(norm_entries))
        if duplicate_count > 0:
            issues.append(f"Có {duplicate_count} mục kinh nghiệm trùng lặp")

        promote_candidate = len(distinct_projects) >= 3
        if promote_candidate:
            issues.append(f"Đã có kinh nghiệm từ {len(distinct_projects)} dự án -> xem xét nâng thành quy tắc")

        rows.append({
            "name": skill_dir.name,
            "version": ver,
            "lines": lines,
            "chars": chars,
            "lessons_count": len(lesson_entries),
            "unverified_hypotheses": unverified_count,
            "distinct_projects": len(distinct_projects),
            "promote_candidate": promote_candidate,
            "issues": issues,
            "status": "WARN" if issues else "OK",
        })

    return {
        "total_skills": len(rows),
        "ok_count": sum(1 for r in rows if r["status"] == "OK"),
        "warn_count": sum(1 for r in rows if r["status"] != "OK"),
        "skills": rows,
    }


def format_report_md(report: dict[str, Any]) -> str:
    lines = [
        "# Báo cáo rà soát thư viện Skill (`/ra-soat-skill`)",
        "",
        f"Tổng số skill: **{report['total_skills']}** | Đạt chuẩn: **{report['ok_count']}** | Cần chú ý: **{report['warn_count']}**",
        "",
        "| Skill | Version | Dòng `SKILL.md` | Kinh nghiệm | Giả thuyết chưa kiểm chứng | Trạng thái | Ghi chú |",
        "|---|---|---|---|---|---|---|",
    ]
    for s in report["skills"]:
        notes = "; ".join(s["issues"]) if s["issues"] else "—"
        lines.append(
            f"| `{s['name']}` | `{s.get('version','?')}` | {s.get('lines','-')} | "
            f"{s.get('lessons_count',0)} | {s.get('unverified_hypotheses',0)} | {s['status']} | {notes} |"
        )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Kiểm tra tình trạng toàn bộ thư viện skill.")
    parser.add_argument("--format", choices=["md", "json"], default="md")
    args = parser.parse_args()
    rep = audit_skills()
    print(json.dumps(rep, ensure_ascii=False, indent=2) if args.format == "json" else format_report_md(rep))


if __name__ == "__main__":
    main()
