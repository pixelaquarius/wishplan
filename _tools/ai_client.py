"""Watchlist scanner (code-only), .env optional LLM config, and zero-key smart local heuristics."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable

from common import AGENTS_DIR, PROMPTS_DIR, sha256_text
from edl_utils import EdlRow

TOOLS_DIR = Path(__file__).resolve().parent
ENV_FILE = TOOLS_DIR / ".env"
WATCHLIST_PATH = AGENTS_DIR / "skills" / "content-claims-check" / "references" / "watchlist.md"

_CLAIM_REPLACEMENTS: list[tuple[str, str]] = [
    (r"\bchắc chắn ra đơn\b", "hỗ trợ cải thiện tỷ lệ ra đơn"),
    (r"\bchắc chắn thành công\b", "tăng cơ hội hiệu quả"),
    (r"\bchắc chắn\b", "khả năng cao"),
    (r"\bcam kết\s*100%\b", "ưu tiên tối đa"),
    (r"\bcam kết\b", "ưu tiên"),
    (r"\bđảm bảo\s*100%\b", "hỗ trợ tốt"),
    (r"\bđảm bảo\b", "hỗ trợ"),
    (r"\b100%(?!\w)", "tỷ lệ cao"),
    (r"\btuyệt đối\b", "hạn chế rủi ro"),
    (r"\bbùng nổ doanh số\b", "cải thiện kết quả ổn định"),
    (r"\bkiếm trăm triệu\b", "tối ưu hiệu quả thực tế"),
    (r"\bchỉ 1 click\b", "thao tác gọn trong vài bước"),
    (r"\btừ lúc tôi mua\b", "từ lúc tôi dùng"),
    (r"\blúc tôi mua\b", "lúc tôi dùng"),
    (r"\bkhi mua\b", "khi sở hữu"),
    (r"\bmua ngay\b", "tham khảo ngay"),
    (r"\bđi mua\b", "tìm hiểu"),
    (r"\bbuôn bán\b", "chia sẻ"),
    (r"\bbán hàng\b", "vận hành"),
    (r"\bgiá rẻ nhất\b", "chi phí hợp lý"),
    (r"\bgiá rẻ\b", "mức hợp lý"),
    (r"\bgiá cả\b", "chi phí"),
    (r"\bbao nhiêu tiền\b", "mức chi phí thế nào"),
    (r"\bchốt đơn\b", "tham khảo"),
    (r"\bcứ chốt\b", "cứ tham khảo"),
    (r"\bchốt ha\b", "tham khảo ha"),
    (r"\bgiỏ hàng\b", "phần mô tả"),
    (r"\bđặt hàng\b", "đăng ký"),
    (r"\binbox\s+zalo\b", "nhắn bình luận"),
    (r"\bchuyển khoản ngoài\b", "thanh toán chuẩn"),
]

_HARD_TRAFFIC_DROP_PATTERNS: list[tuple[str, str]] = [
    (r"\bđiên\s+khùng\b", "policy_offensive_hook"),
    (r"\b(?:cứ|nên)\s+chốt(?:\s+ha)?\b", "traffic_sales_cta"),
    (r"\bbấm\s+vào\s+giỏ\s+hàng\b", "traffic_sales_cta"),
    (r"\bmua\s+ngay\s+ở\s+giỏ\b", "traffic_sales_cta"),
    (r"\binbox\s+zalo\b", "policy_offplatform_redirect"),
    (r"\bchuyển\s+khoản\s+ngoài\b", "policy_offplatform_redirect"),
    (r"\blách\s+(?:luật|thuế)\b", "policy_violation"),
    (r"\bbuff\s+đơn\b", "policy_violation"),
]

_HOOK_CUES = (
    "?", "lỗi", "sai lầm", "mất đơn", "bí quyết", "tại sao", "đừng",
    "cách", "không có điều kiện", "miễn phí", "nhỏ nhất thế giới", "có đọc được không", "gần như",
)
_VALUE_CUES = (
    "google", "notebook", "chatgpt", "gemini", "sản phẩm", "chiến dịch",
    "khách hàng", "bước", "hướng dẫn", "ví dụ", "bộ nhớ", "doanh nghiệp",
    "màn hình", "e-ink", "kindle", "iphone", "pin", "nhẹ", "mỏng", "inch", "phím cứng", "giải pháp", "xteink", "55g", "type-c",
)
_CTA_CUES = ("cmt", "comment", "nhắn", "lưu video", "follow", "thử liền", "giải đáp", "đặt câu hỏi", "trải nghiệm")
_INTRO_LEAD_CUES = ("cùng theo tôi", "theo chân tôi", "sẽ review cho", "cùng mình tìm hiểu", "cùng mình tìm thử")
_FLUFF_CUES = ("nãy giờ", "nói hơi nhiều", "làm gì đó mà", "cái đó đó")
_ANTECEDENT_STARTS = (
    "nhưng", "nhưng mà", "cái con này", "con này", "nó ", "vậy nên",
    "đó là lý do", "tuy nhiên", "bởi vậy", "cho nên", "vì thế", "tôi không thể",
)
_INCOMPLETE_END_WORDS = {
    "là", "thì", "và", "nhưng", "mà", "để", "tôi", "mình", "anh", "em", "nó",
    "cái", "con", "một", "rất", "nên", "chắc", "của", "cho", "có", "máy", "màn",
    "bằng", "với", "những", "hơi", "quá", "được", "đang", "sẽ", "ở", "trong", "nhiều",
    "gần", "như", "chiếc", "đây", "cứ",
}


def is_hard_traffic_or_policy_violation(text: str) -> str | None:
    """Return drop reason if sentence is a pure sales pitch, price bait, or policy violation."""
    low = str(text or "").lower().strip()
    for pat, reason in _HARD_TRAFFIC_DROP_PATTERNS:
        if re.search(pat, low, flags=re.IGNORECASE):
            return reason
    return None


def sanitize_traffic_and_policy_text(text: str) -> tuple[str, list[str]]:
    """Automatically soften commerce, price, and absolute-claim keywords to avoid traffic throttling."""
    orig = str(text or "").strip()
    out = orig
    applied: list[str] = []
    for pat, rep in _CLAIM_REPLACEMENTS:
        if re.search(pat, out, flags=re.IGNORECASE):
            def _preserve_case(m: re.Match) -> str:
                matched = m.group(0)
                if matched and matched[0].isupper():
                    return rep[0].upper() + rep[1:]
                return rep
            out = re.sub(pat, _preserve_case, out, flags=re.IGNORECASE)
            applied.append(f"{pat} -> {rep}")
    return out, applied


def distill_clean_hook_title(text: str) -> str:
    """Distill a complete, meaningful 4-7 word hook headline without mid-phrase truncation."""
    raw = re.sub(r"\s+", " ", str(text or "")).strip(" ,.;:!?\"'")
    if not raw:
        return "ĐIỂM NỔI BẬT ĐÁNG CHÚ Ý"
    first_clause = re.split(r"[.?!;]", raw)[0].strip() or raw
    # Strip conversational lead-in phrases so the core subject & payoff stay intact
    lead_patterns = [
        r"^(?:xin chào[^,]*,\s*)",
        r"^(?:hôm nay\s+(?:mình|tôi)\s+sẽ\s+(?:chia sẻ|review)\s+(?:cho\s+(?:các\s+)?(?:bạn|anh\s+em)\s+)?)",
        r"^(?:đây\s+là\s+(?:một\s+)?(?:chiếc|cái|con|bộ|dòng)\s+)",
        r"^(?:thì\s+đây\s+(?:chính\s+)?là\s+(?:cái|chiếc)?\s*)",
    ]
    cleaned = first_clause
    for pat in lead_patterns:
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE).strip()
    # Simplify filler intensifiers inside hook titles so the whole payoff fits in 5-7 words
    cleaned = re.sub(r"\bgần\s+như\s+là\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bdành\s+cho\s+.*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:!?")

    words = [w.strip(".,!?;:\"'") for w in cleaned.split() if w.strip(".,!?;:\"'")]
    if len(words) > 7:
        words = words[:7]
    while len(words) > 3 and words[-1].lower() in _INCOMPLETE_END_WORDS:
        words.pop()
    return " ".join(words).upper() if words else "ĐIỂM NỔI BẬT ĐÁNG CHÚ Ý"


def load_local_env(force: bool = False) -> None:
    """Load optional key=value pairs from _tools/.env without external dependencies."""
    if not ENV_FILE.exists():
        return
    for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if not key:
            continue
        if force or not os.environ.get(key):
            os.environ[key] = val


def _mask_key(val: str) -> str:
    if not val:
        return ""
    if len(val) <= 8:
        return "*" * len(val)
    return f"{val[:4]}...{val[-4:]}"


def get_ai_status() -> dict[str, Any]:
    """Return current external API key status (masked) and active execution mode."""
    load_local_env()
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    openai_key = (
        os.environ.get("ANTHINH_LLM_API_KEY", "").strip()
        or os.environ.get("OPENAI_API_KEY", "").strip()
    )
    active = "smart_local"
    if openai_key:
        active = f"openai:{os.environ.get('ANTHINH_LLM_MODEL', 'gpt-4o-mini')}"
    elif gemini_key:
        active = f"gemini:{os.environ.get('ANTHINH_GEMINI_MODEL', 'gemini-2.5-flash')}"
    return {
        "has_external_key": bool(gemini_key or openai_key),
        "active_provider": active,
        "mode": "external_api" if (gemini_key or openai_key) else "smart_local_zero_key",
        "gemini_set": bool(gemini_key),
        "gemini_masked": _mask_key(gemini_key),
        "openai_set": bool(openai_key),
        "openai_masked": _mask_key(openai_key),
        "model": os.environ.get("ANTHINH_GEMINI_MODEL") or os.environ.get("ANTHINH_LLM_MODEL") or "",
        "base_url": os.environ.get("ANTHINH_LLM_BASE_URL", ""),
        "env_file_exists": ENV_FILE.exists(),
    }


def save_ai_config(
    gemini_api_key: str = "",
    openai_api_key: str = "",
    model: str = "",
    base_url: str = "",
    clear_keys: bool = False,
) -> dict[str, Any]:
    """Persist optional LLM config into _tools/.env and update process env."""
    if clear_keys:
        for k in ("GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHINH_LLM_API_KEY", "ANTHINH_LLM_MODEL", "ANTHINH_GEMINI_MODEL", "ANTHINH_LLM_BASE_URL"):
            os.environ.pop(k, None)
        if ENV_FILE.exists():
            ENV_FILE.unlink()
        return get_ai_status()

    lines: list[str] = []
    if gemini_api_key.strip():
        lines.append(f"GEMINI_API_KEY={gemini_api_key.strip()}")
        os.environ["GEMINI_API_KEY"] = gemini_api_key.strip()
        if model.strip():
            lines.append(f"ANTHINH_GEMINI_MODEL={model.strip()}")
            os.environ["ANTHINH_GEMINI_MODEL"] = model.strip()
    if openai_api_key.strip():
        lines.append(f"OPENAI_API_KEY={openai_api_key.strip()}")
        os.environ["OPENAI_API_KEY"] = openai_api_key.strip()
        if model.strip():
            lines.append(f"ANTHINH_LLM_MODEL={model.strip()}")
            os.environ["ANTHINH_LLM_MODEL"] = model.strip()
        if base_url.strip():
            lines.append(f"ANTHINH_LLM_BASE_URL={base_url.strip()}")
            os.environ["ANTHINH_LLM_BASE_URL"] = base_url.strip()

    if lines:
        ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    load_local_env(force=True)
    return get_ai_status()


def load_watchlist() -> list[dict[str, str]]:
    """Parse watchlist phrases grouped by section header."""
    if not WATCHLIST_PATH.exists():
        return []
    entries: list[dict[str, str]] = []
    category = "Chung"
    for line in WATCHLIST_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("## "):
            category = stripped[3:].strip()
        elif stripped.startswith("- ") and len(stripped) > 2:
            phrase = stripped[2:].strip()
            entries.append({"category": category, "phrase": phrase})
    return entries


def scan_watchlist(rows: list[EdlRow], only_kept: bool = True) -> list[dict[str, Any]]:
    """Scan EDL texts against watchlist phrases purely in Python."""
    watchlist = load_watchlist()
    hits: list[dict[str, Any]] = []
    for idx, row in enumerate(rows):
        if only_kept and row.keep != 1:
            continue
        low_text = row.text.lower()
        matched = []
        for item in watchlist:
            phrase = item["phrase"].lower()
            if re.search(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", low_text):
                matched.append(item)
        if matched:
            hits.append({
                "index": idx,
                "start": row.start,
                "end": row.end,
                "text": row.text,
                "matches": matched,
            })
    return hits


def load_prompt_preset(preset_name: str) -> str:
    """Read a prompt preset markdown file from _tools/prompts/."""
    clean = Path(preset_name).stem
    for ext in (".md", ".txt"):
        p = PROMPTS_DIR / f"{clean}{ext}"
        if p.exists():
            return p.read_text(encoding="utf-8")
    return ""


def _tokenize_vi(text: str) -> list[str]:
    return [t for t in re.findall(r"[^\W_]+", text.lower(), flags=re.UNICODE) if t]


_VI_STOPWORDS = {
    "và", "là", "của", "cho", "các", "cái", "này", "đó", "một", "những", "để",
    "thì", "mà", "ở", "trong", "khi", "nếu", "như", "với", "bạn", "mình", "ta",
    "có", "không", "được", "rất", "hơn", "nhiều", "ra", "vào", "lên", "xuống",
}


def smart_local_retake_pairs(segments: list[dict[str, Any]]) -> list[tuple[str, str, float]]:
    """Detect retake / duplicate phrase pairs across wide windows (up to 25 sentences) using content tokens."""
    pairs: list[tuple[str, str, float]] = []
    full_tokens = [_tokenize_vi(s.get("text", "")) for s in segments]
    content_tokens = [[t for t in toks if t not in _VI_STOPWORDS] or toks for toks in full_tokens]

    for i in range(len(segments)):
        t1 = set(content_tokens[i])
        if len(t1) < 2:
            continue
        for j in range(i + 1, min(len(segments), i + 25)):
            t2 = set(content_tokens[j])
            if len(t2) < 2:
                continue
            inter = len(t1 & t2)
            union = len(t1 | t2)
            jaccard = inter / union if union else 0.0
            shorter_cov = inter / min(len(t1), len(t2)) if min(len(t1), len(t2)) else 0.0
            prefix_match = full_tokens[i][:2] == full_tokens[j][:2] and len(full_tokens[i]) >= 2
            if jaccard >= 0.42 or (prefix_match and jaccard >= 0.28) or (inter >= 3 and shorter_cov >= 0.68):
                pairs.append((str(segments[i]["id"]), str(segments[j]["id"]), round(jaccard, 2)))
    return pairs

_VISUAL_CUES: list[tuple[tuple[str, ...], str, str]] = [
    (("giao diện", "màn hình", "bấm", "tìm", "mở", "vào mục", "chiến dịch", "tap", "affiliate"),
     "screen_recording", "Quay màn hình thao tác thực tế (3–5s) cảnh mở trang / bấm nút đang mô tả, lưu vào `04_assets/broll/`."),
    (("nhắn tin", "comment", "cmt", "chat", "liên hệ", "trả lời"),
     "visual_broll", "Chụp/quay nhanh khung chat DM hoặc phần bình luận TikTok làm ảnh minh họa chèn nửa trên màn hình."),
    (("sản phẩm", "gửi mẫu", "ugc", "review", "trải nghiệm"),
     "visual_broll", "Chèn clip tay cầm sản phẩm / đóng gói hàng / video creator UGC đang review thực tế (B-roll 3–4s)."),
    (("số liệu", "hoa hồng", "doanh thu", "tỷ lệ", "chênh lệch", "phần trăm", "%"),
     "motion_card", "Chèn thẻ tóm tắt số liệu hoặc cảnh nền lưới sáng/mờ (DarkScene / InfoCard) nhấn mạnh con số cho dễ nhớ."),
    (("google", "notebook", "chatgpt", "claude", "gemini", "ai", "công cụ"),
     "screen_recording", "Quay hoặc chụp ảnh giao diện công cụ AI đang chạy để làm B-roll / Picture-in-Picture thay cho cảnh nói chay."),
]


def load_project_brief(project_dir: Path) -> dict[str, Any]:
    """Read brief files from 00_brief/ and extract outline points."""
    brief_dir = project_dir / "00_brief"
    files: list[str] = []
    chunks: list[str] = []
    if brief_dir.exists():
        for p in sorted(brief_dir.iterdir()):
            if p.is_file() and p.name != ".gitkeep" and p.suffix.lower() in {".md", ".txt"}:
                files.append(p.name)
                chunks.append(p.read_text(encoding="utf-8").strip())

    raw_text = "\n\n".join(c for c in chunks if c)
    outline: list[str] = []
    for line in raw_text.splitlines():
        clean = re.sub(r"^\s*(?:[-*+•]|\d+[.)]|#+)\s*", "", line).strip()
        if len(clean) >= 6:
            outline.append(clean)
    return {
        "files": files,
        "text": raw_text,
        "outline_points": outline,
    }


def save_project_brief(project_dir: Path, text: str, filename: str = "brief.md") -> dict[str, Any]:
    """Save or update 00_brief/brief.md cleanly."""
    brief_dir = project_dir / "00_brief"
    brief_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename or "brief.md").name
    if not safe_name.lower().endswith((".md", ".txt")):
        safe_name = f"{safe_name}.md"
    target = brief_dir / safe_name
    target.write_text(text.strip() + ("\n" if text.strip() else ""), encoding="utf-8")
    return load_project_brief(project_dir)


def smart_local_structure(
    segments: list[dict[str, Any]],
    target_duration: float = 0.0,
    preset: str = "retake_select",
    brief_points: list[str] | None = None,
    broll_keywords: list[str] | None = None,
) -> dict[str, Any]:
    """Zero-token local editor: removes retakes/fluff, picks hook; uses content/brief unless hard cap > 0."""
    if not segments:
        return {"selected_ids": [], "dropped": [], "hook_id": "", "hook_title": ""}

    by_id = {str(s["id"]): s for s in segments}
    retake_pairs = smart_local_retake_pairs(segments)
    dropped_reasons: dict[str, str] = {}

    for id1, id2, score in retake_pairs:
        if id1 in dropped_reasons or id2 in dropped_reasons:
            continue
        s1, s2 = by_id[id1], by_id[id2]
        t1, t2 = _tokenize_vi(s1.get("text", "")), _tokenize_vi(s2.get("text", ""))
        sc1 = float(s1.get("avg_prob", 0.9)) * 2.0 + min(1.0, len(t1) / 10.0)
        sc2 = float(s2.get("avg_prob", 0.9)) * 2.0 + min(1.0, len(t2) / 10.0) + 0.12
        drop_id = id1 if sc2 >= sc1 else id2
        keep_id = id2 if drop_id == id1 else id1
        dropped_reasons[drop_id] = f"retake_lap_{keep_id}"

    brief_tokens: set[str] = set()
    for bp in brief_points or []:
        brief_tokens.update(t for t in _tokenize_vi(bp) if t not in _VI_STOPWORDS)

    candidates: list[dict[str, Any]] = []
    text_fixes: dict[str, str] = {}
    for s in segments:
        sid = str(s["id"])
        if sid in dropped_reasons:
            continue
        raw_txt = str(s.get("text", "")).strip()
        low = raw_txt.lower()
        tokens = _tokenize_vi(low)
        dur = float(s.get("duration", 0.0))

        # 1. Tự động loại bỏ câu chèo kéo mua bán, báo giá hoặc mở đầu phản cảm dễ bị bóp tương tác
        hard_violation = is_hard_traffic_or_policy_violation(raw_txt)
        if hard_violation:
            dropped_reasons[sid] = hard_violation
            continue

        # 2. Tự động bỏ các mảnh câu ngập ngừng kết thúc bằng dấu "..." (vd: "Mà cứ...", "Nó chỉ...", "Mà con này...")
        if (raw_txt.endswith("...") or raw_txt.endswith("…")) and len(tokens) <= 4:
            dropped_reasons[sid] = "hesitation_stumble"
            continue

        if any(f in low for f in _FLUFF_CUES) and not any(t in brief_tokens for t in tokens):
            dropped_reasons[sid] = "filler_offtopic"
            continue

        # 3. Tự động làm mềm từ ngữ thương mại / giá cả nhẹ trong câu chia sẻ trải nghiệm
        safe_txt, applied_fixes = sanitize_traffic_and_policy_text(raw_txt)
        if applied_fixes and safe_txt != raw_txt:
            s = dict(s)
            s["text"] = safe_txt
            text_fixes[sid] = safe_txt
            raw_txt = safe_txt
            low = raw_txt.lower()

        txt_stripped = raw_txt
        is_continuation = False
        if candidates:
            prev_cand = candidates[-1]
            prev_txt = str(prev_cand.get("text", "")).strip()
            prev_toks = _tokenize_vi(prev_txt)
            gap_prev = float(s.get("start", 0.0)) - float(prev_cand.get("end", 0.0))
            if gap_prev <= 0.85 and (
                not prev_txt.endswith((".", "?", "!"))
                or (prev_toks and prev_toks[-1] in _INCOMPLETE_END_WORDS)
                or (txt_stripped and txt_stripped[0].islower())
            ):
                is_continuation = True
        if len(tokens) <= 2 and dur < 0.95 and not is_continuation and not any(k in low for k in _CTA_CUES):
            dropped_reasons[sid] = "short_fragment"
            continue
        candidates.append(s)

    if not candidates:
        candidates = [s for s in segments if str(s["id"]) not in dropped_reasons] or list(segments)

    # Nhóm các câu nối tiếp nhau (nói dở câu / thiếu dấu chấm) thành Cohesive Thought Units
    # để KHÔNG BAO GIỜ cắt đứt ngang câu hay làm mất nghĩa đoạn nói
    units: list[list[dict[str, Any]]] = []
    cur_unit: list[dict[str, Any]] = []
    for s in candidates:
        if not cur_unit:
            cur_unit = [s]
            continue
        prev = cur_unit[-1]
        prev_txt = str(prev.get("text", "")).strip()
        cur_txt = str(s.get("text", "")).strip()
        gap = float(s.get("start", 0.0)) - float(prev.get("end", 0.0))
        cur_dur = sum(float(x.get("duration", 0.0)) for x in cur_unit)
        last_tok = _tokenize_vi(prev_txt)[-1] if _tokenize_vi(prev_txt) else ""
        prev_closed = prev_txt.endswith((".", "?", "!"))
        cur_lower_start = bool(cur_txt) and cur_txt[0].islower()

        should_merge = (
            gap <= 0.85
            and cur_dur + float(s.get("duration", 0.0)) <= 12.5
            and (
                not prev_closed
                or last_tok in _INCOMPLETE_END_WORDS
                or cur_lower_start
                or float(s.get("duration", 0.0)) < 1.65
            )
        )
        if should_merge:
            cur_unit.append(s)
        else:
            units.append(cur_unit)
            cur_unit = [s]
    if cur_unit:
        units.append(cur_unit)

    # Xác định Hook Unit hoàn chỉnh (tránh chọn câu cụt / vế sau bị cắt giữa câu)
    hook_unit_idx = 0
    best_hook_score = -99.0
    total_units = len(units)
    for u_idx, unit in enumerate(units):
        first_txt = str(unit[0].get("text", "")).strip()
        full_u_txt = " ".join(str(x.get("text", "")).strip() for x in unit)
        u_dur = sum(float(x.get("duration", 0.0)) for x in unit)
        low = full_u_txt.lower()
        words = full_u_txt.split()
        if u_dur > 7.5 or len(words) < 5:
            continue
        # Bỏ qua unit bắt đầu bằng chữ thường (thường là nửa câu nối từ đoạn trước)
        if first_txt and first_txt[0].islower() and u_idx > 0:
            continue
        score = sum(1.6 for kw in _HOOK_CUES if kw in low)
        if "?" in low:
            score += 1.8
        tokens = set(_tokenize_vi(low))
        if brief_tokens and len(tokens & brief_tokens) >= 2:
            score += 1.4
        if u_idx == 0:
            score += 2.6  # Ưu tiên giữ mở đầu tự nhiên nếu đã là câu trọn vẹn
        elif u_idx >= max(1, total_units - 2) and "?" in low:
            score += 1.5  # Mở đầu quay bổ sung ở cuối clip (thường là alt hook)
        if any(f in low for f in _FLUFF_CUES):
            score -= 3.0
        if score > best_hook_score:
            best_hook_score = score
            hook_unit_idx = u_idx

    hook_id = str(units[hook_unit_idx][0]["id"]) if units else str(candidates[0]["id"])

    # Cân bằng độ dài thông minh theo Story Beats hoàn chỉnh
    if "concise" in preset:
        explicit_cap = 48.0
    elif target_duration and target_duration > 0:
        explicit_cap = float(target_duration)
    else:
        explicit_cap = max(54.0, min(65.0, 46.0 + len(brief_points or []) * 5.0))

    total_dur = sum(float(s.get("duration", 0.0)) for s in candidates)
    chosen_unit_indices: set[int] = set(range(total_units))

    if total_dur > explicit_cap * 1.12 and total_units > 3:
        scored_units: list[tuple[float, int]] = []
        for u_idx, unit in enumerate(units):
            full_u_txt = " ".join(str(x.get("text", "")).strip() for x in unit)
            low = full_u_txt.lower()
            tokens = set(_tokenize_vi(low))
            u_dur = sum(float(x.get("duration", 0.0)) for x in unit)
            avg_p = sum(float(x.get("avg_prob", 0.9)) for x in unit) / len(unit)
            first_u_txt = str(unit[0].get("text", "")).strip()

            val = avg_p * 1.6
            if u_idx == hook_unit_idx:
                val += 15.0
            # Tránh chọn unit mồ côi bắt đầu bằng chữ thường (thường là nửa câu bị tách)
            if first_u_txt and first_u_txt[0].islower() and u_idx != hook_unit_idx:
                val -= 8.5
            if any(k in low for k in _CTA_CUES) and u_idx >= max(1, int(total_units * 0.72)):
                val += 8.0
            if any(k in low for k in _INTRO_LEAD_CUES) and u_idx >= max(1, int(total_units * 0.70)):
                # Đoạn dẫn intro quay ở cuối clip -> không để xuất hiện sau câu chốt CTA ở cuối video
                val -= 9.0
            if _tokenize_vi(full_u_txt) and _tokenize_vi(full_u_txt)[-1] in _INCOMPLETE_END_WORDS and not any(k in low for k in _CTA_CUES):
                val -= 2.5
            if brief_tokens:
                val += min(5.0, len(tokens & brief_tokens) * 1.5)
            if broll_keywords and "sync_broll" in preset:
                val += min(6.0, sum(2.5 for bk in broll_keywords if bk in low))
            val += min(6.0, sum(1.3 for kw in _VALUE_CUES if kw in low))
            if re.search(r"\b\d+\b", low):
                val += 1.5
            if 3.2 <= u_dur <= 11.5:
                val += 1.8
            elif u_dur < 2.2:
                val -= 1.2
            scored_units.append((val, u_idx))

        chosen_unit_indices = set()
        acc = 0.0
        for val, u_idx in sorted(scored_units, key=lambda x: (-x[0], x[1])):
            u_dur = sum(float(x.get("duration", 0.0)) for x in units[u_idx])
            if u_idx == hook_unit_idx or acc + u_dur <= explicit_cap or len(chosen_unit_indices) < 2:
                chosen_unit_indices.add(u_idx)
                acc += u_dur

        # Bảo vệ mạch ngữ cảnh: giữ câu danh từ ngay trước đoạn mở bằng đại từ/liên từ
        # (ví dụ: phải giữ câu nhắc "Kindle" / "sách giấy" trước "Nhưng mà cái con này..." / "Tôi không thể...")
        for u_idx in sorted(list(chosen_unit_indices)):
            if u_idx <= 0 or u_idx == hook_unit_idx:
                continue
            u_low = " ".join(str(x.get("text", "")).strip() for x in units[u_idx]).lower()
            if not u_low.startswith(_ANTECEDENT_STARTS):
                continue
            prev_u = u_idx - 1
            if prev_u in chosen_unit_indices:
                continue
            prev_low = " ".join(str(x.get("text", "")).strip() for x in units[prev_u]).lower()
            if any(f in prev_low for f in _FLUFF_CUES) or any(k in prev_low for k in _INTRO_LEAD_CUES):
                continue
            prev_dur = sum(float(x.get("duration", 0.0)) for x in units[prev_u])
            if prev_dur <= 13.0 and acc + prev_dur <= explicit_cap * 1.32:
                chosen_unit_indices.add(prev_u)
                acc += prev_dur

    # Xếp lại các Story Beat theo đúng mạch thời gian (Hook -> Thân bài -> Kết)
    ordered_unit_indices = sorted(chosen_unit_indices)
    if hook_unit_idx in ordered_unit_indices and ordered_unit_indices[0] != hook_unit_idx:
        first_u_txt = " ".join(str(x.get("text", "")) for x in units[ordered_unit_indices[0]]).lower()
        first_has_cue = any(kw in first_u_txt for kw in _HOOK_CUES)
        if "hook" in preset or not first_has_cue or ordered_unit_indices[0] > 2:
            ordered_unit_indices.remove(hook_unit_idx)
            ordered_unit_indices.insert(0, hook_unit_idx)

    kept_ids: list[str] = []
    for u_idx in ordered_unit_indices:
        for s in units[u_idx]:
            kept_ids.append(str(s["id"]))

    for u_idx, unit in enumerate(units):
        if u_idx not in chosen_unit_indices:
            for s in unit:
                dropped_reasons[str(s["id"])] = "compress_target_duration"

    hook_full_text = " ".join(str(x.get("text", "")).strip() for x in units[hook_unit_idx]) if units else str(by_id.get(hook_id, {}).get("text", "")).strip()
    hook_title = distill_clean_hook_title(hook_full_text)

    dropped_list = [
        {"id": str(s["id"]), "reason": dropped_reasons.get(str(s["id"]), "dropped")}
        for s in segments
        if str(s["id"]) not in kept_ids
    ]
    return {
        "selected_ids": kept_ids,
        "dropped": dropped_list,
        "hook_id": hook_id,
        "hook_title": hook_title,
        "text_fixes": text_fixes,
    }


def smart_local_claims_rewrite(flagged_items: list[dict[str, Any]]) -> dict[str, Any]:
    """Rule-based safe Vietnamese claim & traffic-throttling rewriter."""
    rewrites: list[dict[str, Any]] = []
    for item in flagged_items:
        orig = str(item.get("text", ""))
        hard_reason = is_hard_traffic_or_policy_violation(orig)
        if hard_reason:
            rewrites.append({
                "id": str(item.get("id", "")),
                "risk": "high",
                "action": "drop",
                "safe_caption": "",
                "note": f"Đã tự động loại bỏ câu rủi ro bóp tương tác ({hard_reason})",
            })
            continue
        safe, applied = sanitize_traffic_and_policy_text(orig)
        if safe == orig:
            safe = f"Theo trải nghiệm thực tế, {orig[0].lower()}{orig[1:]}" if len(orig) > 1 else orig
        rewrites.append({
            "id": str(item.get("id", "")),
            "risk": "medium",
            "action": "rephrase",
            "safe_caption": safe,
            "note": "Đã chuyển từ ngữ thương mại/cam kết sang chia sẻ trải nghiệm an toàn",
        })
    return {"rewrites": rewrites}


def _extract_json_block(text: str) -> dict[str, Any]:
    """Parse JSON from raw text or fenced ```json block."""
    cleaned = text.strip()
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, flags=re.DOTALL)
    if m:
        cleaned = m.group(1)
    return json.loads(cleaned)


def _has_external_llm_key() -> bool:
    load_local_env()
    return bool(
        os.environ.get("GEMINI_API_KEY", "").strip()
        or os.environ.get("ANTHINH_LLM_API_KEY", "").strip()
        or os.environ.get("OPENAI_API_KEY", "").strip()
    )


def _call_external_llm(system_prompt: str, user_payload: str) -> tuple[dict[str, Any], str]:
    """Call OpenAI-compatible or Gemini REST API if env/.env key is configured."""
    load_local_env()
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    openai_key = (
        os.environ.get("ANTHINH_LLM_API_KEY", "").strip()
        or os.environ.get("OPENAI_API_KEY", "").strip()
    )
    if openai_key:
        base_url = os.environ.get("ANTHINH_LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        model = os.environ.get("ANTHINH_LLM_MODEL", "gpt-4o-mini")
        body = json.dumps({
            "model": model,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_payload},
            ],
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {openai_key}",
            },
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"]
        return _extract_json_block(content), f"openai:{model}"

    if gemini_key:
        model = os.environ.get("ANTHINH_GEMINI_MODEL", "gemini-2.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
        body = json.dumps({
            "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_payload}"}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1},
        }).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        return _extract_json_block(content), f"gemini:{model}"

    raise RuntimeError("EXTERNAL_KEY_NOT_CONFIGURED")


MAX_PAYLOAD_CHARS = 5500


def _normalize_for_cache(text: str) -> str:
    """Normalize cosmetic whitespace/punctuation so minor edits never cause LLM cache misses."""
    norm = re.sub(r"~?\d+s", "", text.lower())
    norm = re.sub(r"\s+", " ", norm).strip()
    return norm


def call_ai_cached(
    project_dir: Path,
    project_name: str,
    task_name: str,
    prompt_text: str,
    compressed_payload: str,
    fallback_fn: Callable[[], dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Use SHA-256 semantic cache -> external lightweight LLM (if configured) -> smart_local (0 token)."""
    cache_file = project_dir / "03_working" / f"{project_name}.ai_cache.json"
    cache: dict[str, Any] = {}
    if cache_file.exists():
        try:
            cache = json.loads(cache_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            cache = {}

    # Token Leak Guard: Cắt tỉa payload nếu vượt ngưỡng an toàn
    safe_payload = compressed_payload[:MAX_PAYLOAD_CHARS]
    has_key = _has_external_llm_key()
    cache_key = sha256_text(f"{task_name}\n{_normalize_for_cache(prompt_text)}\n{_normalize_for_cache(safe_payload)}")
    if cache_key in cache:
        cached_provider = str(cache[cache_key].get("provider", "cache"))
        # Nếu người dùng mới nạp API key ngoài sau lần chạy offline trước, gọi API mới thay vì trả lại cache local
        if not (has_key and cached_provider.startswith(("smart_local", "local_heuristic"))):
            return cache[cache_key]["result"], {
                "ai_called": False,
                "cache_hit": True,
                "provider": cached_provider,
                "mode": "cache",
                "cache_key": cache_key[:12],
            }

    bridge_file = project_dir / "03_working" / f"{project_name}.{task_name}.ai_request.txt"
    bridge_file.write_text(
        f"# ANTIGRAVITY BRIDGE PROMPT ({task_name})\n"
        f"# HƯỚNG DẪN: Nếu muốn dùng AI sâu hơn mà không cần API key, copy nội dung dưới dán vào Antigravity.\n\n"
        f"{prompt_text}\n\n--- DATA ---\n{safe_payload}\n",
        encoding="utf-8",
    )

    if not has_key:
        result = fallback_fn()
        provider = "smart_local (0 API key)"
        meta = {
            "ai_called": False,
            "cache_hit": False,
            "provider": provider,
            "mode": "offline_zero_token",
            "bridge_file": bridge_file.name,
            "cache_key": cache_key[:12],
        }
        cache[cache_key] = {"provider": provider, "result": result}
        cache_file.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
        return result, meta

    try:
        result, provider = _call_external_llm(prompt_text, safe_payload)
        meta = {
            "ai_called": True,
            "cache_hit": False,
            "provider": provider,
            "mode": "external_api",
            "cache_key": cache_key[:12],
        }
    except (RuntimeError, urllib.error.URLError, json.JSONDecodeError, KeyError, TimeoutError) as exc:
        result = fallback_fn()
        provider = "smart_local (fallback)"
        meta = {
            "ai_called": False,
            "cache_hit": False,
            "provider": provider,
            "mode": "api_fallback",
            "api_error": str(exc),
            "bridge_file": bridge_file.name,
            "cache_key": cache_key[:12],
        }

    cache[cache_key] = {"provider": provider, "result": result}
    cache_file.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    return result, meta


def analyze_content_and_source_gaps(
    project_dir: Path,
    rows: list[EdlRow],
    props: dict[str, Any] | None = None,
    brief_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Compare EDL + visual layers against Brief & ref pacing to suggest missing source/B-roll."""
    brief = brief_data if brief_data is not None else load_project_brief(project_dir)
    kept_rows = [(i, r) for i, r in enumerate(rows) if r.keep == 1]

    broll_dir = project_dir / "04_assets" / "broll"
    music_dir = project_dir / "04_assets" / "music"
    broll_files = sorted(p.name for p in broll_dir.iterdir() if p.is_file() and p.name != ".gitkeep") if broll_dir.exists() else []
    music_files = sorted(p.name for p in music_dir.iterdir() if p.is_file() and p.name != ".gitkeep") if music_dir.exists() else []

    all_kept_text = " ".join(r.text for _, r in kept_rows).lower()
    kept_token_set = {t for t in _tokenize_vi(all_kept_text) if t not in _VI_STOPWORDS}

    # 1. Đối chiếu các ý trong 00_brief/
    brief_items: list[dict[str, Any]] = []
    gaps: list[dict[str, Any]] = []
    covered_cnt = 0
    for idx, pt in enumerate(brief.get("outline_points", []), start=1):
        pt_tokens = [t for t in _tokenize_vi(pt) if t not in _VI_STOPWORDS]
        if not pt_tokens:
            continue
        matched = [t for t in pt_tokens if t in kept_token_set]
        ratio = len(matched) / len(pt_tokens)
        is_covered = ratio >= 0.40 or len(matched) >= 2
        if is_covered:
            covered_cnt += 1
        else:
            gaps.append({
                "id": f"GAP_BRIEF_{idx}",
                "gap_type": "brief_missing",
                "severity": "high",
                "timeline_sec": None,
                "sentence_id": "",
                "title": f"Thiếu ý trong Brief #{idx}: {pt[:52]}",
                "spoken_text": pt,
                "suggestion": (
                    f"Trong video chưa thấy nhắc rõ ý \"{pt}\". "
                    "Hãy quay thêm 1 câu nói nối 3–5 giây chèn vào `01_raw/` hoặc tạo thẻ tóm tắt (`DarkScene` / `InfoCard`) trám nội dung này."
                ),
                "target_folder": "01_raw/ hoặc 4. Cards",
            })
        brief_items.append({
            "point": pt,
            "covered": is_covered,
            "match_ratio": round(ratio, 2),
        })

    # 2. Kiểm tra cấu trúc Hook đầu & CTA cuối
    if kept_rows:
        first_txt = kept_rows[0][1].text.lower()
        first_dur = kept_rows[0][1].duration
        if first_dur > 4.5 or (not any(k in first_txt for k in _HOOK_CUES) and "?" not in first_txt):
            gaps.append({
                "id": "GAP_HOOK",
                "gap_type": "narrative_hook",
                "severity": "medium",
                "timeline_sec": 0.0,
                "sentence_id": f"R{kept_rows[0][0] + 1:02d}",
                "title": "Hook 3 giây đầu hơi dài hoặc chưa đánh thẳng vấn đề",
                "spoken_text": kept_rows[0][1].text,
                "suggestion": "Nên quay trám 1 câu mở 2–3s nêu rõ nỗi đau / kết quả ngay giây 0, hoặc kéo 1 câu đắt giá lên đầu bằng `hook_pick`.",
                "target_folder": "01_raw/ hoặc tab Hook",
            })

        tail_rows = kept_rows[max(0, int(len(kept_rows) * 0.7)) :]
        tail_txt = " ".join(r.text.lower() for _, r in tail_rows)
        if not any(k in tail_txt for k in _CTA_CUES):
            gaps.append({
                "id": "GAP_CTA",
                "gap_type": "narrative_cta",
                "severity": "medium",
                "timeline_sec": round(sum(r.duration for _, r in kept_rows), 1),
                "sentence_id": f"R{kept_rows[-1][0] + 1:02d}",
                "title": "Thiếu câu kết / lời kêu gọi tương tác (CTA) cuối video",
                "spoken_text": kept_rows[-1][1].text,
                "suggestion": "Có thể quay bổ sung 1 câu 2–3s kết lại trải nghiệm hoặc mời người xem để lại bình luận chia sẻ.",
                "target_folder": "01_raw/",
            })

    # 3. Quét khoảng trống B-roll / Source hình minh họa theo nhịp ref (~4-6s/cảnh)
    fps = int((props or {}).get("fps", 30))
    speed = 1.0
    visual_frames: list[tuple[int, int]] = []
    if props:
        for key in ("broll", "darkScenes", "infoCards", "logoBadges"):
            for item in props.get(key, []):
                visual_frames.append((int(item.get("startFrame", 0)), int(item.get("endFrame", 0))))

    def _has_visual_at(t0: float, t1: float) -> bool:
        f0, f1 = int(t0 * fps), int(t1 * fps)
        return any(vf0 < f1 and vf1 > f0 for vf0, vf1 in visual_frames)

    acc_sec = 0.0
    last_visual_sec = 0.0
    total_kept_sec = 0.0
    for orig_idx, r in kept_rows:
        seg_dur = r.duration / speed
        seg_end = acc_sec + seg_dur
        total_kept_sec = seg_end
        low = r.text.lower()
        rid = f"R{orig_idx + 1:02d}"

        if _has_visual_at(acc_sec, seg_end):
            last_visual_sec = seg_end
        else:
            cue_hit = None
            for kws, gtype, gmsg in _VISUAL_CUES:
                if any(kw in low for kw in kws):
                    cue_hit = (gtype, gmsg)
                    break

            gap_run = seg_end - last_visual_sec
            if cue_hit and not broll_files:
                gaps.append({
                    "id": f"GAP_VIS_{rid}",
                    "gap_type": cue_hit[0],
                    "severity": "high",
                    "timeline_sec": round(acc_sec, 1),
                    "sentence_id": rid,
                    "title": f"Cần B-roll/Screen Recording tại {acc_sec:.1f}s ({rid})",
                    "spoken_text": r.text,
                    "suggestion": cue_hit[1],
                    "target_folder": "04_assets/broll/",
                })
                last_visual_sec = seg_end
            elif gap_run >= 6.5:
                gaps.append({
                    "id": f"GAP_PACE_{rid}",
                    "gap_type": "visual_broll",
                    "severity": "medium",
                    "timeline_sec": round(acc_sec, 1),
                    "sentence_id": rid,
                    "title": f"Đoạn nói chay {gap_run:.1f}s chưa đổi cảnh ({rid} @ {acc_sec:.1f}s)",
                    "spoken_text": r.text,
                    "suggestion": "Chèn 1 ảnh chụp màn hình, clip B-roll 3–4s vào `04_assets/broll/` hoặc thêm thẻ `InfoCard`/`Frosted Scene` để giữ nhịp cắt ~4–5s như video ref.",
                    "target_folder": "04_assets/broll/ hoặc 4. Cards",
                })
                last_visual_sec = seg_end
        acc_sec = seg_end

    if not music_files:
        gaps.append({
            "id": "GAP_MUSIC",
            "gap_type": "audio_music",
            "severity": "low",
            "timeline_sec": 0.0,
            "sentence_id": "",
            "title": "Chưa có nhạc nền trong 04_assets/music/",
            "spoken_text": "",
            "suggestion": "Thêm 1 file nhạc nền không bản quyền (.mp3/.wav) vào `04_assets/music/` để hệ thống tự ducking -22 dB nâng nhịp dựng giống các video mẫu.",
            "target_folder": "04_assets/music/",
        })

    brief_pct = round(100.0 * covered_cnt / len(brief_items), 1) if brief_items else None
    visual_events = max(1, len(visual_frames))
    report = {
        "brief_files": brief.get("files", []),
        "brief_outline_count": len(brief_items),
        "brief_covered_count": covered_cnt,
        "brief_coverage_pct": brief_pct,
        "brief_items": brief_items,
        "broll_count": len(broll_files),
        "music_count": len(music_files),
        "total_kept_sec": round(total_kept_sec, 2),
        "avg_visual_interval_sec": round(total_kept_sec / visual_events, 1) if total_kept_sec else 0.0,
        "gap_count": len(gaps),
        "gaps": gaps,
    }
    report_path = project_dir / "03_working" / f"{project_dir.name}.gaps_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


_ENUM_CUES = (
    "thứ nhất", "thứ hai", "thứ ba", "thứ tư", "đầu tiên", "tiếp theo",
    "ngoài ra", "cuối cùng", "bước 1", "bước 2", "bước 3", "một là",
    "hai là", "ba là", "điểm cộng", "ưu điểm", "nhược điểm", "lưu ý", "sai lầm",
)

_FILLER_LEAD_RE = re.compile(
    r"^(?:thì|và|nhưng|mà|rồi|vì|đấy|nên|thật ra|thực ra|cái|con này|em này|máy này|bạn|anh em|các bạn|mình|tôi|"
    r"đây chính là|đó là|nó|là|á|ha|nha|nhé|luôn|cũng|có|được)\b[\s,.:;-]*",
    flags=re.IGNORECASE,
)


_DANGLING_TAIL = {"của", "cho", "với", "từ", "để", "và", "hoặc", "nhưng", "mà", "thì", "là", "có", "bị", "được"}


def _distill_popup_label(text: str, max_words: int = 7) -> str:
    """Rút gọn 1 câu nói tiếng Việt thành tiêu đề pop-up súc tích đúng theo nội dung câu đó."""
    clean = re.sub(r"[?!.,;:]+$", "", text.strip())
    clean = re.sub(r"\b(đó là đến từ|tôi nói là|thì đọc thì|nó chỉ)\b", "", clean, flags=re.IGNORECASE)
    for _ in range(5):
        nxt = _FILLER_LEAD_RE.sub("", clean).strip()
        if nxt == clean:
            break
        clean = nxt
    clean = re.sub(r"\b(á|nha|nhé|luôn|anh em|các bạn|hả|ha)\b", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s{2,}", " ", clean).strip(" ,.-:")
    words = clean.split()
    if not words:
        words = text.strip().split()
    picked_words = words[:max_words]
    while len(picked_words) > 2 and picked_words[-1].lower().strip(",.-:") in _DANGLING_TAIL:
        picked_words.pop()
    picked = " ".join(picked_words).strip(" ,.-:")
    if not picked:
        return ""
    return picked[0].upper() + picked[1:]


def _score_popup_segment(text: str) -> tuple[int, str]:
    """Chấm điểm mức độ xứng đáng lên pop-up của một câu nói bất kể chủ đề."""
    low = text.lower()
    score = 0
    icon = "bolt"

    if any(k in low for k in _ENUM_CUES):
        score += 4
        icon = "check"
    if any(k in low for k in ("sai lầm", "cảnh báo", "lưu ý", "tránh", "không ", "nhược điểm")):
        score += 2
        icon = "alert"
    if re.search(r"\b\d+(?:[.,]\d+)?\s*(?:%|tiếng|giờ|phút|ngày|tháng|năm|inch|g|kg|triệu|nghìn|k|lần|cuốn|bước)\b", low):
        score += 3
        icon = "chart" if "%" in low else "bolt"
    elif re.search(r"\b\d+\b", low):
        score += 2
    if any(k in low for k in ("siêu ", "rất ", "nhất ", "giải pháp", "bí quyết", "tối ưu", "giúp ", "tự động")):
        score += 2
    if 4 <= len(text.split()) <= 16:
        score += 1
    return score, icon


def generate_content_popups(
    project_dir: Path,
    project_name: str,
    kept_timeline: list[dict[str, Any]],
    fps: int = 30,
) -> list[dict[str, Any]]:
    """Phân tích nội dung thực tế của video để tạo chuỗi pop-up liệt kê từng ý khớp câu nói."""
    if not kept_timeline:
        return []

    payload_lines = [
        f"[{seg.get('index', idx)}] ({seg['outStart']:.1f}s-{seg['outEnd']:.1f}s) {seg['text']}"
        for idx, seg in enumerate(kept_timeline)
    ]
    compressed_payload = "\n".join(payload_lines)
    prompt_text = (
        "Bạn là biên tập viên video ngắn TikTok/Reels. Hãy đọc toàn bộ lời thoại theo timestamp của video này "
        "và rút ra 3 đến 6 ý chính / điểm liệt kê quan trọng nhất đúng theo nội dung video đó để hiện pop-up từng ý.\n"
        "Trả về JSON đúng schema:\n"
        '{"popups": [{"segIndex": 4, "label": "Tiêu đề ngắn 3-6 từ", "detail": "Chi tiết ngắn nếu cần", "icon": "check|bolt|alert|chart|bag|clock"}]}\n'
        "Quy tắc: Bỏ qua 2.5 giây đầu (đã có Hook). Các pop-up cách nhau ít nhất 3.5 giây, label súc tích bằng tiếng Việt, không bịa thông tin ngoài lời thoại."
    )

    def _local_content_fallback() -> dict[str, Any]:
        candidates: list[tuple[int, int, str, str]] = []
        for idx, seg in enumerate(kept_timeline):
            if float(seg["outStart"]) < 2.5:
                continue
            txt = str(seg.get("text", "")).strip()
            if len(txt.split()) < 3:
                continue
            sc, ic = _score_popup_segment(txt)
            if sc >= 3:
                lbl = _distill_popup_label(txt, max_words=6)
                if lbl:
                    candidates.append((sc, idx, ic, lbl))

        # Sắp xếp ưu tiên điểm cao rồi lọc theo khoảng cách thời gian >= 3.5s
        candidates.sort(key=lambda x: (-x[0], x[1]))
        chosen: list[tuple[int, str, str]] = []
        chosen_times: list[float] = []
        for _, idx, ic, lbl in candidates:
            t0 = float(kept_timeline[idx]["outStart"])
            if any(abs(t0 - ct) < 3.5 for ct in chosen_times):
                continue
            chosen.append((idx, ic, lbl))
            chosen_times.append(t0)
            if len(chosen) >= 6:
                break

        chosen.sort(key=lambda x: x[0])
        return {
            "popups": [
                {"segIndex": idx, "label": lbl, "detail": "", "icon": ic}
                for idx, ic, lbl in chosen
            ]
        }

    result, _ = call_ai_cached(
        project_dir=project_dir,
        project_name=project_name,
        task_name="popup_outline",
        prompt_text=prompt_text,
        compressed_payload=compressed_payload,
        fallback_fn=_local_content_fallback,
    )

    valid_icons = {"check", "alert", "chart", "bag", "bolt", "clock"}
    cards: list[dict[str, Any]] = []
    last_sec = -10.0
    for item in result.get("popups", []):
        try:
            s_idx = int(item.get("segIndex", -1))
        except (TypeError, ValueError):
            continue
        if not (0 <= s_idx < len(kept_timeline)):
            continue
        seg = kept_timeline[s_idx]
        t0 = float(seg["outStart"])
        t1 = float(seg["outEnd"])
        if t0 < 2.0 or t0 - last_sec < 3.0:
            continue
        label = str(item.get("label", "")).strip()
        if not label:
            continue
        detail = str(item.get("detail", "")).strip()
        icon = str(item.get("icon", "bolt")).strip()
        if icon not in valid_icons:
            icon = "bolt"
        sf = int(round(t0 * fps))
        ef = max(sf + 45, min(int(round(t1 * fps)) + 15, sf + 90))
        cards.append({
            "id": f"IC{len(cards)+1}",
            "icon": icon,
            "label": label,
            "detail": detail,
            "step": len(cards) + 1,
            "startFrame": sf,
            "endFrame": ef,
        })
        last_sec = t0
        if len(cards) >= 6:
            break
    return cards
