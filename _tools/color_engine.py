"""Commercial Color Grading Engine (Filmic Highlight-Safe Color Science):
- Multi-frame exposure, skin/midtone, and highlight-clipping tracking (0 API tokens)
- Real 3D .cube LUT generator with Filmic Highlight Shoulder Roll-Off & Neutral White Preservation
- Adjustment Layer, Highlight Recovery Curves, & Color Sync across clips.
"""

from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path
from typing import Any

from PIL import Image, ImageStat

from common import (
    ensure_project,
    ffprobe_json,
    find_raw_videos,
    refresh_windows_path,
    resolve_portable_path,
    sha256_text,
)

LUT_VERSION_TAG = "# anthinh-lut-v2-filmic"

LUT_CATALOG: list[dict[str, Any]] = [
    {
        "id": "wishedit_clean_studio",
        "name": "Clean Studio Skin",
        "category": "Talking-Head",
        "desc": "Trong trẻo tự nhiên, sáng midtone da mặt, giữ nguyên chi tiết vùng sáng",
        "css_filter": "contrast(1.04) saturate(1.06)",
        "swatch": "linear-gradient(135deg, #0EA5E9 0%, #FDE68A 55%, #1E293B 100%)",
        # (r_mid_tint, g_mid_tint, b_mid_tint, gamma_lift, black_anchor, sat_mul, highlight_headroom)
        "filmic": (0.015, 0.008, -0.008, 1.06, 0.012, 1.07, 0.975),
        "ideal_for": "indoor_talking_head",
    },
    {
        "id": "tiktok_viral_crisp",
        "name": "TikTok Crisp Pop",
        "category": "Social Viral",
        "desc": "Sắc nét trong veo, tương phản rõ khối, không cháy nền trắng",
        "css_filter": "contrast(1.08) saturate(1.12)",
        "swatch": "linear-gradient(135deg, #F43F5E 0%, #FB923C 50%, #38BDF8 100%)",
        "filmic": (0.012, 0.005, 0.004, 1.04, 0.018, 1.12, 0.975),
        "ideal_for": "low_contrast",
    },
    {
        "id": "teal_orange_pro",
        "name": "Teal & Orange Pro",
        "category": "Cinematic",
        "desc": "Tách nền xanh trầm, đẩy tông da cam ấm nổi khối kiểu studio",
        "css_filter": "contrast(1.07) saturate(1.10) hue-rotate(-3deg)",
        "swatch": "linear-gradient(135deg, #0D9488 0%, #EA580C 60%, #0F172A 100%)",
        "filmic": (0.035, 0.005, -0.025, 1.03, 0.020, 1.09, 0.970),
        "ideal_for": "flat_bg",
    },
    {
        "id": "sony_s_cinetone",
        "name": "Sony S-Cinetone",
        "category": "Camera Look",
        "desc": "Màu da hồng hào mềm mại, highlight roll-off mượt không gắt sáng",
        "css_filter": "contrast(1.03) saturate(1.04)",
        "swatch": "linear-gradient(135deg, #FDA4AF 0%, #E2E8F0 55%, #334155 100%)",
        "filmic": (0.018, 0.004, -0.006, 1.04, 0.008, 1.04, 0.965),
        "ideal_for": "high_contrast",
    },
    {
        "id": "cyber_tech_cyan",
        "name": "Tech & AI Editorial",
        "category": "Editorial",
        "desc": "Tông hiện đại trong trẻo, khử ám vàng, nhấn sắc xanh cyan công nghệ",
        "css_filter": "contrast(1.06) saturate(1.07) hue-rotate(3deg)",
        "swatch": "linear-gradient(135deg, #2563EB 0%, #06B6D4 55%, #090D16 100%)",
        "filmic": (-0.018, 0.008, 0.030, 1.05, 0.015, 1.07, 0.975),
        "ideal_for": "warm_cast",
    },
    {
        "id": "high_key_bright",
        "name": "High-Key E-Com",
        "category": "Product / UGC",
        "desc": "Cứu tối vùng shadow & midtone cho quay thiếu sáng mà vẫn giữ đỉnh sáng",
        "css_filter": "brightness(1.03) contrast(1.03) saturate(1.06)",
        "swatch": "linear-gradient(135deg, #FFFFFF 0%, #BAE6FD 50%, #64748B 100%)",
        "filmic": (0.006, 0.006, 0.006, 1.14, 0.000, 1.06, 0.985),
        "ideal_for": "underexposed",
    },
    {
        "id": "warm_golden_hour",
        "name": "Warm Keylight",
        "category": "Warmth",
        "desc": "Bù sắc ấm dễ chịu cho phòng dùng đèn LED trắng lạnh",
        "css_filter": "contrast(1.04) saturate(1.08) sepia(0.06)",
        "swatch": "linear-gradient(135deg, #F59E0B 0%, #FDE047 50%, #451A03 100%)",
        "filmic": (0.036, 0.012, -0.028, 1.05, 0.010, 1.06, 0.975),
        "ideal_for": "cool_cast",
    },
    {
        "id": "fuji_eterna_film",
        "name": "Fuji Eterna Soft",
        "category": "Film",
        "desc": "Dịu mắt, giữ trọn dải sáng tối cho video phân tích chuyên sâu",
        "css_filter": "contrast(0.98) saturate(0.96)",
        "swatch": "linear-gradient(135deg, #34D399 0%, #94A3B8 55%, #1E293B 100%)",
        "filmic": (0.004, 0.010, 0.008, 1.02, -0.008, 0.96, 0.960),
        "ideal_for": "oversaturated",
    },
    {
        "id": "moody_matte_slate",
        "name": "Dark Matte Slate",
        "category": "Moody",
        "desc": "Kéo dịu vùng cháy sáng, tăng chiều sâu khối cho bối cảnh sáng gắt",
        "css_filter": "brightness(0.96) contrast(1.08) saturate(0.93)",
        "swatch": "linear-gradient(135deg, #475569 0%, #1E293B 55%, #020617 100%)",
        "filmic": (-0.010, 0.002, 0.016, 0.96, 0.020, 0.94, 0.940),
        "ideal_for": "overexposed",
    },
    {
        "id": "bw_high_contrast",
        "name": "Noir Punch B&W",
        "category": "Creative",
        "desc": "Đen trắng tương phản cao giữ chi tiết vùng sáng cho cảnh nhấn",
        "css_filter": "grayscale(1) contrast(1.16)",
        "swatch": "linear-gradient(135deg, #FAFAFA 0%, #71717A 50%, #09090B 100%)",
        "filmic": (0.0, 0.0, 0.0, 1.02, 0.025, 0.0, 0.975),
        "ideal_for": "special_effect",
    },
]


def _filmic_luma_transfer(y: float, gamma_lift: float, black_anchor: float, headroom: float) -> float:
    """Apply shadow anchor + midtone gamma lift + smooth highlight shoulder compression (zero hard clipping)."""
    y = max(0.0, min(1.0, y))
    # 1. Clean black toe clamp for 'trong trẻo' clarity without crushing shadows
    if black_anchor > 0 and y < 0.25:
        t = y / 0.25
        y = max(0.0, y - black_anchor * (1.0 - t) * t * 1.6)
    elif black_anchor < 0:
        # Soft matte shadow lift
        y = y + (-black_anchor) * math.exp(-y * 6.0)

    # 2. Power gamma lift in midtones (keeps 0 -> 0 and 1 -> 1 fixed so white never blows out!)
    if y > 0.0:
        y = pow(y, 1.0 / max(0.65, min(1.4, gamma_lift)))

    # 3. Smooth filmic highlight shoulder roll-off above 0.72 into `headroom` (e.g. 0.975)
    if y > 0.72:
        t = (y - 0.72) / 0.28  # 0..1
        max_span = max(0.18, headroom - 0.72)
        # Rational roll-off curve: preserves micro-contrast in bright areas instead of clipping flat at 1.0
        rolled = max_span * (t * (1.0 + 0.15)) / (1.0 + 0.15 + 0.35 * t) * (1.0 + 0.35 / 1.15)
        y = 0.72 + min(max_span, rolled)
    return max(0.0, min(1.0, y))


def ensure_cube_lut_file(proj_dir: Path, lut_id: str) -> Path | None:
    """Generate or locate a standard 17x17x17 filmic .cube 3D LUT file in 04_assets/luts/."""
    lut_dir = proj_dir / "04_assets" / "luts"
    lut_dir.mkdir(parents=True, exist_ok=True)

    meta = next((item for item in LUT_CATALOG if item["id"] == lut_id), None)
    if meta is None:
        # Imported custom .cube or .3dl
        for ext in ("", ".cube", ".3dl"):
            cand = lut_dir / f"{lut_id}{ext}"
            if cand.exists() and cand.is_file():
                return cand
        return None

    out_cube = lut_dir / f"{lut_id}.cube"
    if out_cube.exists() and out_cube.stat().st_size > 500:
        # Automatically regenerate old v1 linear LUTs that clipped highlights
        head = out_cube.read_text(encoding="utf-8", errors="ignore")[:180]
        if LUT_VERSION_TAG in head:
            return out_cube

    r_tint, g_tint, b_tint, gamma_lift, black_anchor, sat_mul, headroom = meta["filmic"]
    is_bw = lut_id == "bw_high_contrast"
    size = 17
    lines = [
        LUT_VERSION_TAG,
        f'TITLE "{meta["name"]}"',
        f"LUT_3D_SIZE {size}",
        "DOMAIN_MIN 0.0 0.0 0.0",
        "DOMAIN_MAX 1.0 1.0 1.0",
    ]
    for b_i in range(size):
        for g_i in range(size):
            for r_i in range(size):
                r = r_i / (size - 1)
                g = g_i / (size - 1)
                b = b_i / (size - 1)

                y_in = 0.299 * r + 0.587 * g + 0.114 * b
                y_out = _filmic_luma_transfer(y_in, gamma_lift, black_anchor, headroom)

                if is_bw:
                    lines.append(f"{y_out:.5f} {y_out:.5f} {y_out:.5f}")
                    continue

                # Preserve color balance while rolling off extreme highlight saturation
                hi_damp = 1.0 - 0.28 * max(0.0, (y_in - 0.72) / 0.28)
                eff_sat = sat_mul * hi_damp
                dr = (r - y_in) * eff_sat
                dg = (g - y_in) * eff_sat
                db = (b - y_in) * eff_sat

                # Midtone-weighted color tint: 0 at pure black/white, peaks cleanly on skin/midtones
                bell = 4.0 * y_in * (1.0 - y_in)
                r_out = max(0.0, min(1.0, y_out + dr + r_tint * bell))
                g_out = max(0.0, min(1.0, y_out + dg + g_tint * bell))
                b_out = max(0.0, min(1.0, y_out + db + b_tint * bell))
                lines.append(f"{r_out:.5f} {g_out:.5f} {b_out:.5f}")

    out_cube.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out_cube


def analyze_video_color_and_luts(project_name: str, force: bool = False) -> dict[str, Any]:
    """Track multi-frame exposure & highlight headroom (0 LLM tokens), recommend safe Auto Color + 10 LUTs."""
    refresh_windows_path()
    proj_dir = ensure_project(project_name)
    cache_path = proj_dir / "03_working" / f"{project_name}.color_analysis.json"

    ingest_path = proj_dir / "03_working" / f"{project_name}.ingest.json"
    src_video: Path | None = None
    if ingest_path.exists():
        stored = json.loads(ingest_path.read_text(encoding="utf-8")).get("work_video", "")
        cand = resolve_portable_path(proj_dir, stored, "03_working")
        if cand.exists():
            src_video = cand
    if src_video is None:
        raws = find_raw_videos(proj_dir)
        if raws:
            src_video = raws[0]

    sig = (
        "v2_filmic|" + sha256_text(f"{src_video.name}|{src_video.stat().st_size}|{src_video.stat().st_mtime}")[:12]
        if src_video and src_video.exists()
        else "v2_filmic|no_video"
    )

    if cache_path.exists() and not force:
        try:
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            if cached.get("video_signature") == sig:
                return _append_custom_luts(proj_dir, cached)
        except Exception:
            pass

    mean_luma = 115.0
    contrast_std = 50.0
    warmth_rb = 6.0
    mean_sat = 88.0
    p95_luma = 205.0
    highlight_pct = 3.5
    clip_pct = 1.0
    shadow_pct = 8.0

    if src_video and src_video.exists():
        probe_jpg = proj_dir / "03_working" / "_color_probe.jpg"
        try:
            dur = float(ffprobe_json(src_video).get("format", {}).get("duration", 0.0) or 0.0)
            timestamps = [max(0.5, dur * r) for r in (0.15, 0.5, 0.85)] if dur > 4.0 else [min(1.5, max(0.1, dur * 0.5))]
            samples = []
            for ts in timestamps:
                subprocess.run(
                    ["ffmpeg", "-y", "-v", "error", "-ss", f"{ts:.2f}", "-i", str(src_video), "-frames:v", "1", str(probe_jpg)],
                    check=True,
                    capture_output=True,
                    timeout=8,
                )
                if probe_jpg.exists():
                    im = Image.open(probe_jpg).convert("RGB").resize((160, 284))
                    stat = ImageStat.Stat(im)
                    r_m, g_m, b_m = stat.mean
                    r_sd, g_sd, b_sd = stat.stddev
                    lum_im = im.convert("L")
                    hist = lum_im.histogram()
                    tot = max(1, sum(hist))
                    clip_p = sum(hist[240:]) / tot * 100.0
                    hi_p = sum(hist[220:]) / tot * 100.0
                    sh_p = sum(hist[:26]) / tot * 100.0
                    # Compute p95 luminance
                    acc, p95_val = 0, 255
                    target_95 = int(tot * 0.95)
                    for lv, cnt in enumerate(hist):
                        acc += cnt
                        if acc >= target_95:
                            p95_val = lv
                            break
                    hsv_stat = ImageStat.Stat(im.convert("HSV"))
                    samples.append({
                        "luma": 0.299 * r_m + 0.587 * g_m + 0.114 * b_m,
                        "std": (r_sd + g_sd + b_sd) / 3.0,
                        "warmth": r_m - b_m,
                        "sat": hsv_stat.mean[1],
                        "p95": float(p95_val),
                        "hi": hi_p,
                        "clip": clip_p,
                        "sh": sh_p,
                    })
            if samples:
                n = len(samples)
                mean_luma = round(sum(x["luma"] for x in samples) / n, 1)
                contrast_std = round(sum(x["std"] for x in samples) / n, 1)
                warmth_rb = round(sum(x["warmth"] for x in samples) / n, 1)
                mean_sat = round(sum(x["sat"] for x in samples) / n, 1)
                p95_luma = round(max(x["p95"] for x in samples), 1)
                highlight_pct = round(sum(x["hi"] for x in samples) / n, 2)
                clip_pct = round(max(x["clip"] for x in samples), 2)
                shadow_pct = round(sum(x["sh"] for x in samples) / n, 2)
        except Exception:
            pass
        finally:
            if probe_jpg.exists():
                probe_jpg.unlink(missing_ok=True)

    # Highlight-safe Auto Color calculation:
    # NEVER boost additive brightness when highlights already exist (prevents white blowout!);
    # Use gamma midtone lift + highlight shoulder recovery + clean contrast ("trong trẻo").
    if clip_pct >= 6.0 or p95_luma >= 235:
        auto_brightness = -0.025
        highlight_recovery = 0.85
    elif highlight_pct >= 5.0 or p95_luma >= 215:
        auto_brightness = 0.0
        highlight_recovery = 0.65
    elif mean_luma < 95 and p95_luma < 185:
        auto_brightness = 0.015
        highlight_recovery = 0.25
    else:
        auto_brightness = 0.0
        highlight_recovery = 0.45

    # Midtone gamma lift brings out skin clarity without shifting black (0) or white (1) endpoints!
    auto_gamma = round(max(0.95, min(1.12, 1.0 + (122.0 - mean_luma) / 240.0)), 3)
    auto_contrast = round(max(1.00, min(1.08, 1.0 + (58.0 - contrast_std) / 320.0)), 3)
    auto_saturation = round(max(0.96, min(1.14, 1.0 + (98.0 - mean_sat) / 360.0)), 3)
    auto_temp = int(max(-12, min(12, round((7.0 - warmth_rb) * 0.6))))

    lighting_summary = (
        "Vùng sáng cao (Bảo vệ Highlight)"
        if (clip_pct >= 5.0 or highlight_pct >= 6.5)
        else "Hơi tối (Nâng midtone)"
        if mean_luma < 100
        else "Cân bằng chuẩn (Trong trẻo)"
    )
    wb_summary = (
        "Ám vàng ấm" if warmth_rb > 16 else "Hơi lạnh (Cool LED)" if warmth_rb < 0 else "Cân bằng trắng tự nhiên"
    )

    ranked: list[dict[str, Any]] = []
    for idx, item in enumerate(LUT_CATALOG):
        score = 92 - idx * 2
        if item["ideal_for"] == "overexposed" and (clip_pct >= 6.0 or mean_luma > 150):
            score += 9
        elif item["ideal_for"] == "underexposed" and mean_luma < 100 and p95_luma < 190:
            score += 9
        elif item["ideal_for"] == "low_contrast" and contrast_std < 50:
            score += 6
        elif item["ideal_for"] == "warm_cast" and warmth_rb > 14:
            score += 7
        elif item["ideal_for"] == "cool_cast" and warmth_rb < 4:
            score += 7
        elif item["ideal_for"] == "indoor_talking_head":
            score += 7
        score = max(72, min(99, score))
        ranked.append(
            {
                **item,
                "description": item.get("desc", ""),
                "preview_gradient": item.get("swatch", ""),
                "match_score": score,
            }
        )

    ranked.sort(key=lambda x: x["match_score"], reverse=True)
    for rank_pos, r_item in enumerate(ranked, start=1):
        r_item["rank"] = rank_pos

    telemetry_obj = {
        "mean_luma": mean_luma,
        "p95_luma": p95_luma,
        "highlight_pct": highlight_pct,
        "clip_pct": clip_pct,
        "shadow_pct": shadow_pct,
        "contrast_std": contrast_std,
        "warmth_rb": warmth_rb,
        "mean_saturation": mean_sat,
        "lighting_summary": lighting_summary,
        "wb_summary": wb_summary,
        "lighting_tag": f"{lighting_summary} · Clip {clip_pct:.1f}%",
        "temp_tag": wb_summary,
    }
    result = {
        "project": project_name,
        "video_signature": sig,
        "telemetry": telemetry_obj,
        "metrics": telemetry_obj,
        "recommended_auto_color": {
            "enabled": True,
            "intensity": 80,
            "brightness": auto_brightness,
            "gamma": auto_gamma,
            "highlight_recovery": highlight_recovery,
            "contrast": auto_contrast,
            "saturation": auto_saturation,
            "temperature": auto_temp,
        },
        "ranked_luts": ranked,
        "top_3_luts": ranked[:3],
        "all_10_luts": ranked,
    }
    cache_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return _append_custom_luts(proj_dir, result)


def _append_custom_luts(proj_dir: Path, data: dict[str, Any]) -> dict[str, Any]:
    lut_dir = proj_dir / "04_assets" / "luts"
    custom: list[str] = []
    if lut_dir.exists():
        builtin_ids = {f"{x['id']}.cube" for x in LUT_CATALOG}
        custom = sorted(
            p.name for p in lut_dir.iterdir()
            if p.is_file() and p.suffix.lower() in {".cube", ".3dl"} and p.name not in builtin_ids
        )
    data["custom_lut_files"] = custom
    ranked = data.get("ranked_luts", [])
    for item in ranked:
        item.setdefault("description", item.get("desc", ""))
        item.setdefault("preview_gradient", item.get("swatch", ""))
    data.setdefault("all_10_luts", ranked)
    data.setdefault("top_3_luts", ranked[:3])
    if "telemetry" in data and "metrics" not in data:
        t = data["telemetry"]
        t.setdefault("lighting_tag", t.get("lighting_summary", ""))
        t.setdefault("temp_tag", t.get("wb_summary", ""))
        data["metrics"] = t
    return data


def default_color_config() -> dict[str, Any]:
    return {
        "autoColorEnabled": False,
        "autoColorIntensity": 80,
        "lutId": "",
        "lutIntensity": 85,
        "brightness": 0.0,
        "contrast": 1.0,
        "saturation": 1.0,
        "temperature": 0,
        "adjustmentLayer": {
            "enabled": False,
            "startFrame": 0,
            "endFrame": 900,
            "label": "Adjustment Layer · Master Grade",
        },
        "syncedAcrossAll": True,
    }


def _scale_cube_lut_intensity(cube_bytes: bytes, intensity_pct: float) -> bytes:
    """Blend 3D .cube LUT with identity (r, g, b) according to intensity_pct (0..100)."""
    alpha = max(0.0, min(1.0, float(intensity_pct) / 100.0))
    if alpha >= 0.99:
        return cube_bytes
    text = cube_bytes.decode("utf-8", errors="ignore")
    out_lines: list[str] = []
    size = 17
    data_idx = 0
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("LUT_3D_SIZE"):
            try:
                size = int(s.split()[1])
            except Exception:
                size = 17
            out_lines.append(line)
        elif s and not s.startswith(("#", "TITLE", "DOMAIN_")) and len(s.split()) == 3:
            try:
                lr, lg, lb = (float(x) for x in s.split())
                r_i = data_idx % size
                g_i = (data_idx // size) % size
                b_i = (data_idx // (size * size)) % size
                id_r = r_i / max(1, size - 1)
                id_g = g_i / max(1, size - 1)
                id_b = b_i / max(1, size - 1)
                br = id_r + (lr - id_r) * alpha
                bg = id_g + (lg - id_g) * alpha
                bb = id_b + (lb - id_b) * alpha
                out_lines.append(f"{br:.5f} {bg:.5f} {bb:.5f}")
                data_idx += 1
            except Exception:
                out_lines.append(line)
        else:
            out_lines.append(line)
    return ("\n".join(out_lines) + "\n").encode("utf-8")


def build_ffmpeg_color_filter(proj_dir: Path, color_cfg: dict[str, Any] | None, analysis: dict[str, Any] | None = None) -> str:
    """Build highlight-safe FFmpeg filter chain: Filmic Curves + Gamma/Contrast Eq + White Balance + 3D LUT (.cube/.3dl)."""
    if not color_cfg:
        return ""
    filters: list[str] = []

    b = float(color_cfg.get("brightness", 0.0))
    c = float(color_cfg.get("contrast", 1.0))
    s = float(color_cfg.get("saturation", 1.0))
    temp = float(color_cfg.get("temperature", 0.0))
    gamma = 1.0
    hi_rec = 0.0

    if color_cfg.get("autoColorEnabled"):
        strength = max(0.0, min(1.0, float(color_cfg.get("autoColorIntensity", 80)) / 100.0))
        rec = (analysis or {}).get("recommended_auto_color", {})
        b += float(rec.get("brightness", 0.0)) * strength
        gamma = 1.0 + (float(rec.get("gamma", 1.05)) - 1.0) * strength
        hi_rec = float(rec.get("highlight_recovery", 0.5)) * strength
        c *= 1.0 + (float(rec.get("contrast", 1.03)) - 1.0) * strength
        s *= 1.0 + (float(rec.get("saturation", 1.06)) - 1.0) * strength
        temp += float(rec.get("temperature", 0.0)) * strength

        # Highlight Recovery & 'Trong trẻo' Black-Point Curve
        sh_anchor = 0.115
        hi_78 = 0.78 - 0.032 * hi_rec
        hi_92 = 0.92 - 0.045 * hi_rec
        hi_top = 1.0 - 0.025 * hi_rec
        filters.append(f"curves=m='0/0 0.12/{sh_anchor:.3f} 0.50/0.505 0.78/{hi_78:.3f} 0.92/{hi_92:.3f} 1/{hi_top:.3f}'")

    if abs(b) > 0.005 or abs(c - 1.0) > 0.005 or abs(s - 1.0) > 0.005 or abs(gamma - 1.0) > 0.005:
        filters.append(f"eq=gamma={gamma:.3f}:brightness={b:.3f}:contrast={c:.3f}:saturation={s:.3f}")

    if abs(temp) >= 1.0:
        shift = max(-0.18, min(0.18, temp * 0.004))
        filters.append(f"colorbalance=rm={shift:.3f}:bm={-shift:.3f}")

    lut_id = str(color_cfg.get("lutId", "") or "").strip()
    lut_intensity = float(color_cfg.get("lutIntensity", 85))
    if lut_id and lut_id.lower() != "none" and lut_intensity > 1.0:
        cube_path = ensure_cube_lut_file(proj_dir, lut_id)
        if cube_path and cube_path.exists():
            work_lut = proj_dir / "03_working" / f"_active_lut{cube_path.suffix.lower()}"
            work_lut.parent.mkdir(parents=True, exist_ok=True)
            raw_bytes = cube_path.read_bytes()
            if cube_path.suffix.lower() == ".cube":
                raw_bytes = _scale_cube_lut_intensity(raw_bytes, lut_intensity)
            work_lut.write_bytes(raw_bytes)
            filters.append(f"lut3d=file={work_lut.name}")

    return ",".join(filters)
