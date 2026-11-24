"""FastAPI storyboard review & render server bound to 127.0.0.1:8000."""

from __future__ import annotations

import json
import mimetypes
import re
import shutil
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

SERVER_DIR = Path(__file__).resolve().parent
TOOLS_DIR = SERVER_DIR.parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from ai_client import (
    _call_external_llm,
    _has_external_llm_key,
    analyze_content_and_source_gaps,
    call_ai_cached,
    distill_clean_hook_title,
    get_ai_status,
    is_hard_traffic_or_policy_violation,
    load_project_brief,
    load_prompt_preset,
    sanitize_traffic_and_policy_text,
    save_ai_config,
    save_project_brief,
    scan_watchlist,
    smart_local_claims_rewrite,
    smart_local_structure,
)
from auto_fill import (
    AVAILABLE_TTS_VOICES,
    auto_enhance_project,
    extract_speaker_ref_wav,
    generate_tts_voiceover,
)
from color_engine import analyze_video_color_and_luts, default_color_config, ensure_cube_lut_file
from common import (
    AGENTS_DIR,
    AUDIO_EXTS,
    IMAGE_EXTS,
    PROMPTS_DIR,
    STYLE_REFS_DIR,
    VIDEO_EXTS,
    append_log,
    ensure_project,
    ffprobe_json,
    find_raw_videos,
    list_projects,
    load_state,
    open_native_folder,
    refresh_windows_path,
    resolve_portable_path,
)
from edl_diff import diff_project
from edl_utils import EdlRow, edl_summary, read_edl, write_edl
from hardware import detect_hardware_profile, get_power_settings, save_power_settings
from pipeline import _clean_vi_asr_text, run_pipeline
from remotion_props import build_props_and_layers
from render_edl import render_project
from style_extract import analyze_style_refs

refresh_windows_path()

app = FastAPI(title="WishEdit — AI & Timeline Video Studio", version="3.0.0")
STATIC_DIR = SERVER_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

ALLOWED_UPLOAD_EXTS: dict[str, set[str]] = {
    "raw": VIDEO_EXTS,
    "broll": VIDEO_EXTS | IMAGE_EXTS,
    "music": AUDIO_EXTS,
    "sfx": AUDIO_EXTS,
    "lut": {".cube", ".3dl"},
    "style_ref": VIDEO_EXTS,
}


def _sanitize_media_filename(raw_filename: str, allowed_exts: set[str] | None = None) -> str:
    """Validate and sanitize a media filename against path traversal and executable upload attacks."""
    name = Path(str(raw_filename or "").replace("\\", "/")).name.strip()
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", name)
    if not name or name in (".", "..") or name.startswith("."):
        raise HTTPException(400, "Tên file không hợp lệ.")
    ext = Path(name).suffix.lower()
    if allowed_exts is not None and ext not in allowed_exts:
        raise HTTPException(400, f"Định dạng file '{ext}' không nằm trong danh sách cho phép.")
    return name


def _validate_webhook_url(raw_url: str) -> str:
    """Block SSRF against loopback, link-local metadata (169.254.169.254), and non-HTTP schemes."""
    from urllib.parse import urlparse

    u = str(raw_url or "").strip()
    if not u:
        return ""
    parsed = urlparse(u)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(400, "Webhook URL phải bắt đầu bằng http:// hoặc https://")
    host = parsed.hostname.lower()
    blocked_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254", "metadata.google.internal"}
    if host in blocked_hosts or host.startswith("169.254.") or host.startswith("127."):
        raise HTTPException(400, "Webhook URL không được trỏ tới địa chỉ loopback hoặc cloud metadata nội bộ.")
    return u


@app.middleware("http")
async def _security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), payment=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self' https://cdn.tailwindcss.com https://fonts.googleapis.com https://fonts.gstatic.com; "
        "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "img-src 'self' data: blob:; "
        "media-src 'self' data: blob:; "
        "font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self';"
    )
    return response

JOBS: dict[str, dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()


class CreateProjectReq(BaseModel):
    name: str
    brief_text: str = ""
    auto_broll: bool = False


class ColorSyncReq(BaseModel):
    color: dict[str, Any]
    apply_to_all: bool = True


class RunPipelineReq(BaseModel):
    whisper_model: str = "small"
    target_duration: float = 0.0
    force_ai: bool = False
    preset: str = "retake_select"


class SaveEdlReq(BaseModel):
    rows: list[dict[str, Any]]
    mark_final: bool = True


class SaveLayersReq(BaseModel):
    layers: dict[str, Any]


class SaveBriefReq(BaseModel):
    text: str
    filename: str = "brief.md"


class AiRestructureReq(BaseModel):
    preset: str = "retake_select"
    only_noted: bool = False
    target_duration: float = 0.0


class AiConfigReq(BaseModel):
    gemini_api_key: str = ""
    openai_api_key: str = ""
    model: str = ""
    base_url: str = ""
    clear_keys: bool = False


class AiBridgeApplyReq(BaseModel):
    raw_json: str
    preset: str = "retake_select"


class RenderReq(BaseModel):
    topic: str = ""
    overwrite: bool = False
    other_platforms: bool = False
    render_engine: str = "remotion"


class AutoEditReq(BaseModel):
    whisper_model: str = "small"
    target_duration: float = 0.0
    preset: str = "retake_select"
    topic: str = ""
    render_engine: str = "remotion"
    other_platforms: bool = False
    auto_color: bool = True
    auto_broll: bool = True
    broll_count: int = 3
    extract_demo_broll: bool = True
    dynamic_zoom: bool = True
    ensure_music: bool = True
    render_after: bool = True


class DropRawTimelineReq(BaseModel):
    filename: str = ""
    at_sec: float = 0.0


class AutoFillReq(BaseModel):
    fetch_logos: bool = False
    generate_broll: bool = True
    broll_count: int = 3
    extract_demo_broll: bool = True
    ensure_music: bool = True
    tts_text: str = ""
    tts_at_sec: float = 0.0
    tts_voice: str = "vi-VN-NamMinhNeural"


class AiChatReq(BaseModel):
    message: str
    clear_history: bool = False


class TtsGenerateReq(BaseModel):
    text: str = ""
    voice: str = "vi-VN-NamMinhNeural"
    rate: str = "+12%"
    at_sec: float = 0.0
    export_speaker_ref: bool = False


class PowerSettingsReq(BaseModel):
    power_mode: str = "auto"
    lan_access: bool = True
    remote_webhook_url: str = ""
    prefer_native_window: bool = True


def _update_job_progress_from_line(job: dict[str, Any], line: str) -> None:
    job["step_label"] = line[:120]
    m_rem = re.search(r"Remotion:\s*(\d+)%", line)
    if m_rem:
        sub_pct = int(m_rem.group(1))
        job["progress_pct"] = min(92, 48 + int(sub_pct * 0.42))
        return
    m_render = re.search(r"\[Render\s+(\d+)(?:-\d+)?/(\d+)\]", line)
    if m_render:
        step_i, tot = int(m_render.group(1)), max(1, int(m_render.group(2)))
        pct_map = {1: 10, 2: 24, 3: 42, 4: 58, 5: 88}
        job["progress_pct"] = max(int(job.get("progress_pct", 0)), pct_map.get(step_i, int(step_i * 90 / tot)))
        return
    if "[Render QA]" in line:
        job["progress_pct"] = 96
        return
    m_auto = re.search(r"\[Auto AI Edit\s+(\d+)/(\d+)\]", line)
    if m_auto:
        step_i, tot = int(m_auto.group(1)), max(1, int(m_auto.group(2)))
        job["progress_pct"] = max(int(job.get("progress_pct", 0)), int((step_i - 0.5) * 90 / tot))
        return
    if "[Bước 1a/" in line:
        job["progress_pct"] = max(int(job.get("progress_pct", 0)), 15)
    elif "[Bước 1b/" in line:
        job["progress_pct"] = max(int(job.get("progress_pct", 0)), 32)
    elif "[Bước 2/" in line:
        job["progress_pct"] = max(int(job.get("progress_pct", 0)), 65)
    elif "[Bước 3/" in line:
        job["progress_pct"] = max(int(job.get("progress_pct", 0)), 82)
    elif "[Style Ref" in line:
        m_st = re.search(r"(\d+)/(\d+)", line)
        if m_st:
            job["progress_pct"] = max(10, min(95, int(int(m_st.group(1)) * 90 / max(1, int(m_st.group(2))))))


def _start_job(project: str, kind: str, fn) -> str:
    job_id = uuid.uuid4().hex[:10]
    started_at = time.time()
    with JOBS_LOCK:
        JOBS[job_id] = {
            "id": job_id,
            "project": project,
            "kind": kind,
            "status": "running",
            "progress_pct": 5,
            "step_label": f"Đang khởi tạo {kind}...",
            "started_at": started_at,
            "elapsed_sec": 0.0,
            "logs": [f"[{time.strftime('%H:%M:%S')}] Bắt đầu tác vụ {kind}..."],
            "result": None,
            "error": None,
        }

    def runner() -> None:
        class LogCapture:
            def write(self, msg: str) -> int:
                for line in msg.splitlines():
                    if line.strip():
                        with JOBS_LOCK:
                            JOBS[job_id]["logs"].append(line)
                            JOBS[job_id]["elapsed_sec"] = round(time.time() - started_at, 1)
                            _update_job_progress_from_line(JOBS[job_id], line)
                return len(msg)

            def flush(self) -> None:
                pass

        old_stdout = sys.stdout
        sys.stdout = LogCapture()  # type: ignore[assignment]
        try:
            res = fn()
            with JOBS_LOCK:
                JOBS[job_id]["status"] = "done"
                JOBS[job_id]["progress_pct"] = 100
                JOBS[job_id]["step_label"] = "Hoàn tất!"
                JOBS[job_id]["elapsed_sec"] = round(time.time() - started_at, 1)
                JOBS[job_id]["result"] = res
                JOBS[job_id]["logs"].append(f"[{time.strftime('%H:%M:%S')}] Hoàn tất {kind}.")
        except Exception as exc:
            with JOBS_LOCK:
                JOBS[job_id]["status"] = "error"
                JOBS[job_id]["step_label"] = f"Lỗi: {exc}"
                JOBS[job_id]["elapsed_sec"] = round(time.time() - started_at, 1)
                JOBS[job_id]["error"] = str(exc)
                JOBS[job_id]["logs"].append(f"[LỖI] {exc}")
        finally:
            sys.stdout = old_stdout

    threading.Thread(target=runner, daemon=True).start()
    return job_id


def _range_video_response(file_path: Path, request: Request) -> StreamingResponse | FileResponse:
    if not file_path.exists():
        raise HTTPException(404, f"Không thấy file {file_path.name}")
    file_size = file_path.stat().st_size
    ext = file_path.suffix.lower()
    mime, _ = mimetypes.guess_type(str(file_path))
    if ext == ".mov":
        ua = (request.headers.get("user-agent") or "").lower()
        is_safari_only = "safari" in ua and "chrome" not in ua and "chromium" not in ua and "edg" not in ua
        media_type = "video/quicktime" if is_safari_only else "video/mp4"
    elif ext == ".mkv":
        media_type = "video/x-matroska"
    else:
        media_type = mime or "video/mp4"
    range_header = request.headers.get("range")
    if not range_header:
        return FileResponse(str(file_path), media_type=media_type)

    m = re.match(r"bytes=(\d+)-(\d*)", range_header)
    if not m:
        return FileResponse(str(file_path), media_type=media_type)
    start = int(m.group(1))
    end = int(m.group(2)) if m.group(2) else file_size - 1
    end = min(end, file_size - 1)
    if start > end or start >= file_size:
        raise HTTPException(416, "Invalid Range")
    chunk_len = end - start + 1

    def iter_file():
        with file_path.open("rb") as f:
            f.seek(start)
            remaining = chunk_len
            while remaining > 0:
                data = f.read(min(65536, remaining))
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_len),
    }
    return StreamingResponse(iter_file(), status_code=206, headers=headers, media_type=media_type)


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    html_file = STATIC_DIR / "index.html"
    return HTMLResponse(html_file.read_text(encoding="utf-8"))


@app.get("/favicon.ico")
def favicon_ico() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "favicon.ico"), media_type="image/x-icon")


@app.get("/favicon.svg")
def favicon_svg() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "favicon.svg"), media_type="image/svg+xml")


@app.get("/api/projects")
def api_list_projects() -> dict[str, Any]:
    names = list_projects()
    cards: list[dict[str, Any]] = []
    for pname in names:
        try:
            pdir = ensure_project(pname)
            raws = find_raw_videos(pdir)
            outs = sorted((pdir / "05_output" / "tiktok_9x16").glob("*.mp4")) if (pdir / "05_output" / "tiktok_9x16").exists() else []
            edl_p = pdir / "03_working" / f"{pname}.edl.tsv"
            dur_sec = 0.0
            if edl_p.exists():
                rows = read_edl(edl_p)
                dur_sec = round(sum(r.duration for r in rows if r.keep == 1), 1)
            total_bytes = sum(f.stat().st_size for f in raws if f.exists()) + sum(f.stat().st_size for f in outs if f.exists())
            size_mb = round(total_bytes / (1024 * 1024), 1)
            thumb_url = ""
            if outs:
                thumb_url = f"/api/projects/{pname}/thumbnail?kind=output&filename={outs[-1].name}"
            elif raws:
                thumb_url = f"/api/projects/{pname}/thumbnail?kind=raw&filename={raws[0].name}"
            cards.append({
                "name": pname,
                "duration_sec": dur_sec,
                "size_mb": size_mb,
                "raw_count": len(raws),
                "output_count": len(outs),
                "thumbnail_url": thumb_url,
                "updated_at": int(pdir.stat().st_mtime),
            })
        except Exception:
            cards.append({"name": pname, "duration_sec": 0.0, "size_mb": 0.0, "raw_count": 0, "output_count": 0, "thumbnail_url": "", "updated_at": 0})
    return {"projects": names, "project_cards": cards}


@app.post("/api/projects")
def api_create_project(req: CreateProjectReq) -> dict[str, Any]:
    proj_dir = ensure_project(req.name)
    if req.brief_text.strip():
        save_project_brief(proj_dir, req.brief_text.strip(), filename="brief.md")
    layers_path = proj_dir / "03_working" / f"{proj_dir.name}.layers.json"
    if not layers_path.exists():
        init_layers = {
            "project": proj_dir.name,
            "fps": 30,
            "durationInFrames": 150,
            "durationSec": 5.0,
            "video": {"enableSubtleZoom": True, "speechSpeed": 1.08, "preserveNativeResolution": False, "watermarkHandle": "", "videoScale": 1.0, "videoOffsetX": 0.0, "videoOffsetY": 0.0},
            "hook": {"enabled": True, "eyebrow": "REVIEW THỰC TẾ", "title": "", "startFrame": 0, "endFrame": 90},
            "style": {"accentColor": "#38BDF8", "numberColor": "#FACC15", "captionColor": "#FFFFFF", "captionFontSize": 52, "captionBottomPx": 320, "hookTopPx": 88, "enableSubtleZoom": True, "stylePreset": "editorial", "videoScale": 1.0, "videoOffsetX": 0.0, "videoOffsetY": 0.0},
            "color": default_color_config(),
            "autoBrollEnabled": bool(req.auto_broll),
            "captions": [],
            "infoCards": [],
            "darkScenes": [],
            "broll": [],
            "logoBadges": [],
            "voiceoverEvents": [],
            "markers": [],
            "audio": {"normalizeSpeech": True, "denoiseSpeech": True, "musicFile": "", "musicDb": -22.0, "enableSfx": True, "sfxDb": -16.0},
        }
        layers_path.write_text(json.dumps(init_layers, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "ok": True,
        "project": proj_dir.name,
        "name": proj_dir.name,
        "project_dir": f"Projects/{proj_dir.name}",
    }


@app.get("/api/prompts")
def api_list_prompts() -> dict[str, Any]:
    prompts = []
    if PROMPTS_DIR.exists():
        for p in sorted(PROMPTS_DIR.glob("*.md")):
            prompts.append({
                "id": p.stem,
                "filename": p.name,
                "content": p.read_text(encoding="utf-8"),
            })
    return {"prompts": prompts}


@app.get("/api/jobs/{job_id}")
def api_job_status(job_id: str) -> dict[str, Any]:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            raise HTTPException(404, "Không tìm thấy job")
        snap = dict(job)
        if snap.get("status") == "running" and snap.get("started_at"):
            snap["elapsed_sec"] = round(time.time() - float(snap["started_at"]), 1)
        return snap


@app.get("/api/projects/{name}/overview")
def api_project_overview(name: str) -> dict[str, Any]:
    proj_dir = ensure_project(name)
    raw_files = [p.name for p in find_raw_videos(proj_dir)]
    state = load_state(proj_dir, name)

    edl_work = proj_dir / "03_working" / f"{name}.edl.tsv"
    edl_final = proj_dir / "03_working" / f"{name}.edl.final.tsv"
    active_edl = edl_work if edl_work.exists() else edl_final
    rows = read_edl(active_edl) if active_edl.exists() else []
    watchlist_hits = scan_watchlist(rows, only_kept=True) if rows else []

    layers_path = proj_dir / "03_working" / f"{name}.layers.json"
    layers = json.loads(layers_path.read_text(encoding="utf-8")) if layers_path.exists() else None
    if layers is None and rows:
        build_props_and_layers(name, edl_path=active_edl, preserve_user_layers=False)
        layers = json.loads(layers_path.read_text(encoding="utf-8"))

    broll_files = sorted(
        p.name for p in (proj_dir / "04_assets" / "broll").iterdir()
        if p.is_file() and p.suffix.lower() in (IMAGE_EXTS | VIDEO_EXTS)
    ) if (proj_dir / "04_assets" / "broll").exists() else []

    music_files = sorted(
        p.name for p in (proj_dir / "04_assets" / "music").iterdir()
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS
    ) if (proj_dir / "04_assets" / "music").exists() else []

    sfx_files = sorted(
        p.name for p in (proj_dir / "04_assets" / "sfx").iterdir()
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS
    ) if (proj_dir / "04_assets" / "sfx").exists() else []

    lut_files = sorted(
        p.name for p in (proj_dir / "04_assets" / "luts").iterdir()
        if p.is_file() and p.suffix.lower() in {".cube", ".3dl"}
    ) if (proj_dir / "04_assets" / "luts").exists() else []

    outputs = sorted(
        p.name for p in (proj_dir / "05_output" / "tiktok_9x16").glob("*.mp4")
    ) if (proj_dir / "05_output" / "tiktok_9x16").exists() else []

    log_file = proj_dir / "06_logs" / "pipeline.log"
    logs_tail = log_file.read_text(encoding="utf-8").splitlines()[-40:] if log_file.exists() else []

    ingest_path = proj_dir / "03_working" / f"{name}.ingest.json"
    has_source_video = bool(raw_files) or ingest_path.exists()

    props_path = proj_dir / "03_working" / f"{name}.remotion_props.json"
    props_data = json.loads(props_path.read_text(encoding="utf-8")) if props_path.exists() else None
    if props_data is None and rows:
        props_data = build_props_and_layers(name, edl_path=active_edl, preserve_user_layers=True)

    qa_path = proj_dir / "06_logs" / f"{name}.qa_report.json"
    qa_report = json.loads(qa_path.read_text(encoding="utf-8")) if qa_path.exists() else None
    brief_data = load_project_brief(proj_dir)
    gaps_report = analyze_content_and_source_gaps(proj_dir, rows, props=props_data, brief_data=brief_data) if rows else None
    color_analysis = analyze_video_color_and_luts(name, force=False)
    chat_path = proj_dir / "03_working" / f"{name}.chat_history.json"
    chat_history: list[dict[str, Any]] = []
    if chat_path.exists():
        try:
            chat_history = json.loads(chat_path.read_text(encoding="utf-8"))
        except Exception:
            chat_history = []

    return {
        "project": name,
        "project_dir": f"Projects/{proj_dir.name}",
        "raw_files": raw_files,
        "has_source_video": has_source_video,
        "state": state,
        "brief": brief_data,
        "gaps_report": gaps_report,
        "color_analysis": color_analysis,
        "edl_rows": [r.to_dict() for r in rows],
        "edl_summary": edl_summary(rows),
        "watchlist_hits": watchlist_hits,
        "layers": layers,
        "props": props_data,
        "qa_report": qa_report,
        "ai_status": get_ai_status(),
        "power_settings": get_power_settings(),
        "assets": {"broll": broll_files, "music": music_files, "sfx": sfx_files, "luts": lut_files},
        "outputs": outputs,
        "logs_tail": logs_tail,
        "chat_history": chat_history,
    }


@app.get("/api/projects/{name}/brief")
def api_get_brief(name: str) -> dict[str, Any]:
    proj_dir = ensure_project(name)
    return load_project_brief(proj_dir)


@app.post("/api/projects/{name}/brief")
def api_save_brief(name: str, req: SaveBriefReq) -> dict[str, Any]:
    proj_dir = ensure_project(name)
    brief = save_project_brief(proj_dir, req.text, filename=req.filename)
    work_path = proj_dir / "03_working" / f"{name}.edl.tsv"
    edl_final = proj_dir / "03_working" / f"{name}.edl.final.tsv"
    active_edl = work_path if work_path.exists() else edl_final
    rows = read_edl(active_edl) if active_edl.exists() else []
    props_path = proj_dir / "03_working" / f"{name}.remotion_props.json"
    props_data = json.loads(props_path.read_text(encoding="utf-8")) if props_path.exists() else None
    gaps = analyze_content_and_source_gaps(proj_dir, rows, props=props_data, brief_data=brief) if rows else None
    return {"ok": True, "brief": brief, "gaps_report": gaps}


@app.post("/api/projects/{name}/upload")
async def api_upload_raw(name: str, file: UploadFile = File(...), target: str = "raw") -> dict[str, Any]:
    proj_dir = ensure_project(name)
    t_key = target if target in ALLOWED_UPLOAD_EXTS else "raw"
    safe_name = _sanitize_media_filename(file.filename or "clip.mp4", ALLOWED_UPLOAD_EXTS[t_key])
    if target == "broll":
        dest = proj_dir / "04_assets" / "broll" / safe_name
    elif target == "music":
        dest = proj_dir / "04_assets" / "music" / safe_name
    elif target == "sfx":
        dest = proj_dir / "04_assets" / "sfx" / safe_name
    elif target == "lut":
        dest = proj_dir / "04_assets" / "luts" / safe_name
    else:
        dest = proj_dir / "01_raw" / safe_name
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return {"ok": True, "filename": safe_name, "target": target, "size": dest.stat().st_size}


@app.get("/api/projects/{name}/color-analysis")
def api_color_analysis(name: str, force: bool = False) -> dict[str, Any]:
    return analyze_video_color_and_luts(name, force=force)


@app.post("/api/projects/{name}/color-sync")
def api_color_sync(name: str, req: ColorSyncReq) -> dict[str, Any]:
    proj_dir = ensure_project(name)
    layers_path = proj_dir / "03_working" / f"{name}.layers.json"
    layers = json.loads(layers_path.read_text(encoding="utf-8")) if layers_path.exists() else {}
    color_cfg = default_color_config()
    color_cfg.update(req.color)
    color_cfg["syncedAcrossAll"] = bool(req.apply_to_all)
    if color_cfg.get("lutId"):
        ensure_cube_lut_file(proj_dir, str(color_cfg["lutId"]))
    layers["color"] = color_cfg
    layers_path.write_text(json.dumps(layers, ensure_ascii=False, indent=2), encoding="utf-8")
    build_props_and_layers(name, preserve_user_layers=True)
    edl_path = proj_dir / "03_working" / f"{name}.edl.tsv"
    kept_cnt = sum(1 for r in read_edl(edl_path) if r.keep == 1) if edl_path.exists() else max(1, len(find_raw_videos(proj_dir)))
    return {"ok": True, "color": color_cfg, "synced_clips": kept_cnt}


@app.post("/api/projects/{name}/run-pipeline")
def api_run_pipeline(name: str, req: RunPipelineReq) -> dict[str, Any]:
    proj_dir = ensure_project(name)

    def task():
        res = run_pipeline(
            project_name=name,
            up_to=3,
            whisper_model=req.whisper_model,
            target_duration=req.target_duration,
            force_ai=req.force_ai,
            preset_name=req.preset,
        )
        build_props_and_layers(
            name,
            edl_path=proj_dir / "03_working" / f"{name}.edl.tsv",
            preserve_user_layers=False,
        )
        return res

    job_id = _start_job(name, "pipeline_1_to_3", task)
    return {"ok": True, "job_id": job_id}


@app.post("/api/projects/{name}/edl")
def api_save_edl(name: str, req: SaveEdlReq) -> dict[str, Any]:
    proj_dir = ensure_project(name)
    rows = [
        EdlRow(
            keep=1 if int(item.get("keep", 1)) else 0,
            start=float(item.get("start", 0)),
            end=float(item.get("end", 0)),
            label=str(item.get("label", "main")),
            text=str(item.get("text", "")),
            note=str(item.get("note", "")),
        )
        for item in req.rows
    ]
    work_path = proj_dir / "03_working" / f"{name}.edl.tsv"
    write_edl(work_path, rows)
    if req.mark_final:
        final_path = proj_dir / "03_working" / f"{name}.edl.final.tsv"
        write_edl(final_path, rows)
    props = build_props_and_layers(name, edl_path=work_path, preserve_user_layers=True)
    return {"ok": True, "summary": edl_summary(rows), "durationInFrames": props["durationInFrames"]}


@app.post("/api/projects/{name}/layers")
def api_save_layers(name: str, req: SaveLayersReq) -> dict[str, Any]:
    proj_dir = ensure_project(name)
    layers_path = proj_dir / "03_working" / f"{name}.layers.json"
    layers_path.write_text(json.dumps(req.layers, ensure_ascii=False, indent=2), encoding="utf-8")
    props = build_props_and_layers(name, preserve_user_layers=True)
    return {"ok": True, "props_summary": {"captions": len(props["captions"]), "infoCards": len(props["infoCards"])}}


def _build_compressed_ai_payload(
    rows: list[EdlRow],
    preset: str,
    only_noted: bool = False,
    target_duration: float = 0.0,
    brief_points: list[str] | None = None,
) -> tuple[str, str, list[tuple[str, EdlRow]]]:
    """Build compact token-saving prompt & payload reused by REST restructure and Antigravity Bridge."""
    preset_txt = load_prompt_preset(preset)
    indexed = [(f"R{i + 1:02d}", r) for i, r in enumerate(rows)]

    if only_noted:
        target_items = [(rid, r) for rid, r in indexed if r.note.strip()]
        payload = "\n".join(f"{rid}|{r.duration:.1f}|{r.text}|NOTE:{r.note}" for rid, r in target_items)
        prompt = (
            f"{preset_txt}\n\nChỉ sửa hoặc bật/tắt các dòng có NOTE bên dưới.\n"
            'Trả về JSON thuần: {"updates": [{"id": "R01", "keep": 1, "label": "main", "text": "...", "note": ""}]}'
        )
        return prompt, payload, target_items

    if preset == "claims_rewrite":
        hits = scan_watchlist(rows, only_kept=True)
        flagged_indices = {h["index"]: h for h in hits}
        flagged_items = [
            (f"R{idx + 1:02d}", rows[idx], flagged_indices[idx])
            for idx in sorted(flagged_indices)
        ]
        payload = "\n".join(
            f"{rid}|{'/'.join(m['category'] for m in h['matches'])}|{r.text}"
            for rid, r, h in flagged_items
        )
        prompt = (
            f"{preset_txt}\n\n"
            'Trả về JSON thuần: {"rewrites": [{"id": "R01", "risk": "medium", "action": "rephrase", "safe_caption": "...", "note": "..."}]}'
        )
        return prompt, payload, [(rid, r) for rid, r, _ in flagged_items]

    # Chống rò rỉ token: chỉ gửi các dòng đang giữ (keep=1) đối với hook_pick / reorder_concise
    if preset == "hook_pick":
        candidate_items = [
            (rid, r) for idx_i, (rid, r) in enumerate(indexed)
            if r.keep == 1 and (r.duration <= 4.8 or idx_i < 8)
        ] or [(rid, r) for rid, r in indexed if r.keep == 1][:10]
    elif preset == "reorder_concise":
        candidate_items = [(rid, r) for rid, r in indexed if r.keep == 1] or indexed
    else:
        candidate_items = indexed

    brief_ctx = ""
    if brief_points:
        brief_ctx = "\n\nBRIEF / DÀN Ý MỤC TIÊU (ưu tiên giữ đủ các ý này):\n" + "\n".join(f"- {bp}" for bp in brief_points)
    payload = "\n".join(f"{rid}|{r.duration:.1f}|{r.text}" for rid, r in candidate_items) + brief_ctx
    dur_rule = (
        f"Mục tiêu tối đa ~{target_duration:.0f}s."
        if target_duration and target_duration > 0
        else "KHÔNG ép cắt theo số giây cứng; chọn lọc theo mạch ngữ cảnh & Brief (chỉ cắt retake, câu vấp và nói lặp). KHÔNG giữ câu đại từ/liên từ ('Nhưng mà', 'Cái con này', 'Nó', 'Đó là lý do', 'Tôi không thể') nếu thiếu câu danh từ làm rõ chủ ngữ ngay trước nó. Nếu thiếu ý so với Brief hoặc cần ảnh/clip minh họa trám thêm, nêu rõ trong missing_sources."
    )
    prompt = (
        f"{preset_txt}\n\n{dur_rule}\n"
        'Trả về JSON thuần: {"selected_ids": ["R01"], "dropped": [{"id": "R02", "reason": "..."}], "hook_id": "R01", "hook_title": "...", "text_fixes": {"R01": "..."}, "missing_sources": ["..."]}'
    )
    return prompt, payload, candidate_items


def _apply_ai_decision_to_edl(
    proj_dir: Path,
    name: str,
    rows: list[EdlRow],
    decision: dict[str, Any],
) -> list[EdlRow]:
    """Apply JSON result (updates, rewrites, selected_ids, or hook_id) cleanly onto EDL + Hook layer."""
    indexed = [(f"R{i + 1:02d}", r) for i, r in enumerate(rows)]
    by_rid = dict(indexed)
    work_path = proj_dir / "03_working" / f"{name}.edl.tsv"
    updated_rows = list(rows)

    if "updates" in decision:
        by_upd = {str(u.get("id")): u for u in decision.get("updates", []) if u.get("id")}
        for rid, r in indexed:
            if rid in by_upd:
                u = by_upd[rid]
                r.keep = 1 if int(u.get("keep", r.keep)) else 0
                r.label = str(u.get("label", r.label))
                r.text = str(u.get("text", r.text))
                r.note = str(u.get("note", r.note))
    elif "rewrites" in decision:
        by_rw = {str(rw.get("id")): rw for rw in decision.get("rewrites", []) if rw.get("id")}
        for rid, r in indexed:
            if rid in by_rw:
                rw = by_rw[rid]
                action = str(rw.get("action", "rephrase"))
                if action == "drop":
                    r.keep = 0
                    r.label = "drop"
                elif rw.get("safe_caption"):
                    r.text = str(rw["safe_caption"]).strip()
                r.note = str(rw.get("note", "watchlist đã rà an toàn"))
    elif "selected_ids" in decision or "hook_id" in decision:
        sel = [rid for rid in decision.get("selected_ids", []) if rid in by_rid]
        if not sel:
            sel = [rid for rid, r in indexed if r.keep == 1]
        hook_id = str(decision.get("hook_id", "")).strip()
        move_to_front = decision.get("move_to_front", True)
        if hook_id and hook_id in sel and move_to_front and sel[0] != hook_id:
            sel.remove(hook_id)
            sel.insert(0, hook_id)
        dropped_map = {str(d["id"]): str(d.get("reason", "dropped_by_ai")) for d in decision.get("dropped", []) if "id" in d}
        raw_fixes = decision.get("text_fixes") if isinstance(decision.get("text_fixes"), dict) else {}
        text_fixes = {str(k): str(v).strip() for k, v in raw_fixes.items() if str(v).strip()}
        rebuilt: list[EdlRow] = []
        for idx_pos, rid in enumerate(sel):
            r = by_rid[rid]
            rebuilt.append(EdlRow(
                keep=1,
                start=r.start,
                end=r.end,
                label="hook" if (rid == hook_id or (idx_pos == 0 and r.duration <= 3.8)) else (r.label if r.label != "drop" else "main"),
                text=text_fixes.get(rid, r.text),
                note=r.note,
            ))
        for rid, r in indexed:
            if rid not in sel:
                rebuilt.append(EdlRow(keep=0, start=r.start, end=r.end, label="drop", text=r.text, note=dropped_map.get(rid, r.note)))
        updated_rows = rebuilt

    # Nếu AI gợi ý hook_title mới, cập nhật nhẹ vào layers.json
    hook_title = str(decision.get("hook_title", "")).strip()
    layers_path = proj_dir / "03_working" / f"{name}.layers.json"
    if hook_title and layers_path.exists():
        try:
            layers = json.loads(layers_path.read_text(encoding="utf-8"))
            if isinstance(layers.get("hook"), dict):
                layers["hook"]["title"] = hook_title
                layers_path.write_text(json.dumps(layers, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass

    write_edl(work_path, updated_rows)
    build_props_and_layers(name, edl_path=work_path, preserve_user_layers=True)
    return updated_rows


@app.get("/api/ai/status")
def api_ai_status() -> dict[str, Any]:
    return get_ai_status()


@app.post("/api/ai/config")
def api_ai_config(req: AiConfigReq) -> dict[str, Any]:
    return save_ai_config(
        gemini_api_key=req.gemini_api_key,
        openai_api_key=req.openai_api_key,
        model=req.model,
        base_url=req.base_url,
        clear_keys=req.clear_keys,
    )


@app.get("/api/projects/{name}/ai-bridge-prompt")
def api_ai_bridge_prompt(
    name: str,
    preset: str = "retake_select",
    target_duration: float = 0.0,
    only_noted: bool = False,
) -> dict[str, Any]:
    proj_dir = ensure_project(name)
    work_path = proj_dir / "03_working" / f"{name}.edl.tsv"
    rows = read_edl(work_path)
    if not rows:
        raise HTTPException(400, "Chưa có EDL để tạo prompt.")
    brief_data = load_project_brief(proj_dir)
    prompt, payload, items = _build_compressed_ai_payload(
        rows,
        preset,
        only_noted=only_noted,
        target_duration=target_duration,
        brief_points=brief_data.get("outline_points"),
    )
    full_prompt = f"{prompt}\n\n--- DỮ LIỆU NÉN ({len(items)} dòng) ---\n{payload}"
    return {"ok": True, "item_count": len(items), "prompt_text": full_prompt}


@app.post("/api/projects/{name}/ai-bridge-apply")
def api_ai_bridge_apply(name: str, req: AiBridgeApplyReq) -> dict[str, Any]:
    proj_dir = ensure_project(name)
    work_path = proj_dir / "03_working" / f"{name}.edl.tsv"
    rows = read_edl(work_path)
    if not rows:
        raise HTTPException(400, "Chưa có EDL để áp dụng kết quả.")
    cleaned = req.raw_json.strip()
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, flags=re.DOTALL)
    if m:
        cleaned = m.group(1)
    try:
        decision = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"JSON không hợp lệ: {exc}")
    updated_rows = _apply_ai_decision_to_edl(proj_dir, name, rows, decision)
    meta = {"ai_called": True, "provider": "antigravity_bridge", "mode": "paste_json"}
    append_log(proj_dir, "ai_bridge_apply", req.preset, meta)
    return {"ok": True, "meta": meta, "summary": edl_summary(updated_rows)}


@app.post("/api/projects/{name}/ai-restructure")
def api_ai_restructure(name: str, req: AiRestructureReq) -> dict[str, Any]:
    """Run restructure, claims rewrite, or note fix (external API or zero-key smart local)."""
    proj_dir = ensure_project(name)
    work_path = proj_dir / "03_working" / f"{name}.edl.tsv"
    rows = read_edl(work_path)
    if not rows:
        raise HTTPException(400, "Chưa có EDL để AI sắp xếp.")

    def task():
        brief_data = load_project_brief(proj_dir)
        brief_points = brief_data.get("outline_points", [])
        prompt, payload, items = _build_compressed_ai_payload(
            rows,
            req.preset,
            only_noted=req.only_noted,
            target_duration=req.target_duration,
            brief_points=brief_points,
        )
        if req.only_noted:
            if not items:
                return {"message": "Không có cảnh nào ghi note để sửa riêng.", "ai_calls": 0}

            def fallback_notes():
                updates = []
                for rid, r in items:
                    low_n = r.note.lower()
                    keep = 0 if any(k in low_n for k in ("bỏ", "cắt", "drop", "xóa")) else 1
                    lbl = "hook" if "hook" in low_n else ("dark" if "nền tối" in low_n or "dark" in low_n else r.label)
                    updates.append({"id": rid, "keep": keep, "label": lbl, "text": r.text, "note": f"[đã xử lý] {r.note}"})
                return {"updates": updates}

            res, meta = call_ai_cached(proj_dir, name, f"ui_notes_{req.preset}", prompt, payload, fallback_notes)
            updated_rows = _apply_ai_decision_to_edl(proj_dir, name, rows, res)
            append_log(proj_dir, "ai_fix_noted", req.preset, meta)
            return {"mode": "only_noted", "meta": meta, "summary": edl_summary(updated_rows)}

        if req.preset == "claims_rewrite":
            if not items:
                return {"mode": "claims_rewrite", "message": "Không có câu nào dính Watchlist!", "meta": {"provider": "code_watchlist_clean"}, "summary": edl_summary(rows)}
            flagged_payload = [{"id": rid, "text": r.text} for rid, r in items]
            res, meta = call_ai_cached(
                proj_dir,
                name,
                "ui_claims_rewrite",
                prompt,
                payload,
                lambda: smart_local_claims_rewrite(flagged_payload),
            )
            updated_rows = _apply_ai_decision_to_edl(proj_dir, name, rows, res)
            append_log(proj_dir, "ai_claims_rewrite", req.preset, meta)
            return {"mode": "claims_rewrite", "meta": meta, "summary": edl_summary(updated_rows)}

        segments = [
            {"id": rid, "duration": r.duration, "text": r.text, "avg_prob": 0.92, "keep": r.keep}
            for rid, r in items
            if r.keep == 1 or "retake" in req.preset
        ] or [{"id": rid, "duration": r.duration, "text": r.text, "avg_prob": 0.92} for rid, r in items]
        res, meta = call_ai_cached(
            proj_dir,
            name,
            f"ui_restructure_{req.preset}",
            prompt,
            payload,
            lambda: smart_local_structure(
                segments,
                target_duration=req.target_duration,
                preset=req.preset,
                brief_points=brief_points,
            ),
        )
        updated_rows = _apply_ai_decision_to_edl(proj_dir, name, rows, res)
        append_log(proj_dir, "ai_restructure", req.preset, meta)
        return {"mode": "restructure", "meta": meta, "summary": edl_summary(updated_rows)}

    job_id = _start_job(name, "ai_restructure", task)
    return {"ok": True, "job_id": job_id}


def _execute_ai_chat_on_project(proj_dir: Path, name: str, user_msg: str) -> dict[str, Any]:
    """Conversational AI Editor: interprets natural Vietnamese commands and directly edits EDL, captions, hook, B-roll & style."""
    work_path = proj_dir / "03_working" / f"{name}.edl.tsv"
    final_path = proj_dir / "03_working" / f"{name}.edl.final.tsv"
    rows = read_edl(work_path) if work_path.exists() else (read_edl(final_path) if final_path.exists() else [])
    layers_path = proj_dir / "03_working" / f"{name}.layers.json"
    layers = json.loads(layers_path.read_text(encoding="utf-8")) if layers_path.exists() else {}

    msg = user_msg.strip()
    low = msg.lower()
    actions: list[str] = []
    reply_parts: list[str] = []
    captions_need_rebuild = False

    # 1. Explicit word/phrase replacement: "sửa [chữ/từ] X thành Y" or "đổi chữ X sang Y"
    m_repl = re.search(
        r"(?:sửa|đổi|thay)\s+(?:chữ|từ|cụm)?\s*[\"'“”‘’]?([^\"'“”‘’]+?)[\"'“”‘’]?\s+(?:thành|sang)\s+[\"'“”‘’]?([^\"'“”‘’]+?)[\"'“”‘’]?$",
        msg,
        flags=re.IGNORECASE,
    )
    if m_repl:
        src_phrase = m_repl.group(1).strip()
        dst_phrase = m_repl.group(2).strip()
        if src_phrase and dst_phrase and not any(k in src_phrase.lower() for k in ("màu", "hook", "cảnh", "tốc độ", "cỡ chữ")):
            cnt = 0
            pat = re.compile(re.escape(src_phrase), flags=re.IGNORECASE)
            for r in rows:
                if pat.search(r.text):
                    r.text = pat.sub(dst_phrase, r.text)
                    cnt += 1
            if cnt > 0:
                captions_need_rebuild = True
                actions.append(f"Đã thay '{src_phrase}' → '{dst_phrase}' ({cnt} câu)")
                reply_parts.append(f"Mình đã sửa toàn bộ **\"{src_phrase}\"** thành **\"{dst_phrase}\"** trên {cnt} đoạn thoại và cập nhật lại phụ đề.")

    # 2. ASR & Spelling cleanup ("chính tả", "lỗi từ", "sửa sub")
    if any(k in low for k in ("chính tả", "sửa lỗi từ", "chuẩn hóa phụ đề", "sửa phụ đề", "lỗi chữ")):
        fixed_cnt = 0
        for r in rows:
            cleaned_txt = _clean_vi_asr_text(r.text)
            if cleaned_txt != r.text:
                r.text = cleaned_txt
                fixed_cnt += 1
        captions_need_rebuild = True
        actions.append(f"Chuẩn hóa chính tả ({fixed_cnt} câu cập nhật)")
        reply_parts.append(f"Đã rà và sửa sạch lỗi chính tả nhận diện giọng nói trên toàn bộ phụ đề ({fixed_cnt} câu được cập nhật).")

    # 3. Traffic-throttling, commercial/price & policy filter + stray logo removal
    if any(k in low for k in ("bóp tương tác", "bóp traffic", "vi phạm", "buôn bán", "giá cả", "chính sách", "watchlist", "tiktok shop", "xóa logo", "xoá logo")):
        dropped_cnt = 0
        softened_cnt = 0
        for r in rows:
            if r.keep != 1:
                continue
            hard = is_hard_traffic_or_policy_violation(r.text)
            if hard:
                r.keep = 0
                r.label = "drop"
                r.note = hard
                dropped_cnt += 1
                continue
            safe_txt, app_fixes = sanitize_traffic_and_policy_text(_clean_vi_asr_text(r.text))
            if safe_txt != r.text:
                r.text = safe_txt
                softened_cnt += 1
        old_logos = len(layers.get("logoBadges", []))
        layers["logoBadges"] = []
        layers["logoBadges_edited"] = False
        logo_file = proj_dir / "04_assets" / "logo" / "logo_tiktokshop.png"
        if logo_file.exists():
            logo_file.unlink(missing_ok=True)
        captions_need_rebuild = True
        actions.append(f"Lọc từ bóp traffic (cắt {dropped_cnt}, làm mềm {softened_cnt}, xóa {old_logos} logo)")
        reply_parts.append(
            f"Đã quét chống bóp tương tác: loại bỏ **{dropped_cnt}** câu chèo kéo/nhạy cảm, làm mềm **{softened_cnt}** câu có từ thương mại/giá cả và gỡ bỏ hoàn toàn logo thừa."
        )

    # 4. Target duration / Cut shorter ("cắt ngắn", "rút gọn", "còn 40s")
    m_dur = re.search(r"(?:còn|xuống|khoảng|dưới|tối đa)\s*(\d{2,3})\s*(?:s|giây)\b", low)
    if m_dur or any(k in low for k in ("cắt ngắn", "rút gọn", "súc tích", "ngắn lại", "dựng gọn")):
        target_sec = float(m_dur.group(1)) if m_dur else 44.0
        brief_points = load_project_brief(proj_dir).get("outline_points", [])
        segments = [
            {
                "id": f"R{i+1:02d}",
                "start": r.start,
                "end": r.end,
                "duration": r.duration,
                "text": _clean_vi_asr_text(r.text),
                "avg_prob": 0.93,
            }
            for i, r in enumerate(rows)
            if r.keep == 1
        ]
        if len(segments) >= 3:
            res = smart_local_structure(segments, target_duration=target_sec, preset="reorder_concise", brief_points=brief_points)
            rows = _apply_ai_decision_to_edl(proj_dir, name, rows, res)
            captions_need_rebuild = True
            kept_sec = sum(r.duration for r in rows if r.keep == 1)
            actions.append(f"Rút gọn còn {kept_sec:.1f}s")
            reply_parts.append(f"Đã biên tập rút gọn các đoạn lặp/dài dòng xuống còn **{kept_sec:.1f}s** (giữ trọn mạch chủ ngữ và ý chính).")

    # 5. Reorder scenes by index ("đảo cảnh 5 lên cảnh 2", "đổi vị trí cảnh 3 và 4") or by topic ("đưa đoạn nói về X lên trước Y")
    m_swap_idx = re.search(r"(?:đảo|đổi vị trí|chuyển|đưa)\s+(?:cảnh|đoạn)\s*[#rR]?(\d+)\s+(?:lên|sang|với|trước|sau)\s+(?:cảnh|đoạn|vị trí)?\s*[#rR]?(\d+)", low)
    if m_swap_idx:
        k_indices = [i for i, r in enumerate(rows) if r.keep == 1]
        c1 = int(m_swap_idx.group(1)) - 1
        c2 = int(m_swap_idx.group(2)) - 1
        if 0 <= c1 < len(k_indices) and 0 <= c2 < len(k_indices) and c1 != c2:
            r_idx1 = k_indices[c1]
            r_idx2 = k_indices[c2]
            rows[r_idx1], rows[r_idx2] = rows[r_idx2], rows[r_idx1]
            captions_need_rebuild = True
            actions.append(f"Đảo vị trí cảnh #{c1+1} ↔ #{c2+1}")
            reply_parts.append(f"Đã đảo vị trí **cảnh #{c1+1}** và **cảnh #{c2+1}** trên Timeline.")

    m_topic_move = re.search(r"đưa\s+(?:đoạn|cảnh)\s+(?:nói về\s+)?([^,]+?)\s+lên\s+(?:trước\s+(?:đoạn|cảnh)?\s*(?:nói về\s+)?(.+)|đầu)", low)
    if m_topic_move and not m_swap_idx:
        kw_src = m_topic_move.group(1).strip(" \"'")
        kw_dst = (m_topic_move.group(2) or "").strip(" \"'")
        src_idx = next((i for i, r in enumerate(rows) if r.keep == 1 and kw_src in r.text.lower()), -1)
        if src_idx >= 0:
            item = rows.pop(src_idx)
            if not kw_dst:
                first_kept = next((i for i, r in enumerate(rows) if r.keep == 1), 0)
                rows.insert(first_kept, item)
                actions.append(f"Đưa đoạn '{kw_src}' lên đầu")
                reply_parts.append(f"Đã đưa đoạn nói về **\"{kw_src}\"** lên đầu Timeline.")
            else:
                dst_idx = next((i for i, r in enumerate(rows) if r.keep == 1 and kw_dst in r.text.lower()), 0)
                rows.insert(dst_idx, item)
                actions.append(f"Đưa '{kw_src}' lên trước '{kw_dst}'")
                reply_parts.append(f"Đã di chuyển đoạn **\"{kw_src}\"** lên trước đoạn **\"{kw_dst}\" Full Timeline**.")
            captions_need_rebuild = True

    # 6. Hook title or Hook selection ("đặt tiêu đề hook là ...", "đổi hook sang ...")
    m_hook_title = re.search(r"tiêu đề\s+hook\s+(?:là|thành)\s*[:\"'“”]?(.+?)[\"'“”]?$", msg, flags=re.IGNORECASE)
    if m_hook_title:
        new_ht = m_hook_title.group(1).strip().upper()
        layers.setdefault("hook", {})["title"] = new_ht
        layers["hook"]["enabled"] = True
        actions.append(f"Hook: {new_ht}")
        reply_parts.append(f"Đã cập nhật tiêu đề Hook 3 giây đầu thành **\"{new_ht}\"**.")
    elif any(k in low for k in ("chọn lại hook", "đổi hook", "tối ưu hook")):
        m_hook_kw = re.search(r"hook\s+(?:sang|về|là)\s+(?:đoạn\s+|câu\s+)?(.+)$", low)
        kw_h = m_hook_kw.group(1).strip(" \"'") if m_hook_kw else ""
        target_i = -1
        if kw_h:
            target_i = next((i for i, r in enumerate(rows) if kw_h in r.text.lower()), -1)
        if target_i < 0:
            kept_candidates = [(i, r) for i, r in enumerate(rows) if r.keep == 1 and 1.5 <= r.duration <= 4.5]
            if kept_candidates:
                target_i = kept_candidates[0][0]
        if target_i >= 0:
            row_h = rows.pop(target_i)
            row_h.keep = 1
            row_h.label = "hook"
            for r in rows:
                if r.label == "hook":
                    r.label = "main"
            rows.insert(0, row_h)
            new_ht = distill_clean_hook_title(row_h.text)
            layers.setdefault("hook", {})["title"] = new_ht
            layers["hook"]["enabled"] = True
            captions_need_rebuild = True
            actions.append(f"Đổi Hook: {new_ht}")
            reply_parts.append(f"Đã chọn câu mở đầu mới: *\"{row_h.text}\"* và đặt tiêu đề Hook là **\"{new_ht}\"**.")

    # 7. Restore or Drop segments by keyword ("khôi phục đoạn nói về 55g", "xóa đoạn nói về ...")
    m_restore = re.search(r"(?:khôi phục|bật lại|lấy lại|thêm lại)\s+(?:đoạn|câu|cảnh)\s+(?:nói về\s+)?(.+)$", low)
    if m_restore:
        kw_res = m_restore.group(1).strip(" \"'.?!")
        restored = 0
        for r in rows:
            if r.keep == 0 and kw_res in r.text.lower():
                r.keep = 1
                r.label = "main"
                r.note = "khôi phục qua AI Chat"
                restored += 1
        if restored > 0:
            captions_need_rebuild = True
            actions.append(f"Khôi phục {restored} đoạn '{kw_res}'")
            reply_parts.append(f"Đã khôi phục **{restored}** đoạn nói về **\"{kw_res}\"** vào lại Timeline.")

    m_drop = re.search(r"(?:xóa|xoá|bỏ|cắt bỏ)\s+(?:đoạn|câu|cảnh)\s+(?:nói về\s+)?(.+)$", low)
    if m_drop and "logo" not in low and "bóp" not in low:
        kw_dr = m_drop.group(1).strip(" \"'.?!")
        m_rnum = re.match(r"^[#rR]?(\d+)$", kw_dr)
        dropped_c = 0
        if m_rnum:
            r_num = int(m_rnum.group(1)) - 1
            if 0 <= r_num < len(rows):
                rows[r_num].keep = 0
                rows[r_num].label = "drop"
                dropped_c = 1
        else:
            for r in rows:
                if r.keep == 1 and kw_dr in r.text.lower():
                    r.keep = 0
                    r.label = "drop"
                    dropped_c += 1
        if dropped_c > 0:
            captions_need_rebuild = True
            actions.append(f"Đã cắt bỏ {dropped_c} đoạn ({kw_dr})")
            reply_parts.append(f"Đã tắt **{dropped_c}** đoạn khớp với **\"{kw_dr}\"** khỏi Timeline.")

    # 8. Style / Color / Font Size / Speed / B-Roll commands
    m_fsize = re.search(r"(?:cỡ chữ|font|size)\s*(?:sub|phụ đề)?\s*(?:là|lên|xuống)?\s*(\d{2})\b", low)
    if m_fsize:
        sz = max(32, min(76, int(m_fsize.group(1))))
        layers.setdefault("style", {})["captionFontSize"] = sz
        actions.append(f"Cỡ chữ Sub: {sz}px")
        reply_parts.append(f"Đã chỉnh cỡ chữ phụ đề thành **{sz}px**.")

    if any(k in low for k in ("sub màu vàng", "chữ màu vàng", "từ khóa màu vàng")):
        layers.setdefault("style", {})["accentColor"] = "#FACC15"
        actions.append("Màu nhấn Sub: Vàng #FACC15")
        reply_parts.append("Đã đổi màu nhấn từ khóa phụ đề sang **Vàng (#FACC15)**.")
    elif any(k in low for k in ("sub màu xanh", "chữ màu xanh", "từ khóa màu xanh")):
        layers.setdefault("style", {})["accentColor"] = "#38BDF8"
        actions.append("Màu nhấn Sub: Xanh #38BDF8")
        reply_parts.append("Đã đổi màu nhấn từ khóa phụ đề sang **Xanh Cyan (#38BDF8)**.")

    m_spd = re.search(r"tốc độ(?:\s+nói)?\s*(?:lên|xuống|là)?\s*(\d+\.\d+)x?", low)
    if m_spd:
        spd = max(0.85, min(1.35, float(m_spd.group(1))))
        layers.setdefault("video", {})["speechSpeed"] = spd
        captions_need_rebuild = True
        actions.append(f"Tốc độ nói: {spd:.2f}x")
        reply_parts.append(f"Đã cập nhật tốc độ nhịp nói thành **{spd:.2f}x**.")

    if any(k in low for k in ("b-roll", "broll", "cận cảnh", "thẻ tóm tắt")):
        m_bc = re.search(r"(\d)\s*(?:thẻ|b-roll|broll)", low)
        b_cnt = int(m_bc.group(1)) if m_bc else 3
        write_edl(work_path, rows)
        layers_path.write_text(json.dumps(layers, ensure_ascii=False, indent=2), encoding="utf-8")
        af = auto_enhance_project(name, fetch_logos=False, generate_broll=True, broll_count=b_cnt, extract_demo_broll=True, ensure_music=True)
        layers = json.loads(layers_path.read_text(encoding="utf-8"))
        actions.append(f"Tạo {len(af['demo_broll_extracted'])} B-roll cận + {len(af['broll_cards_generated'])} thẻ")
        reply_parts.append(
            f"Đã tự động trích **{len(af['demo_broll_extracted'])}** cảnh B-roll quay cận từ clip gốc và tạo **{len(af['broll_cards_generated'])}** thẻ tóm tắt."
        )

    if any(k in low for k in ("chỉnh màu", "cân màu", "auto color", "trong trẻo")):
        analysis = analyze_video_color_and_luts(name, force=False)
        top_luts = analysis.get("top_3_luts") or []
        best_lut = top_luts[0]["id"] if top_luts else "wishedit_clean_studio"
        ensure_cube_lut_file(proj_dir, best_lut)
        c_cfg = default_color_config()
        c_cfg.update(layers.get("color") or {})
        c_cfg["autoColorEnabled"] = True
        c_cfg["lutId"] = best_lut
        c_cfg["adjustmentLayerEnabled"] = True
        layers["color"] = c_cfg
        actions.append(f"Bật Auto Color + LUT {best_lut}")
        reply_parts.append(f"Đã bật **Filmic Auto Color** chống cháy sáng kết hợp LUT **{best_lut}**.")

    # 9. If no deterministic rule matched and external LLM key is configured, query external LLM
    if not actions and _has_external_llm_key() and rows:
        try:
            comp = "\n".join(f"R{i+1:02d}|keep={r.keep}|{r.duration:.1f}s|{r.text}" for i, r in enumerate(rows[:60]))
            sys_p = (
                "Bạn là trợ lý dựng video AI trong phần mềm WishEdit. Người dùng gửi yêu cầu chỉnh sửa timeline.\n"
                "Trả về JSON: {\"reply\": \"câu trả lời tiếng Việt ngắn gọn\", \"hook_title\": \"tùy chọn\", "
                "\"drop_ids\": [\"R02\"], \"restore_ids\": [\"R10\"], \"text_fixes\": {\"R01\": \"...\"}}"
            )
            llm_res, prov = _call_external_llm(sys_p, f"Yêu cầu: {msg}\n\nEDL:\n{comp}")
            for did in llm_res.get("drop_ids", []):
                idx_d = int(str(did).lstrip("Rr")) - 1 if str(did).lstrip("Rr").isdigit() else -1
                if 0 <= idx_d < len(rows):
                    rows[idx_d].keep = 0
                    rows[idx_d].label = "drop"
            for rid in llm_res.get("restore_ids", []):
                idx_r = int(str(rid).lstrip("Rr")) - 1 if str(rid).lstrip("Rr").isdigit() else -1
                if 0 <= idx_r < len(rows):
                    rows[idx_r].keep = 1
                    rows[idx_r].label = "main"
            for fid, ftxt in (llm_res.get("text_fixes") or {}).items():
                idx_f = int(str(fid).lstrip("Rr")) - 1 if str(fid).lstrip("Rr").isdigit() else -1
                if 0 <= idx_f < len(rows) and str(ftxt).strip():
                    rows[idx_f].text = str(ftxt).strip()
            if llm_res.get("hook_title"):
                layers.setdefault("hook", {})["title"] = str(llm_res["hook_title"]).strip().upper()
            captions_need_rebuild = True
            actions.append(f"AI ({prov}) đã cập nhật Timeline")
            reply_parts.append(str(llm_res.get("reply") or "Đã áp dụng chỉnh sửa theo yêu cầu của bạn."))
        except Exception:
            pass

    # 10. Default helpful response if user asked a general question or status check
    if not actions:
        kept_rows = [r for r in rows if r.keep == 1]
        tot_s = sum(r.duration for r in kept_rows)
        hits = scan_watchlist(rows, only_kept=True)
        reply_parts.append(
            f"Dự án **{name}** hiện có **{len(kept_rows)} cảnh đang giữ ({tot_s:.1f}s)**, "
            f"**{len(hits)}** cảnh báo từ khóa nhạy cảm.\n"
            "Bạn có thể nhắn trực tiếp để mình làm ngay, ví dụ:\n"
            "• *\"Cắt ngắn video còn 42 giây\"*\n"
            "• *\"Lọc từ buôn bán, giá cả dễ bóp traffic và xóa logo\"*\n"
            "• *\"Sửa chính tả phụ đề\"* hoặc *\"Sửa chữ X thành Y\"*\n"
            "• *\"Đảo cảnh 4 lên cảnh 2\"* hoặc *\"Đưa đoạn nói về iPhone lên trước\"*\n"
            "• *\"Đặt tiêu đề hook là MÁY ĐỌC SÁCH BỎ TÚI\"*"
        )

    if captions_need_rebuild:
        layers["captions_edited"] = False
    write_edl(work_path, rows)
    write_edl(final_path, rows)
    layers_path.write_text(json.dumps(layers, ensure_ascii=False, indent=2), encoding="utf-8")
    props = build_props_and_layers(name, edl_path=work_path, preserve_user_layers=True)

    reply_text = "\n".join(reply_parts)
    chat_path = proj_dir / "03_working" / f"{name}.chat_history.json"
    history: list[dict[str, Any]] = []
    if chat_path.exists():
        try:
            history = json.loads(chat_path.read_text(encoding="utf-8"))
        except Exception:
            history = []
    history.append({"role": "user", "text": msg, "content": msg, "ts": time.strftime("%H:%M")})
    history.append({"role": "assistant", "text": reply_text, "content": reply_text, "actions": actions, "ts": time.strftime("%H:%M")})
    history = history[-40:]
    chat_path.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    append_log(proj_dir, "ai_chat_edit", msg, {"actions": actions})

    return {
        "ok": True,
        "reply": reply_text,
        "actions": actions,
        "chat_history": history,
        "edl_summary": edl_summary(rows),
        "durationInFrames": props["durationInFrames"],
    }


@app.post("/api/projects/{name}/chat")
def api_project_chat(name: str, req: AiChatReq) -> dict[str, Any]:
    proj_dir = ensure_project(name)
    if req.clear_history:
        chat_path = proj_dir / "03_working" / f"{name}.chat_history.json"
        if chat_path.exists():
            chat_path.unlink(missing_ok=True)
        return {"ok": True, "reply": "Đã làm mới lịch sử trò chuyện.", "actions": [], "chat_history": []}
    if not req.message.strip():
        raise HTTPException(400, "Hãy nhập yêu cầu cho Trợ lý AI.")
    return _execute_ai_chat_on_project(proj_dir, name, req.message)


@app.post("/api/projects/{name}/timeline/drop-raw")
def api_drop_raw_timeline(name: str, req: DropRawTimelineReq) -> dict[str, Any]:
    """Quickly place a raw clip onto Track 1 of the Timeline (without running full Whisper yet)."""
    proj_dir = ensure_project(name)
    raws = find_raw_videos(proj_dir)
    if not raws:
        raise HTTPException(404, "Chưa có video nào trong 01_raw/")
    target = next((p for p in raws if p.name == Path(req.filename).name), raws[0])

    try:
        info = ffprobe_json(target)
        dur = float(info.get("format", {}).get("duration", 0.0) or 0.0)
    except Exception:
        dur = 0.0
    if dur <= 0.1:
        dur = 10.0

    work_path = proj_dir / "03_working" / f"{name}.edl.tsv"
    existing = read_edl(work_path) if work_path.exists() else []

    if not existing:
        # Tạo sẵn các đoạn cắt gọn 5-6s để người dùng kéo/tách ngay hoặc bấm Auto AI Edit
        chunk = 5.0 if dur > 10.0 else dur
        t = 0.0
        idx_c = 1
        new_rows: list[EdlRow] = []
        while t < dur - 0.3:
            end_t = min(dur, round(t + chunk, 2))
            if dur - end_t < 1.2:
                end_t = round(dur, 2)
            new_rows.append(
                EdlRow(
                    keep=1,
                    start=round(t, 2),
                    end=end_t,
                    label="hook" if idx_c == 1 else "main",
                    text=f"Đoạn {idx_c} ({target.stem[:18]}) · Bấm Auto AI Edit để tách lời",
                    note="",
                )
            )
            t = end_t
            idx_c += 1
        write_edl(work_path, new_rows)
        props = build_props_and_layers(name, edl_path=work_path, preserve_user_layers=True)
        return {"ok": True, "added": len(new_rows), "duration": dur, "durationInFrames": props["durationInFrames"]}

    # Nếu đã có EDL, nối thêm clip hoặc kích hoạt lại 1 đoạn nếu toàn bộ đang drop
    if all(r.keep == 0 for r in existing):
        existing[0].keep = 1
        existing[0].label = "main"
    else:
        existing.append(
            EdlRow(
                keep=1,
                start=0.0,
                end=round(min(dur, 8.0), 2),
                label="main",
                text=f"Clip bổ sung ({target.stem[:18]})",
                note="",
            )
        )
    write_edl(work_path, existing)
    props = build_props_and_layers(name, edl_path=work_path, preserve_user_layers=True)
    return {"ok": True, "added": 1, "duration": dur, "durationInFrames": props["durationInFrames"]}


@app.post("/api/projects/{name}/auto-edit")
def api_auto_ai_edit(name: str, req: AutoEditReq) -> dict[str, Any]:
    """1-Click Full Auto AI Edit Mode: Ingest/Transcribe -> Silence & Retake Cut -> Hook -> Auto Color/LUT -> Auto B-Roll/Logo/Music -> Render + QA."""
    proj_dir = ensure_project(name)
    raws = find_raw_videos(proj_dir)
    if not raws:
        raise HTTPException(400, "Chưa có video gốc trong 01_raw/. Hãy kéo thả video vào Media Raw trước!")

    def task():
        print("[Auto AI Edit 1/4] Chạy Pipeline Bước 1–3: Tách lời, cắt khoảng lặng & lọc retake theo Brief...")
        run_pipeline(
            project_name=name,
            up_to=3,
            whisper_model=req.whisper_model,
            target_duration=req.target_duration,
            force_ai=False,
            preset_name=req.preset,
        )
        build_props_and_layers(
            name,
            edl_path=proj_dir / "03_working" / f"{name}.edl.tsv",
            preserve_user_layers=False,
        )

        layers_path = proj_dir / "03_working" / f"{name}.layers.json"
        layers = json.loads(layers_path.read_text(encoding="utf-8")) if layers_path.exists() else {}

        if req.auto_color:
            print("[Auto AI Edit 2/4] Phân tích ánh sáng & bật AI Auto Color + Top 1 Smart LUT (0 Token)...")
            analysis = analyze_video_color_and_luts(name, force=False)
            top_luts = analysis.get("top_3_luts") or analysis.get("ranked_luts") or []
            best_lut_id = top_luts[0]["id"] if top_luts else "wishedit_clean_studio"
            ensure_cube_lut_file(proj_dir, best_lut_id)
            c_cfg = default_color_config()
            c_cfg.update(layers.get("color") or {})
            c_cfg["autoColorEnabled"] = True
            c_cfg["autoColorIntensity"] = int(c_cfg.get("autoColorIntensity") or 80)
            if not c_cfg.get("lutId") or c_cfg.get("lutId") == "none":
                c_cfg["lutId"] = best_lut_id
            c_cfg["adjustmentLayerEnabled"] = True
            c_cfg["syncedAcrossAll"] = True
            layers["color"] = c_cfg

        layers["autoBrollEnabled"] = bool(req.auto_broll)
        layers.setdefault("video", {})["enableSubtleZoom"] = bool(req.dynamic_zoom)
        layers_path.write_text(json.dumps(layers, ensure_ascii=False, indent=2), encoding="utf-8")

        print(
            f"[Auto AI Edit 3/4] Tự động B-Roll ({req.broll_count} thẻ), trích cận cảnh={req.extract_demo_broll}, "
            f"nhạc nền={req.ensure_music}..."
        )
        af_res = auto_enhance_project(
            project_name=name,
            fetch_logos=False,
            generate_broll=req.auto_broll,
            broll_count=req.broll_count,
            extract_demo_broll=req.extract_demo_broll,
            ensure_music=req.ensure_music,
        )

        work_path = proj_dir / "03_working" / f"{name}.edl.tsv"
        final_path = proj_dir / "03_working" / f"{name}.edl.final.tsv"
        if work_path.exists():
            shutil.copy2(work_path, final_path)
        build_props_and_layers(name, edl_path=final_path if final_path.exists() else work_path, preserve_user_layers=True)

        if not req.render_after:
            print("[Auto AI Edit] Đã dựng xong Timeline & Layers (chế độ xem trước trước khi xuất).")
            return {"mode": "timeline_only", "auto_fill": af_res}

        print(f"[Auto AI Edit 4/4] Đang xuất video hoàn chỉnh ({req.render_engine}) & kiểm tra QA...")
        render_res = render_project(
            project_name=name,
            edl_path=final_path if final_path.exists() else work_path,
            topic=req.topic or name,
            overwrite=False,
            export_other_platforms=req.other_platforms,
            render_engine=req.render_engine,
        )
        append_log(
            proj_dir,
            "auto_ai_edit",
            f"preset={req.preset}, broll={req.broll_count}, demo={req.extract_demo_broll}, engine={req.render_engine}",
            {"output": render_res.get("output_video")},
        )
        return render_res

    job_id = _start_job(name, "auto_ai_edit", task)
    return {"ok": True, "job_id": job_id}


@app.post("/api/projects/{name}/render")
def api_render(name: str, req: RenderReq) -> dict[str, Any]:
    """Code-only render endpoint (0 AI tokens)."""
    proj_dir = ensure_project(name)
    work_path = proj_dir / "03_working" / f"{name}.edl.tsv"
    final_path = proj_dir / "03_working" / f"{name}.edl.final.tsv"
    if work_path.exists():
        shutil.copy2(work_path, final_path)

    def task():
        return render_project(
            project_name=name,
            edl_path=final_path if final_path.exists() else work_path,
            topic=req.topic or name,
            overwrite=req.overwrite,
            export_other_platforms=req.other_platforms,
            render_engine=req.render_engine,
        )

    job_id = _start_job(name, "render_code_only", task)
    return {"ok": True, "job_id": job_id}


@app.get("/api/projects/{name}/diff")
def api_diff(name: str) -> dict[str, Any]:
    try:
        return diff_project(name)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc))


@app.get("/api/projects/{name}/media/source")
def api_source_video(name: str, request: Request):
    proj_dir = ensure_project(name)
    ingest_path = proj_dir / "03_working" / f"{name}.ingest.json"
    if ingest_path.exists():
        stored = json.loads(ingest_path.read_text(encoding="utf-8")).get("work_video", "")
        src = resolve_portable_path(proj_dir, stored, "03_working")
        if src.exists():
            return _range_video_response(src, request)
    raw = find_raw_videos(proj_dir)
    if not raw:
        raise HTTPException(404, "Chưa có video nguồn")
    return _range_video_response(raw[0], request)


@app.get("/api/projects/{name}/media/raw/{filename}")
def api_raw_video_file(name: str, filename: str, request: Request):
    proj_dir = ensure_project(name)
    safe = Path(filename).name
    target = proj_dir / "01_raw" / safe
    if not target.exists():
        raise HTTPException(404, f"Không thấy clip gốc {safe}")
    return _range_video_response(target, request)


@app.get("/api/projects/{name}/media/broll/{filename}")
def api_broll_media_file(name: str, filename: str, request: Request):
    proj_dir = ensure_project(name)
    safe = Path(filename).name
    target = proj_dir / "04_assets" / "broll" / safe
    if not target.exists():
        alt = proj_dir / "04_assets" / "overlays" / safe
        if alt.exists():
            target = alt
        else:
            raise HTTPException(404, f"Không thấy B-Roll {safe}")
    if target.suffix.lower() in VIDEO_EXTS:
        return _range_video_response(target, request)
    mime, _ = mimetypes.guess_type(str(target))
    return FileResponse(str(target), media_type=mime or "image/png")


@app.get("/api/projects/{name}/media/audio/{kind}/{filename}")
def api_audio_file(name: str, kind: str, filename: str):
    proj_dir = ensure_project(name)
    safe = Path(filename).name
    sub = "music" if kind == "music" else "sfx"
    target = proj_dir / "04_assets" / sub / safe
    if not target.exists():
        alt = proj_dir / "03_working" / safe
        if alt.exists():
            target = alt
        else:
            raise HTTPException(404, f"Không thấy file âm thanh {safe}")
    mime, _ = mimetypes.guess_type(str(target))
    return FileResponse(str(target), media_type=mime or "audio/mpeg")


@app.get("/api/projects/{name}/thumbnail")
def api_media_thumbnail(name: str, kind: str = "raw", filename: str = "", sec: float | None = None):
    """Generate and cache visual thumbnails for Media Pool & Timeline clips (with optional timestamp sec)."""
    proj_dir = ensure_project(name)
    safe = Path(filename).name if filename else ""

    if kind == "source" or not safe:
        ingest_path = proj_dir / "03_working" / f"{proj_dir.name}.ingest.json"
        src = None
        if ingest_path.exists():
            stored = json.loads(ingest_path.read_text(encoding="utf-8")).get("work_video", "")
            cand = resolve_portable_path(proj_dir, stored, "03_working")
            if cand.exists():
                src = cand
        if src is None:
            raws = find_raw_videos(proj_dir)
            src = raws[0] if raws else None
        if src is None or not src.exists():
            return FileResponse(str(STATIC_DIR / "favicon.svg"), media_type="image/svg+xml")
        safe = src.name
    elif kind == "raw":
        src = proj_dir / "01_raw" / safe
    elif kind == "output":
        src = proj_dir / "05_output" / "tiktok_9x16" / safe
    elif kind == "broll":
        src = proj_dir / "04_assets" / "broll" / safe
    else:
        src = proj_dir / "01_raw" / safe

    if not src.exists():
        return FileResponse(str(STATIC_DIR / "favicon.svg"), media_type="image/svg+xml")

    if src.suffix.lower() in IMAGE_EXTS:
        mime, _ = mimetypes.guess_type(str(src))
        return FileResponse(
            str(src),
            media_type=mime or "image/png",
            headers={"Cache-Control": "public, max-age=3600"},
        )

    thumbs_dir = proj_dir / "03_working" / "_thumbs"
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    sec_tag = f"s{int(round(float(sec)) * 2)}" if sec is not None else "default"
    thumb_key = re.sub(r"[^a-zA-Z0-9_.-]", "_", f"{kind}_{safe}_{sec_tag}")
    thumb_jpg = thumbs_dir / f"{thumb_key}.jpg"

    if not thumb_jpg.exists():
        import subprocess as _sp

        seek_candidates = [f"{max(0.0, float(sec)):.1f}"] if sec is not None else ["1.0", "0.1"]
        for seek_sec in seek_candidates:
            try:
                _sp.run(
                    [
                        "ffmpeg",
                        "-y",
                        "-v",
                        "error",
                        "-ss",
                        seek_sec,
                        "-i",
                        str(src),
                        "-frames:v",
                        "1",
                        "-vf",
                        "scale=180:-1",
                        "-q:v",
                        "5",
                        str(thumb_jpg),
                    ],
                    check=True,
                    capture_output=True,
                    timeout=8,
                )
                if thumb_jpg.exists() and thumb_jpg.stat().st_size > 200:
                    break
            except Exception:
                pass

    if thumb_jpg.exists() and thumb_jpg.stat().st_size > 200:
        return FileResponse(
            str(thumb_jpg),
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    return FileResponse(str(STATIC_DIR / "favicon.svg"), media_type="image/svg+xml")


@app.get("/api/system/hardware")
def api_get_hardware(refresh: bool = False) -> dict[str, Any]:
    if refresh:
        detect_hardware_profile(force_refresh=True)
    return get_power_settings()


@app.post("/api/system/hardware")
def api_save_hardware(req: PowerSettingsReq) -> dict[str, Any]:
    clean_webhook = _validate_webhook_url(req.remote_webhook_url)
    return save_power_settings(
        power_mode=req.power_mode,
        lan_access=req.lan_access,
        remote_webhook_url=clean_webhook,
        prefer_native_window=req.prefer_native_window,
    )


@app.get("/api/system/cache")
def api_get_cache_info() -> dict[str, Any]:
    total_bytes = 0
    for pdir in (TOOLS_DIR.parent / "Projects").iterdir() if (TOOLS_DIR.parent / "Projects").exists() else []:
        if not pdir.is_dir() or pdir.name in ("Template", "_template"):
            continue
        wdir = pdir / "03_working"
        if wdir.exists():
            for f in wdir.rglob("*"):
                if f.is_file() and (f.name.endswith(".mp4") or f.name.endswith(".wav") or "_thumbs" in f.parts or "_text_overlays" in f.parts):
                    total_bytes += f.stat().st_size
    return {
        "cache_mb": round(total_bytes / (1024 * 1024), 2),
        "projects_path": str((TOOLS_DIR.parent / "Projects").resolve()),
        "style_refs_path": str(STYLE_REFS_DIR.resolve()),
        "exports_path": str((TOOLS_DIR.parent / "Projects").resolve()),
    }


@app.post("/api/system/clear-cache")
def api_clear_cache() -> dict[str, Any]:
    freed = 0
    for pdir in (TOOLS_DIR.parent / "Projects").iterdir() if (TOOLS_DIR.parent / "Projects").exists() else []:
        if not pdir.is_dir() or pdir.name in ("Template", "_template"):
            continue
        wdir = pdir / "03_working"
        for sub in ("_thumbs", "_text_overlays"):
            sdir = wdir / sub
            if sdir.exists():
                for f in sdir.rglob("*"):
                    if f.is_file():
                        freed += f.stat().st_size
                shutil.rmtree(sdir, ignore_errors=True)
        for tmp_name in (f"{pdir.name}.remotion_visual.mp4", f"{pdir.name}.render_props.tmp.json"):
            tp = wdir / tmp_name
            if tp.exists():
                freed += tp.stat().st_size
                tp.unlink(missing_ok=True)
    return {"ok": True, "freed_mb": round(freed / (1024 * 1024), 2)}


@app.post("/api/system/open-window")
def api_open_native_window() -> dict[str, Any]:
    from desktop_app import open_native_app_window

    ok = open_native_app_window("http://127.0.0.1:8000")
    return {"ok": True, "native_window": ok}


class OpenFolderReq(BaseModel):
    scope: str = "project"
    file: str = ""


@app.post("/api/projects/{name}/open-folder")
def api_open_project_folder(name: str, req: OpenFolderReq | None = None) -> dict[str, Any]:
    proj_dir = ensure_project(name)
    scope = (req.scope if req else "project").strip().lower()
    req_file = (req.file if req else "").strip()

    if scope == "output":
        out_dir = proj_dir / "05_output" / "tiktok_9x16"
        if not out_dir.exists():
            out_dir = proj_dir / "05_output"
        out_dir.mkdir(parents=True, exist_ok=True)
        reveal_path: Path | None = None
        if req_file:
            safe_name = Path(req_file).name
            cand = out_dir / safe_name
            if cand.exists() and cand.is_file():
                reveal_path = cand
        ok = open_native_folder(out_dir, reveal_file=reveal_path)
        return {"ok": ok, "path": str(reveal_path or out_dir)}

    ok = open_native_folder(proj_dir)
    return {"ok": ok, "path": str(proj_dir)}


@app.post("/api/projects/{name}/auto-fill")
def api_auto_fill(name: str, req: AutoFillReq) -> dict[str, Any]:
    ensure_project(name)

    def task():
        return auto_enhance_project(
            project_name=name,
            fetch_logos=req.fetch_logos,
            generate_broll=req.generate_broll,
            broll_count=req.broll_count,
            extract_demo_broll=req.extract_demo_broll,
            ensure_music=req.ensure_music,
            tts_text=req.tts_text,
            tts_at_sec=req.tts_at_sec,
            tts_voice=req.tts_voice,
        )

    job_id = _start_job(name, "auto_fill_assets_and_broll", task)
    return {"ok": True, "job_id": job_id}


@app.post("/api/projects/{name}/tts")
def api_tts_generate(name: str, req: TtsGenerateReq) -> dict[str, Any]:
    proj_dir = ensure_project(name)
    if req.export_speaker_ref:
        ref_info = extract_speaker_ref_wav(proj_dir, name)
        return {"ok": True, "mode": "speaker_ref", "info": ref_info}
    if not req.text.strip():
        raise HTTPException(400, "Hãy nhập câu thoại cần tạo Voice AI.")
    layers_path = proj_dir / "03_working" / f"{name}.layers.json"
    layers = json.loads(layers_path.read_text(encoding="utf-8")) if layers_path.exists() else {}
    vo_info = generate_tts_voiceover(
        proj_dir,
        text=req.text,
        voice=req.voice,
        rate=req.rate,
        at_sec=req.at_sec,
        layers=layers,
    )
    if layers_path.exists():
        layers_path.write_text(json.dumps(layers, ensure_ascii=False, indent=2), encoding="utf-8")
        build_props_and_layers(name, preserve_user_layers=True)
    return {"ok": True, "mode": "tts_voiceover", "info": vo_info, "voices": AVAILABLE_TTS_VOICES}


@app.get("/api/projects/{name}/media/output/{filename}")
def api_output_video(name: str, filename: str, request: Request):
    proj_dir = ensure_project(name)
    safe_name = Path(filename).name
    target = proj_dir / "05_output" / "tiktok_9x16" / safe_name
    return _range_video_response(target, request)


# ==================== STYLE REFS (_style_refs/ + style-learner) ====================

STYLE_MD_PATH = AGENTS_DIR / "skills" / "style-learner" / "references" / "style.md"


class AnalyzeStyleReq(BaseModel):
    interval_sec: float = 2.0
    whisper_model: str = "small"


class SaveStyleMdReq(BaseModel):
    text: str


@app.get("/api/style-refs")
def api_get_style_refs() -> dict[str, Any]:
    STYLE_REFS_DIR.mkdir(parents=True, exist_ok=True)
    videos = sorted(
        p for p in STYLE_REFS_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in VIDEO_EXTS
    )
    metrics_path = STYLE_REFS_DIR / "_frames" / "style_metrics.json"
    metrics: list[dict[str, Any]] = []
    if metrics_path.exists():
        try:
            metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            metrics = []
    by_file = {m.get("file"): m for m in metrics if isinstance(m, dict)}
    video_items = []
    for vp in videos:
        m = by_file.get(vp.name, {})
        video_items.append({
            "name": vp.name,
            "size_mb": round(vp.stat().st_size / (1024 * 1024), 2),
            "duration_sec": m.get("duration_sec"),
            "resolution": m.get("resolution"),
            "avg_shot_sec": m.get("avg_shot_sec"),
            "words_per_minute": m.get("words_per_minute"),
            "scene_cuts_count": m.get("scene_cuts_count"),
        })
    style_md = STYLE_MD_PATH.read_text(encoding="utf-8") if STYLE_MD_PATH.exists() else ""
    return {
        "dir": "StyleRefs",
        "videos": video_items,
        "metrics": metrics,
        "style_md": style_md,
    }


@app.post("/api/style-refs/upload")
async def api_upload_style_ref(file: UploadFile = File(...)) -> dict[str, Any]:
    STYLE_REFS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = _sanitize_media_filename(file.filename or "ref.mp4", ALLOWED_UPLOAD_EXTS["style_ref"])
    dest = STYLE_REFS_DIR / safe_name
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return {"ok": True, "filename": safe_name, "size": dest.stat().st_size}


@app.delete("/api/style-refs/{filename}")
def api_delete_style_ref(filename: str) -> dict[str, Any]:
    safe_name = Path(filename).name
    target = STYLE_REFS_DIR / safe_name
    if not target.exists():
        raise HTTPException(404, f"Không thấy video mẫu {safe_name}")
    target.unlink()
    return {"ok": True, "deleted": safe_name}


@app.get("/api/style-refs/thumbnail")
def api_style_ref_thumbnail(filename: str = ""):
    safe = Path(filename).name
    src = STYLE_REFS_DIR / safe
    if not safe or not src.exists():
        return FileResponse(str(STATIC_DIR / "favicon.svg"), media_type="image/svg+xml")
    thumbs_dir = STYLE_REFS_DIR / "_frames" / "_thumbs"
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    thumb_key = re.sub(r"[^a-zA-Z0-9_.-]", "_", f"{safe}_{src.stat().st_size}")
    thumb_jpg = thumbs_dir / f"{thumb_key}.jpg"
    if not thumb_jpg.exists():
        import subprocess as _sp

        for seek_sec in ("1.0", "0.1"):
            try:
                _sp.run(
                    [
                        "ffmpeg", "-y", "-v", "error", "-ss", seek_sec,
                        "-i", str(src), "-frames:v", "1", "-vf", "scale=240:-1", "-q:v", "4",
                        str(thumb_jpg),
                    ],
                    check=True,
                    capture_output=True,
                    timeout=8,
                )
                if thumb_jpg.exists() and thumb_jpg.stat().st_size > 200:
                    break
            except Exception:
                pass
    if thumb_jpg.exists() and thumb_jpg.stat().st_size > 200:
        return FileResponse(str(thumb_jpg), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=3600"})
    return FileResponse(str(STATIC_DIR / "favicon.svg"), media_type="image/svg+xml")


@app.post("/api/style-refs/analyze")
def api_analyze_style_refs(req: AnalyzeStyleReq) -> dict[str, Any]:
    def task():
        print("[Style Ref 1/2] Đang quét video trong _style_refs/, tách khung hình 2s & đo nhịp cắt...")
        res = analyze_style_refs(interval_sec=req.interval_sec, whisper_model=req.whisper_model)
        clips = res.get("clips") or []
        if clips and STYLE_MD_PATH.exists():
            avg_shots = [c["avg_shot_sec"] for c in clips if c.get("avg_shot_sec")]
            wpms = [c["words_per_minute"] for c in clips if c.get("words_per_minute")]
            mean_shot = round(sum(avg_shots) / len(avg_shots), 2) if avg_shots else 0
            mean_wpm = round(sum(wpms) / len(wpms), 1) if wpms else 0
            print(f"[Style Ref 2/2] Đã phân tích {len(clips)} clip · Nhịp cắt TB={mean_shot}s/cảnh · Tốc độ nói TB={mean_wpm} từ/phút.")
        else:
            print("[Style Ref 2/2] Chưa có video mẫu trong _style_refs/.")
        return res

    job_id = _start_job("_style_refs", "style_extract", task)
    return {"ok": True, "job_id": job_id}


@app.post("/api/style-refs/save-style")
def api_save_style_md(req: SaveStyleMdReq) -> dict[str, Any]:
    STYLE_MD_PATH.parent.mkdir(parents=True, exist_ok=True)
    STYLE_MD_PATH.write_text(req.text, encoding="utf-8")
    return {"ok": True}


@app.post("/api/style-refs/open-folder")
def api_open_style_refs_folder() -> dict[str, Any]:
    STYLE_REFS_DIR.mkdir(parents=True, exist_ok=True)
    ok = open_native_folder(STYLE_REFS_DIR)
    return {"ok": ok, "path": str(STYLE_REFS_DIR)}


def _is_port_open(host: str, port: int) -> bool:
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex((host, port)) == 0


if __name__ == "__main__":
    import logging
    import uvicorn
    import webbrowser

    class _QuietJobsPollFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            return "/api/jobs/" not in record.getMessage()

    logging.getLogger("uvicorn.access").addFilter(_QuietJobsPollFilter())

    host, port = "127.0.0.1", 8000
    url = f"http://{host}:{port}"
    no_browser = "--no-browser" in sys.argv

    if _is_port_open(host, port):
        print(f"[anthinh Studio] Server đang chạy sẵn tại {url}")
        if not no_browser:
            webbrowser.open(url)
        sys.exit(0)

    if not no_browser:
        from desktop_app import open_native_app_window

        def _open_when_ready() -> None:
            for _ in range(30):
                if _is_port_open(host, port):
                    open_native_app_window(url)
                    return
                time.sleep(0.25)

        threading.Thread(target=_open_when_ready, daemon=True).start()

    print(f"[WishEdit] Đang khởi động tại {url} ...")
    uvicorn.run(app, host=host, port=port)
