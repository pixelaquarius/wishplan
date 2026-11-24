"""Shared paths, project scaffolding, state management, and logging helpers."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import wave
from datetime import datetime
from pathlib import Path
from typing import Any

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

TOOLS_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = TOOLS_DIR.parent
PROJECTS_DIR = WORKSPACE_ROOT / "Projects"
TEMPLATE_DIR = PROJECTS_DIR / "Template"
STYLE_REFS_DIR = WORKSPACE_ROOT / "StyleRefs"
AGENTS_DIR = WORKSPACE_ROOT / ".agents"
PROMPTS_DIR = TOOLS_DIR / "prompts"
REMOTION_DIR = TOOLS_DIR / "remotion"

VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"}


def refresh_windows_path() -> None:
    """Ensure CLI tools (ffmpeg, ffprobe, git, uv, node) are visible on both Windows and macOS."""
    if os.name == "nt":
        try:
            import winreg

            paths = []
            for root, sub in [
                (winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"),
                (winreg.HKEY_CURRENT_USER, r"Environment"),
            ]:
                try:
                    with winreg.OpenKey(root, sub) as k:
                        val, _ = winreg.QueryValueEx(k, "Path")
                        if val:
                            paths.append(val)
                except OSError:
                    pass
            extra_win = [
                str(Path.home() / "AppData" / "Local" / "Microsoft" / "WinGet" / "Links"),
                r"C:\Program Files\nodejs",
                r"C:\Program Files\Git\cmd",
            ]
            paths.extend(p for p in extra_win if Path(p).exists())
            if paths:
                current = os.environ.get("PATH", "")
                os.environ["PATH"] = ";".join(paths) + ";" + current
        except Exception:
            pass
    else:
        # macOS (Apple Silicon Homebrew /opt/homebrew & Intel /usr/local) + Linux
        mac_paths = [
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            "/usr/local/sbin",
            str(Path.home() / ".local" / "bin"),
            str(Path.home() / ".cargo" / "bin"),
        ]
        nvm_dir = Path.home() / ".nvm" / "versions" / "node"
        if nvm_dir.exists():
            for p in sorted(nvm_dir.glob("*/bin"), reverse=True):
                mac_paths.append(str(p))
        existing = [p for p in mac_paths if Path(p).exists()]
        if existing:
            current = os.environ.get("PATH", "")
            os.environ["PATH"] = ":".join(existing) + ":" + current


def resolve_portable_path(proj_dir: Path, stored_path: str | Path, default_subdir: str = "03_working") -> Path:
    """Resolve a path saved on Windows or macOS even if the workspace moved across OSes."""
    raw_str = str(stored_path or "").strip()
    if not raw_str:
        return proj_dir / default_subdir
    cand = Path(raw_str)
    if cand.exists():
        return cand
    norm_name = Path(raw_str.replace("\\", "/")).name
    for sub in (default_subdir, "01_raw", "03_working", "04_assets/broll", "04_assets/music", "05_output/tiktok_9x16"):
        fallback = proj_dir / sub / norm_name
        if fallback.exists():
            return fallback
    return proj_dir / default_subdir / norm_name


def open_native_folder(target_path: Path, reveal_file: Path | None = None) -> bool:
    """Open folder (or reveal a specific file) in Windows Explorer or macOS Finder."""
    target_file = reveal_file if (reveal_file and reveal_file.exists() and reveal_file.is_file()) else None
    folder = target_file.parent if target_file else (target_path if target_path.is_dir() else target_path.parent)
    if not folder.exists():
        return False
    try:
        if os.name == "nt":
            if target_file:
                subprocess.Popen(["explorer.exe", f"/select,{target_file}"])
            else:
                subprocess.Popen(["explorer.exe", str(folder)])
        elif shutil.which("open"):
            if target_file:
                subprocess.Popen(["open", "-R", str(target_file)])
            else:
                subprocess.Popen(["open", str(folder)])
        elif shutil.which("xdg-open"):
            subprocess.Popen(["xdg-open", str(folder)])
        return True
    except Exception:
        return False


def ensure_project(project_name: str) -> Path:
    """Create or repair a project directory from Projects/Template."""
    import re

    clean_name = project_name.strip()
    if clean_name == "_demo" and (PROJECTS_DIR / "Demo").exists():
        clean_name = "Demo"
    if (
        not clean_name
        or clean_name.startswith(".")
        or "/" in clean_name
        or "\\" in clean_name
        or ".." in clean_name
        or not re.match(r"^[A-Za-z0-9À-ỹ _()-]{1,64}$", clean_name)
    ):
        raise ValueError(f"Tên dự án không hợp lệ: {project_name!r}")

    proj_dir = (PROJECTS_DIR / clean_name).resolve()
    if proj_dir.parent != PROJECTS_DIR.resolve():
        raise ValueError(f"Đường dẫn dự án vượt ngoài phạm vi cho phép: {project_name!r}")
    proj_dir.mkdir(parents=True, exist_ok=True)
    if TEMPLATE_DIR.exists():
        for src in TEMPLATE_DIR.rglob("*"):
            rel = src.relative_to(TEMPLATE_DIR)
            dst = proj_dir / rel
            if src.is_dir():
                dst.mkdir(parents=True, exist_ok=True)
            elif src.name != ".gitkeep" and not dst.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
    return proj_dir


def list_projects() -> list[str]:
    """Return sorted project folder names excluding Template."""
    if not PROJECTS_DIR.exists():
        return []
    return sorted(
        p.name for p in PROJECTS_DIR.iterdir()
        if p.is_dir() and p.name not in ("_template", "Template") and not p.name.startswith(".")
    )


def find_raw_videos(project_dir: Path) -> list[Path]:
    """Return sorted raw video files inside 01_raw/."""
    raw_dir = project_dir / "01_raw"
    if not raw_dir.exists():
        return []
    return sorted(
        p for p in raw_dir.iterdir()
        if p.is_file() and p.suffix.lower() in VIDEO_EXTS
    )


def sha256_file(path: Path) -> str:
    """Compute SHA-256 hex digest for a file."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_text(text: str) -> str:
    """Compute SHA-256 hex digest for text."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def state_path(project_dir: Path, project_name: str) -> Path:
    return project_dir / "03_working" / f"{project_name}.state.json"


def load_state(project_dir: Path, project_name: str) -> dict[str, Any]:
    path = state_path(project_dir, project_name)
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {"project": project_name, "steps": {}}


def save_state(project_dir: Path, project_name: str, state: dict[str, Any]) -> None:
    path = state_path(project_dir, project_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    state["updated_at"] = datetime.now().isoformat(timespec="seconds")
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def append_log(
    project_dir: Path,
    stage: str,
    command: str,
    details: dict[str, Any] | None = None,
) -> None:
    """Append human-readable log and JSONL record into 06_logs/."""
    logs_dir = project_dir / "06_logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().isoformat(timespec="seconds")
    record = {
        "timestamp": ts,
        "stage": stage,
        "command": command,
        "details": details or {},
    }
    with (logs_dir / "runs.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

    line = f"[{ts}] [{stage}] {command}"
    if details:
        line += " | " + json.dumps(details, ensure_ascii=False)
    with (logs_dir / "pipeline.log").open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def ffprobe_json(media_path: Path) -> dict[str, Any]:
    """Run ffprobe and return parsed JSON metadata."""
    cmd = [
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(media_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, encoding="utf-8")
    return json.loads(res.stdout)


def parse_ratio(rate_str: str | None) -> float:
    """Parse rational frame rate strings like '30000/1001' or '30/1'."""
    if not rate_str or rate_str == "0/0":
        return 0.0
    if "/" in rate_str:
        num, den = rate_str.split("/", 1)
        d = float(den)
        return float(num) / d if d else 0.0
    return float(rate_str)


def slugify_vi(text: str) -> str:
    """Convert Vietnamese text into clean ASCII filename Base (legacy helper)."""
    import unicodedata
    import re

    replacements = str.maketrans("đĐ", "dD")
    norm = unicodedata.normalize("NFKD", text.translate(replacements))
    ascii_str = "".join(ch for ch in norm if not unicodedata.combining(ch))
    slug = re.sub(r"[^a-zA-Z0-9]+", " ", ascii_str).strip()
    return slug or "Video"


def sanitize_natural_filename(text: str, fallback: str = "Video WishEdit") -> str:
    """Clean a user-provided or suggested filename without forcing hyphens or personal prefixes."""
    import re

    raw = str(text or "").strip()
    # Strip legacy prefixes/extensions if user or old config passed them
    raw = re.sub(r"\.(mp4|mov|edl|png|jpg)$", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"^anthinh[_\s-]+", "", raw, flags=re.IGNORECASE)
    if raw in ("", "_demo", "demo", "Demo", "tim-ugc-mien-phi"):
        return fallback
    # If input looks like an old hyphenated slug ("tim-ugc-mien-phi"), turn hyphens into natural spaces
    if "-" in raw and " " not in raw:
        raw = raw.replace("-", " ").replace("_", " ").strip()
    # Remove only illegal OS filename characters
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', " ", raw)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ._")
    return cleaned[:90] if cleaned else fallback



def load_wav_16k_float32(wav_path: Path):
    """Read 16kHz mono PCM16 WAV into float32 numpy array (bypasses PyAV version issues)."""
    import numpy as np

    with wave.open(str(wav_path), "rb") as wf:
        if wf.getnchannels() != 1 or wf.getframerate() != 16000 or wf.getsampwidth() != 2:
            raise ValueError(f"WAV phải là 16kHz mono 16-bit: {wav_path}")
        raw = wf.readframes(wf.getnframes())
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
