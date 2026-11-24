"""Auto-fetch brand logos, generate visual B-roll filler cards (Pillow),
synthesize Vietnamese neural TTS voice-overs (edge-tts), and export speaker ref for BetterBox-TTS / OmniVoice.
"""

from __future__ import annotations

import asyncio
import json
import re
import subprocess
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from ai_client import analyze_content_and_source_gaps, load_project_brief
from common import TEMPLATE_DIR, ensure_project, ffprobe_json, find_raw_videos, refresh_windows_path, sha256_text
from edl_utils import EdlRow, read_edl
from remotion_props import BRAND_CUES, build_props_and_layers

BRAND_DOMAINS: dict[str, tuple[str, str, tuple[int, int, int]]] = {
    "tiktok": ("tiktok.com", "TikTok", (15, 23, 42)),
    "tiktokshop": ("seller-vn.tiktok.com", "TikTok Shop", (249, 115, 22)),
    "shopee": ("shopee.vn", "Shopee", (238, 77, 45)),
    "lazada": ("lazada.vn", "Lazada", (15, 20, 109)),
    "google": ("google.com", "Google", (37, 99, 235)),
    "notebooklm": ("notebooklm.google", "NotebookLM", (14, 165, 233)),
    "chatgpt": ("chatgpt.com", "ChatGPT", (16, 163, 127)),
    "openai": ("openai.com", "OpenAI", (16, 163, 127)),
    "claude": ("claude.ai", "Claude AI", (217, 119, 87)),
    "gemini": ("gemini.google.com", "Google Gemini", (59, 130, 246)),
    "capcut": ("capcut.com", "CapCut", (15, 23, 42)),
    "canva": ("canva.com", "Canva", (124, 58, 237)),
    "facebook": ("facebook.com", "Facebook", (24, 119, 242)),
    "youtube": ("youtube.com", "YouTube", (220, 38, 38)),
    "zalo": ("zalo.me", "Zalo", (0, 104, 255)),
}

AVAILABLE_TTS_VOICES = [
    {"id": "vi-VN-NamMinhNeural", "name": "Nam Minh (Nam · Thực chiến, nhanh gọn)", "engine": "edge-tts"},
    {"id": "vi-VN-HoaiMyNeural", "name": "Hoài My (Nữ · Tự nhiên, rõ nét)", "engine": "edge-tts"},
]


def _load_font(proj_dir: Path, weight: str = "ExtraBold", size: int = 36) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for base in (proj_dir / "04_assets" / "fonts", TEMPLATE_DIR / "04_assets" / "fonts"):
        cand = base / f"BeVietnamPro-{weight}.ttf"
        if cand.exists():
            try:
                return ImageFont.truetype(str(cand), size=size)
            except Exception:
                pass
    return ImageFont.load_default()


def _render_fallback_logo_png(out_png: Path, label: str, rgb: tuple[int, int, int], proj_dir: Path) -> Path:
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([(4, 4), (124, 124)], radius=28, fill=(*rgb, 255), outline=(56, 189, 248, 255), width=4)
    font = _load_font(proj_dir, "Black", 48)
    initials = "".join(w[0] for w in label.split()[:2]).upper() or "AI"
    bbox = draw.textbbox((0, 0), initials, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((128 - tw) / 2, (128 - th) / 2 - 4), initials, fill=(255, 255, 255, 255), font=font)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_png, format="PNG")
    return out_png


def fetch_brand_logos(project_dir: Path, rows: list[EdlRow], layers: dict[str, Any]) -> list[str]:
    """Download brand logos ONLY for badges explicitly configured in layers['logoBadges']."""
    logo_dir = project_dir / "04_assets" / "logo"
    logo_dir.mkdir(parents=True, exist_ok=True)

    detected_brands: set[str] = set()
    for lb in layers.get("logoBadges", []):
        b = re.sub(r"^(logo_)+", "", str(lb.get("brand", "")).lower().strip())
        if b and b != "tiktokshop":
            lb["brand"] = b
            detected_brands.add(b)

    if not detected_brands:
        return []

    fetched_files: list[str] = []
    for brand in sorted(detected_brands):
        domain, display_name, color_rgb = BRAND_DOMAINS.get(brand, ("google.com", brand.upper(), (37, 99, 235)))
        out_png = logo_dir / f"logo_{brand}.png"
        if not out_png.exists() or out_png.stat().st_size < 200:
            url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    raw_bytes = resp.read()
                if len(raw_bytes) >= 200:
                    out_png.write_bytes(raw_bytes)
                else:
                    _render_fallback_logo_png(out_png, display_name, color_rgb, project_dir)
            except Exception:
                _render_fallback_logo_png(out_png, display_name, color_rgb, project_dir)
        fetched_files.append(out_png.name)

    # Gắn file logo thật vào các logoBadges trong layers
    for lb in layers.get("logoBadges", []):
        b = str(lb.get("brand", "")).lower().strip()
        cand = logo_dir / f"logo_{b}.png"
        if cand.exists():
            lb["src"] = cand.name
    return fetched_files


def _draw_visual_card_png(
    proj_dir: Path,
    out_path: Path,
    badge_text: str,
    headline: str,
    subline: str,
    step_num: int,
    logo_path: Path | None = None,
) -> Path:
    """Render a sleek compact 860x186 floating glass callout banner (keeps speaker face clean)."""
    w, h = 860, 186
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Outer sleek dark-glass pill/card with translucent backdrop
    draw.rounded_rectangle([(4, 4), (w - 4, h - 4)], radius=26, fill=(10, 15, 28, 228), outline=(56, 189, 248, 220), width=3)
    # Left cyan vertical accent bar
    draw.rounded_rectangle([(20, 24), (28, h - 24)], radius=4, fill=(56, 189, 248, 255))

    font_badge = _load_font(proj_dir, "Bold", 18)
    font_head = _load_font(proj_dir, "Black", 34)
    font_sub = _load_font(proj_dir, "Medium", 22)
    font_num = _load_font(proj_dir, "Black", 28)

    # Step number square badge
    draw.rounded_rectangle([(46, 30), (104, 88)], radius=16, fill=(14, 165, 233, 255))
    draw.text((58, 41), f"#{step_num}", fill=(9, 9, 11, 255), font=font_num)

    # Topic eyebrow badge
    draw.text((124, 30), badge_text.upper(), fill=(56, 189, 248, 255), font=font_badge)

    if logo_path and logo_path.exists():
        try:
            lg = Image.open(logo_path).convert("RGBA").resize((46, 46))
            img.paste(lg, (w - 72, 24), lg)
        except Exception:
            pass

    # Clean single-line headline
    head_clean = headline.upper()
    if len(head_clean) > 32:
        head_clean = head_clean[:30].rsplit(" ", 1)[0] + "..."
    draw.text((124, 58), head_clean, fill=(255, 255, 255, 255), font=font_head)

    # Compact takeaway subline at bottom
    sub_clean = subline.strip()
    if len(sub_clean) > 64:
        sub_clean = sub_clean[:61].rsplit(" ", 1)[0] + "..."
    draw.text((46, 124), sub_clean, fill=(203, 213, 225, 255), font=font_sub)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")
    return out_path


_FILLER_LEAD_PHRASES = (
    r"đó là lý do tại sao mà", r"đó là lý do tại sao",
    r"nhưng mà cái con này cảm giác là", r"nhưng mà cái con này",
    r"mỗi lần tự nhiên tôi thấy", r"thứ nhất đó là đến từ",
    r"tại vì anh em có biết mà", r"nhưng mà", r"thì thật ra là", r"thật ra là",
    r"ví dụ như khi mình", r"ví dụ như", r"nói thật là", r"nói chung là",
    r"con này tôi thấy", r"đấy thì anh em cứ", r"đấy thì", r"thì con này là",
    r"khi các bạn mới", r"khi các bạn", r"khi anh em", r"khi mình",
    r"anh em có thể", r"các bạn có thể", r"anh em nhớ", r"các bạn nhớ",
    r"bước tiếp theo", r"nên là", r"vậy nên", r"còn nếu", r"mà tôi dùng",
    r"mà con này", r"tôi thấy", r"có bị", r"nó không có bị", r"nó không bị",
    r"thì", r"rất là", r"là", r"và", r"mà",
)
_FILLER_LEAD_RE = re.compile(
    r"^(?:" + "|".join(_FILLER_LEAD_PHRASES) + r")\s+",
    flags=re.IGNORECASE,
)
_WEAK_HEADLINE_WORDS = {
    "thì", "là", "mà", "và", "nhưng", "hoặc", "nên", "vì", "do", "bởi", "khi",
    "nếu", "để", "cho", "với", "tại", "từ", "về", "trong", "ngoài", "trên", "dưới",
    "cái", "con", "chiếc", "những", "các", "một", "vài", "nhiều", "bị", "được",
    "tôi", "mình", "bạn", "anh", "em", "họ", "nó", "ta", "người", "này", "đó", "kia",
    "nha", "nhé", "ha", "ạ", "vậy", "sao", "thật", "ra", "nhớ", "cần", "phải",
    "mới", "đang", "sẽ", "đã", "cũng", "vẫn", "cứ", "rất", "quá", "hơi", "chỉ",
}


def _distill_punchy_callout(text: str, step_idx: int) -> tuple[str, str]:
    """Convert raw conversational ASR line into a commercial 3-6 word headline + clean takeaway subline."""
    raw = re.sub(r"\s+", " ", text).strip(" ,.;:")
    low = raw.lower()

    # 1. Keyword-distilled semantic rules (short, punchy, commercial quality)
    semantic_rules: list[tuple[tuple[str, ...], str, str]] = [
        (("kindle", "bỏ túi", "nhỏ hơn"), "SIÊU NHỎ GỌN BỎ TÚI", "Nhỏ hơn Kindle · Dễ dàng mang đi mọi nơi"),
        (("xteink",), "MÁY ĐỌC SÁCH XTEINK", "Thiết kế tối giản · Bỏ túi gọn nhẹ"),
        (("ngả vàng", "e-ink trắng"), "MÀN HÌNH E-INK TRẮNG NÉT", "Không bị ngả vàng · Đọc êm mắt như giấy"),
        (("e-ink", "4 inch", "màn hình"), "MÀN HÌNH E-INK 4 INCH", "Hiển thị sắc nét · Đọc chữ cực rõ"),
        (("3 lần", "pin", "sạc", "cuốn sách"), "PIN TRÂU · SẠC 3 LẦN / 3 CUỐN", "Dùng nhiều tháng mới sạc · Cổng Type-C"),
        (("iphone", "vô hình", "55g", "hít"), "CẦM VỚI IPHONE NHƯ VÔ HÌNH", "Mỏng nhẹ chỉ 55g · Hít MagSafe chắc chắn"),
        (("phím cứng", "trôi trang", "cảm ứng"), "PHÍM CỨNG CHỐNG TRÔI TRANG", "Chuyển trang chính xác · Không bị cấn tay"),
        (("1 tay", "gọn nhẹ", "cầm"), "NHẸ NHÀNG CẦM ĐỌC 1 TAY", "Thoải mái đọc sách mọi lúc mọi nơi"),
        (("notebooklm", "bộ nhớ"), "BỘ NHỚ AI KHÔNG GIỚI HẠN", "Tổng hợp tài liệu chuẩn · Không tự bịa số"),
        (("ugc", "miễn phí", "đầu tiên"), "TÌM UGC CHI PHÍ 0 ĐỒNG", "Quy trình kết nối creator thực chiến"),
        (("3 giây", "hook"), "MỞ ĐẦU HOOK 3 GIÂY ĐẦU", "Giữ chân người xem ngay khi lướt qua"),
        (("bước 1",), "BƯỚC 1 · THIẾT LẬP CƠ BẢN", "Chuẩn hóa đầu vào để tăng chuyển đổi"),
        (("bước 2",), "BƯỚC 2 · TỐI ƯU VẬN HÀNH", "Áp dụng ngay vào quy trình thực tế"),
        (("bước 3",), "BƯỚC 3 · TỔNG KẾT & CHỐT Ý", "Kiểm tra lại trước khi xuất bản"),
    ]
    for cues, head, sub in semantic_rules:
        if any(c in low for c in cues):
            return head, sub

    # 2. Universal multi-pass cleaner for ANY topic (TMĐT, AI, SaaS, Vlog, Review)
    cleaned = raw
    for _ in range(5):
        nxt = _FILLER_LEAD_RE.sub("", cleaned).strip(" ,.;:")
        if nxt == cleaned or len(nxt.split()) < 3:
            break
        cleaned = nxt

    raw_tokens = [w.strip(".,!?;:") for w in cleaned.split() if w.strip(".,!?;:")]
    # Distill key meaningful nouns, verbs, brands, and metrics instead of leading pronouns/fillers
    meaningful = [w for w in raw_tokens if w.lower() not in _WEAK_HEADLINE_WORDS or any(ch.isdigit() for ch in w)]
    if len(meaningful) >= 3:
        head_words = meaningful[:6]
    else:
        head_words = raw_tokens[:5]
    headline = " ".join(head_words).upper() if head_words else f"ĐIỂM NHẤN #{step_idx}"

    # Clean complete takeaway subline
    sub_clean = cleaned if len(cleaned) >= 10 else raw
    if sub_clean:
        sub_clean = sub_clean[0].upper() + sub_clean[1:]
    if len(sub_clean) > 64:
        sub_clean = sub_clean[:61].rsplit(" ", 1)[0] + "..."
    return headline, sub_clean


def extract_self_broll_from_raw(
    project_dir: Path,
    rows: list[EdlRow],
    props: dict[str, Any],
    layers: dict[str, Any],
    max_clips: int = 2,
) -> list[dict[str, Any]]:
    """Automatically extract 2-3s silent close-up demo clips from dropped product moments in 01_raw/."""
    refresh_windows_path()
    fps = int(props.get("fps", 30))
    speed = float(layers.get("video", {}).get("speechSpeed", 1.08))
    broll_dir = project_dir / "04_assets" / "broll"
    broll_dir.mkdir(parents=True, exist_ok=True)

    # Clear old auto-extracted demo b-rolls
    layers["broll"] = [b for b in layers.get("broll", []) if not str(b.get("id", "")).startswith("BR_DEMO_")]

    ingest_path = project_dir / "03_working" / f"{project_dir.name}.ingest.json"
    src_video: Path | None = None
    if ingest_path.exists():
        from common import resolve_portable_path

        cand = resolve_portable_path(project_dir, json.loads(ingest_path.read_text(encoding="utf-8")).get("work_video", ""), "03_working")
        if cand.exists():
            src_video = cand
    if src_video is None:
        raws = find_raw_videos(project_dir)
        src_video = raws[0] if raws else None
    if src_video is None or not src_video.exists():
        return []

    # Check if user already placed custom video B-rolls manually -> prioritize those instead
    manual_videos = [
        p for p in sorted(broll_dir.iterdir())
        if p.is_file() and p.suffix.lower() in {".mp4", ".mov", ".mkv", ".webm"} and not p.name.startswith("ai_demo_broll_")
    ]
    kept_rows = [r for r in rows if r.keep == 1]
    dropped_rows = [r for r in rows if r.keep == 0 and r.duration >= 1.6]
    if not kept_rows:
        return []

    demo_cues = (
        "ví dụ", "nhìn nè", "xem nè", "đây nè", "trên này", "giao diện", "màn hình",
        "thao tác", "bấm vào", "mở lên", "sản phẩm", "kết quả", "test thử", "trên tay",
        "so sánh", "iphone", "đặt lên", "bằng 1 nửa", "hít", "phím cứng", "bên cạnh", "type-c", "55g",
    )
    demo_sources = [r for r in dropped_rows if any(c in r.text.lower() for c in demo_cues)]
    if not demo_sources and not manual_videos:
        return []

    manual_tokens = {
        tok
        for mv in manual_videos
        for tok in re.split(r"[^a-zA-Z0-9À-ỹ]+", mv.stem.lower())
        if len(tok) >= 3
    }
    visual_slot_cues = (
        "ví dụ", "giao diện", "màn hình", "sản phẩm", "thực tế", "thao tác", "bấm", "bước",
        "kết quả", "so sánh", "cầm", "nhỏ", "bỏ túi", "pin", "sạc", "iphone", "hít", "e-ink", "phím",
    )

    # Pick kept voiceover windows after hook (>= 4.5s and before last 4s CTA) for cutaway B-roll
    total_out_sec = sum(r.duration / speed for r in kept_rows)
    target_slots: list[tuple[int, int, str]] = []
    fallback_slots: list[tuple[int, int, str]] = []
    acc = 0.0
    for r in kept_rows:
        dur = r.duration / speed
        s0, s1 = acc, acc + dur
        acc = s1
        if s0 < 4.5 or s0 > max(8.0, total_out_sec - 5.0):
            continue
        f0 = int(round(s0 * fps))
        f1 = min(int(round(s1 * fps)), f0 + int(2.6 * fps))
        if f1 - f0 < 42:
            continue
        low = r.text.lower()
        if any(tok in low for tok in manual_tokens) or any(k in low for k in visual_slot_cues):
            if not target_slots or (f0 - target_slots[-1][1]) >= 180:
                target_slots.append((f0, f1, r.text))
                if len(target_slots) >= max_clips:
                    break
        elif not fallback_slots or (f0 - fallback_slots[-1][1]) >= 210:
            fallback_slots.append((f0, f1, r.text))

    while len(target_slots) < min(max_clips, max(len(manual_videos), len(demo_sources))) and fallback_slots:
        cand_slot = fallback_slots.pop(0)
        if not any(abs(cand_slot[0] - s[0]) < 150 for s in target_slots):
            target_slots.append(cand_slot)
    target_slots.sort(key=lambda x: x[0])

    added: list[dict[str, Any]] = []
    for idx, (f0, f1, match_txt) in enumerate(target_slots, start=1):
        clip_dur = max(1.8, (f1 - f0) / fps)
        if idx - 1 < len(manual_videos):
            use_name = manual_videos[idx - 1].name
        elif idx - 1 < len(demo_sources):
            src_seg = demo_sources[idx - 1]
            clip_name = f"ai_demo_broll_{idx:02d}.mp4"
            clip_out = broll_dir / clip_name
            # Crop 1.24x slightly below top edge to emphasize hands & product demonstration!
            subprocess.run(
                [
                    "ffmpeg", "-y", "-v", "error",
                    "-ss", f"{src_seg.start:.2f}",
                    "-t", f"{clip_dur + 0.3:.2f}",
                    "-i", str(src_video),
                    "-an",
                    "-vf", "fps=30,crop=iw/1.24:ih/1.24:(iw-ow)/2:(ih-oh)*0.62,scale=1080:1920:flags=lanczos",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p",
                    str(clip_out),
                ],
                check=True,
                capture_output=True,
            )
            use_name = clip_name
        else:
            break

        item = {
            "id": f"BR_DEMO_{idx}",
            "src": use_name,
            "mediaType": "video",
            "layout": "full",
            "caption": "CẬN CẢNH THỰC TẾ",
            "startFrame": f0,
            "endFrame": f1,
        }
        layers.setdefault("broll", []).append(item)
        added.append(item)

    if added:
        layers["broll_edited"] = True
    return added


def generate_visual_filler_cards(
    project_dir: Path,
    rows: list[EdlRow],
    props: dict[str, Any],
    layers: dict[str, Any],
    max_cards: int = 3,
) -> list[dict[str, Any]]:
    """Auto-generate crisp keyword-distilled B-roll cards (0..5) spaced cleanly across the video."""
    fps = int(props.get("fps", 30))
    speed = float(layers.get("video", {}).get("speechSpeed", 1.1))
    broll_dir = project_dir / "04_assets" / "broll"
    logo_dir = project_dir / "04_assets" / "logo"
    broll_dir.mkdir(parents=True, exist_ok=True)

    # Clear old auto-generated card items so new broll_count takes effect cleanly
    for old_png in broll_dir.glob("ai_broll_card_*.png"):
        old_png.unlink(missing_ok=True)
    preserved_broll = [b for b in layers.get("broll", []) if not str(b.get("id", "")).startswith("BR_AI_")]

    if max_cards <= 0:
        layers["broll"] = preserved_broll
        layers["broll_edited"] = bool(preserved_broll)
        return []

    logos = sorted(logo_dir.glob("*.png"))
    default_logo = logos[0] if logos else None

    occupied: list[tuple[int, int]] = []
    for it in preserved_broll + list(layers.get("darkScenes", [])):
        occupied.append((int(it.get("startFrame", 0)), int(it.get("endFrame", 0))))

    def _is_free(f0: int, f1: int) -> bool:
        return not any(o0 < f1 and o1 > f0 for o0, o1 in occupied)

    kept_rows = [r for r in rows if r.keep == 1]
    total_sec = sum(r.duration / speed for r in kept_rows)
    min_gap_sec = max(5.5, (total_sec - 6.0) / max(1, max_cards))

    acc_sec = 0.0
    last_cut_sec = 2.8  # Sau Hook 3s đầu
    created_cards: list[dict[str, Any]] = []
    step_idx = 1

    full_low = " ".join(r.text.lower() for r in kept_rows)
    is_review = any(k in full_low for k in ("review", "máy đọc sách", "kindle", "trải nghiệm", "sản phẩm", "pin", "màn hình"))
    badge_prefix = "ĐIỂM NỔI BẬT · Ý" if is_review else "THỰC CHIẾN TMĐT · Ý"

    for r in kept_rows:
        dur = r.duration / speed
        seg_start = acc_sec
        seg_end = acc_sec + dur
        acc_sec = seg_end

        if seg_start < 3.4 or seg_start > max(8.0, total_sec - 3.8):
            continue
        if (seg_end - last_cut_sec) < min_gap_sec:
            continue
        if len(r.text.split()) < 4:
            continue

        f0 = int(round(seg_start * fps))
        f1 = min(int(round(seg_end * fps)), f0 + int(2.6 * fps))
        if f1 - f0 < 36 or not _is_free(f0, f1):
            continue

        headline, subline = _distill_punchy_callout(r.text, step_idx)
        fname = f"ai_broll_card_{step_idx:02d}.png"
        out_png = broll_dir / fname
        _draw_visual_card_png(
            proj_dir=project_dir,
            out_path=out_png,
            badge_text=f"{badge_prefix} {step_idx}",
            headline=headline,
            subline=subline,
            step_num=step_idx,
            logo_path=default_logo if not is_review else None,
        )
        card_item = {
            "id": f"BR_AI_{step_idx}",
            "src": fname,
            "mediaType": "image",
            "layout": "pip_top",
            "caption": headline,
            "startFrame": f0,
            "endFrame": f1,
        }
        preserved_broll.append(card_item)
        created_cards.append(card_item)
        occupied.append((f0, f1))
        last_cut_sec = seg_end
        step_idx += 1
        if len(created_cards) >= max_cards:
            break

    layers["broll"] = preserved_broll
    layers["broll_edited"] = True
    return created_cards


def ensure_default_upbeat_music(project_dir: Path, layers: dict[str, Any]) -> str:
    """Create a clean, royalty-free warm ambient beat in 04_assets/music/ if folder is empty."""
    refresh_windows_path()
    music_dir = project_dir / "04_assets" / "music"
    music_dir.mkdir(parents=True, exist_ok=True)
    existing = [p.name for p in music_dir.iterdir() if p.is_file() and p.name != ".gitkeep"]
    if existing:
        if not layers.get("audio", {}).get("musicFile"):
            layers.setdefault("audio", {})["musicFile"] = existing[0]
        return existing[0]

    out_wav = music_dir / "wishedit_upbeat_pulse.wav"
    # Tạo hợp âm ambient lo-fi ấm nhẹ sạch bản quyền (tần số trầm ấm 98/147/196Hz lọc dịu 320Hz)
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", "sine=frequency=98:duration=30,volume=0.14",
            "-f", "lavfi",
            "-i", "sine=frequency=146.83:duration=30,tremolo=f=1.8:d=0.35,volume=0.09",
            "-f", "lavfi",
            "-i", "sine=frequency=196:duration=30,tremolo=f=0.9:d=0.45,volume=0.06",
            "-filter_complex", "[0:a][1:a][2:a]amix=inputs=3:duration=first,lowpass=f=320,aresample=48000,aformat=channel_layouts=stereo",
            str(out_wav),
        ],
        check=True,
        capture_output=True,
    )
    layers.setdefault("audio", {})["musicFile"] = out_wav.name
    layers["audio"]["musicDb"] = -27.0
    return out_wav.name


async def _edge_tts_save(text: str, voice: str, rate: str, out_mp3: Path) -> None:
    import edge_tts

    comm = edge_tts.Communicate(text=text, voice=voice, rate=rate)
    await comm.save(str(out_mp3))


def generate_tts_voiceover(
    project_dir: Path,
    text: str,
    voice: str = "vi-VN-NamMinhNeural",
    rate: str = "+12%",
    at_sec: float = 0.0,
    layers: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate Vietnamese neural TTS voice-over (.wav) via edge-tts and optionally attach at timestamp."""
    refresh_windows_path()
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Nội dung văn bản TTS không được để trống.")

    sfx_dir = project_dir / "04_assets" / "sfx"
    sfx_dir.mkdir(parents=True, exist_ok=True)
    short_hash = sha256_text(f"{clean_text}|{voice}|{rate}")[:8]
    mp3_path = project_dir / "03_working" / f"tts_{short_hash}.mp3"
    wav_name = f"vo_ai_{short_hash}.wav"
    wav_path = sfx_dir / wav_name

    asyncio.run(_edge_tts_save(clean_text, voice, rate, mp3_path))
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(mp3_path),
            "-af", "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,loudnorm=I=-14:TP=-1.5:LRA=9",
            "-ar", "48000", "-ac", "2",
            str(wav_path),
        ],
        check=True,
        capture_output=True,
    )
    dur = float(ffprobe_json(wav_path).get("format", {}).get("duration", 0.0) or 0.0)

    if layers is not None:
        vo_list = list(layers.get("voiceoverEvents", []))
        vo_list.append({
            "id": f"VO_{short_hash[:4]}",
            "text": clean_text,
            "voice": voice,
            "file": wav_name,
            "startFrame": max(0, int(round(at_sec * 30))),
            "durationSec": round(dur, 2),
        })
        layers["voiceoverEvents"] = vo_list

    return {
        "filename": wav_name,
        "path": str(wav_path),
        "duration_sec": round(dur, 2),
        "voice": voice,
        "text": clean_text,
    }


def extract_speaker_ref_wav(project_dir: Path, project_name: str, duration_sec: float = 22.0) -> dict[str, Any]:
    """Extract a clean 22s speaker reference WAV from project footage for BetterBox-TTS / OmniVoice cloning."""
    refresh_windows_path()
    candidates: list[Path] = []
    ingest_path = project_dir / "03_working" / f"{project_name}.ingest.json"
    if ingest_path.exists():
        try:
            ing = json.loads(ingest_path.read_text(encoding="utf-8"))
            if ing.get("audio_wav"):
                candidates.append(Path(ing["audio_wav"]))
            if ing.get("work_video"):
                candidates.append(Path(ing["work_video"]))
        except Exception:
            pass
    candidates.append(project_dir / "03_working" / f"{project_name}.base_cuts.mp4")
    candidates.extend(find_raw_videos(project_dir))
    src = next((p for p in candidates if p.exists()), None)
    if src is None:
        raise FileNotFoundError("Chưa có audio/video nguồn để trích mẫu giọng.")

    out_ref = project_dir / "03_working" / f"{project_name}_speaker_ref_22s.wav"
    subprocess.run(
        [
            "ffmpeg", "-y", "-ss", "2.0", "-t", f"{duration_sec:.1f}", "-i", str(src),
            "-af", "highpass=f=85,lowpass=f=13000,afftdn=nr=12:nf=-32:tn=1,silenceremove=stop_periods=-1:stop_duration=0.4:stop_threshold=-42dB,loudnorm=I=-16:TP=-1.5:LRA=9",
            "-ar", "24000", "-ac", "1",
            str(out_ref),
        ],
        check=True,
        capture_output=True,
    )
    dur = float(ffprobe_json(out_ref).get("format", {}).get("duration", 0.0) or 0.0)
    return {
        "ref_wav": str(out_ref),
        "filename": out_ref.name,
        "duration_sec": round(dur, 2),
        "compatible_with": ["BetterBox-TTS (Viterbox/Chatterbox <= 80s)", "k2-fsa/OmniVoice Zero-Shot", "F5-TTS-Vietnamese"],
    }


def auto_enhance_project(
    project_name: str,
    fetch_logos: bool = False,
    generate_broll: bool = True,
    broll_count: int = 3,
    extract_demo_broll: bool = True,
    ensure_music: bool = True,
    tts_text: str = "",
    tts_at_sec: float = 0.0,
    tts_voice: str = "vi-VN-NamMinhNeural",
) -> dict[str, Any]:
    """One-click AI/Code Auto-Filler: extracts demo close-up B-rolls, creates 0-5 keyword cards & music (no stray logos)."""
    proj_dir = ensure_project(project_name)
    work_edl = proj_dir / "03_working" / f"{project_name}.edl.tsv"
    final_edl = proj_dir / "03_working" / f"{project_name}.edl.final.tsv"
    active_edl = work_edl if work_edl.exists() else final_edl
    rows = read_edl(active_edl) if active_edl.exists() else []

    props = build_props_and_layers(project_name, edl_path=active_edl, preserve_user_layers=True)
    layers_path = proj_dir / "03_working" / f"{project_name}.layers.json"
    layers = json.loads(layers_path.read_text(encoding="utf-8"))
    layers["logoBadges"] = [
        lb for lb in layers.get("logoBadges", [])
        if lb.get("src") != "logo_tiktokshop.png" and lb.get("brand") != "tiktokshop"
    ]

    logos_fetched: list[str] = []
    if fetch_logos:
        logos_fetched = fetch_brand_logos(proj_dir, rows, layers)

    demo_brolls: list[dict[str, Any]] = []
    if generate_broll and extract_demo_broll and rows:
        demo_brolls = extract_self_broll_from_raw(proj_dir, rows, props, layers, max_clips=2)

    cards_created: list[dict[str, Any]] = []
    if generate_broll and rows:
        cards_created = generate_visual_filler_cards(
            proj_dir, rows, props, layers, max_cards=max(0, min(5, int(broll_count)))
        )

    music_file = ""
    if ensure_music:
        music_file = ensure_default_upbeat_music(proj_dir, layers)

    tts_info = None
    if tts_text.strip():
        tts_info = generate_tts_voiceover(
            proj_dir,
            text=tts_text,
            voice=tts_voice,
            at_sec=tts_at_sec,
            layers=layers,
        )

    layers_path.write_text(json.dumps(layers, ensure_ascii=False, indent=2), encoding="utf-8")
    new_props = build_props_and_layers(project_name, edl_path=active_edl, preserve_user_layers=True)
    gaps = analyze_content_and_source_gaps(proj_dir, rows, props=new_props, brief_data=load_project_brief(proj_dir))

    return {
        "project": project_name,
        "logos_fetched": logos_fetched,
        "demo_broll_extracted": [d["src"] for d in demo_brolls],
        "broll_cards_generated": [c["src"] for c in cards_created],
        "music_file": music_file,
        "tts_generated": tts_info,
        "remaining_gaps": gaps["gap_count"],
    }
