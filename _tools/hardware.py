"""Cross-platform Hardware Acceleration & Power Profile Engine (Windows & macOS)."""

from __future__ import annotations

import ctypes
import json
import os
import platform
import socket
import subprocess
import sys
from pathlib import Path
from typing import Any

from common import TOOLS_DIR, refresh_windows_path

CACHE_DIR = TOOLS_DIR / ".cache"
HW_CACHE_FILE = CACHE_DIR / "hardware_profile.json"
POWER_SETTINGS_FILE = CACHE_DIR / "power_settings.json"


def get_lan_ip() -> str:
    """Detect active LAN IPv4 address for mobile/Mac/Windows cross-device studio access."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def _detect_cpu_and_ram() -> tuple[str, int, float]:
    cores = os.cpu_count() or 4
    cpu_name = platform.processor() or platform.machine()
    ram_gb = 8.0

    if sys.platform == "darwin":
        try:
            out = subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"], text=True, timeout=3).strip()
            if out:
                cpu_name = out
        except Exception:
            pass
        try:
            mem = int(subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True, timeout=3).strip())
            ram_gb = round(mem / (1024**3), 1)
        except Exception:
            pass
    elif os.name == "nt":
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\Description\System\CentralProcessor\0") as k:
                val, _ = winreg.QueryValueEx(k, "ProcessorNameString")
                if val:
                    cpu_name = str(val).strip()
        except Exception:
            pass
        try:
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            ram_gb = round(stat.ullTotalPhys / (1024**3), 1)
        except Exception:
            pass
    return cpu_name, cores, ram_gb


def _detect_gpus() -> list[str]:
    gpus: list[str] = []
    if sys.platform == "darwin":
        try:
            out = subprocess.check_output(["system_profiler", "SPDisplaysDataType"], text=True, timeout=5)
            for line in out.splitlines():
                if "Chipset Model:" in line:
                    gpus.append(line.split(":", 1)[1].strip())
        except Exception:
            if platform.machine() == "arm64":
                gpus.append("Apple Silicon Integrated GPU (Metal + VideoToolbox)")
    elif os.name == "nt":
        try:
            import winreg

            key_path = r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path) as base:
                for i in range(16):
                    try:
                        with winreg.OpenKey(base, f"{i:04d}") as sub:
                            desc, _ = winreg.QueryValueEx(sub, "DriverDesc")
                            if desc and str(desc).strip() not in gpus:
                                gpus.append(str(desc).strip())
                    except OSError:
                        continue
        except Exception:
            pass
    return gpus or ["Standard Display Adapter"]


def _probe_ffmpeg_encoder(encoder: str) -> bool:
    refresh_windows_path()
    try:
        cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", "color=c=black:s=640x360:r=30:d=0.3",
            "-pix_fmt", "yuv420p", "-c:v", encoder,
            "-f", "null", "-",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=6)
        return r.returncode == 0
    except Exception:
        return False


def detect_hardware_profile(force_refresh: bool = False) -> dict[str, Any]:
    """Probe OS, CPU, RAM, GPU, FFmpeg hardware encoders, and Whisper compute capabilities."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if HW_CACHE_FILE.exists() and not force_refresh:
        try:
            cached = json.loads(HW_CACHE_FILE.read_text(encoding="utf-8"))
            if cached.get("os_platform") == sys.platform:
                cached["lan_ip"] = get_lan_ip()
                return cached
        except Exception:
            pass

    cpu_name, cores, ram_gb = _detect_cpu_and_ram()
    gpus = _detect_gpus()
    arch = platform.machine().lower()
    is_mac = sys.platform == "darwin"
    is_apple_silicon = is_mac and ("arm" in arch or "aarch64" in arch)
    is_windows = os.name == "nt"

    candidates = (
        ["h264_videotoolbox", "libx264"]
        if is_mac
        else ["h264_nvenc", "h264_qsv", "h264_amf", "libx264"]
    )
    available_encoders: list[str] = []
    for enc in candidates:
        if enc == "libx264" or _probe_ffmpeg_encoder(enc):
            available_encoders.append(enc)

    best_hw_encoder = available_encoders[0] if available_encoders else "libx264"

    cuda_count = 0
    try:
        import ctranslate2

        cuda_count = ctranslate2.get_cuda_device_count()
    except Exception:
        pass

    os_label = (
        f"macOS ({'Apple Silicon' if is_apple_silicon else 'Intel'})"
        if is_mac
        else f"Windows ({platform.release()})"
        if is_windows
        else f"Linux ({arch})"
    )

    encoder_labels = {
        "h264_videotoolbox": "Apple VideoToolbox (GPU Media Engine)",
        "h264_nvenc": "NVIDIA NVENC (GPU)",
        "h264_qsv": "Intel QuickSync QSV (GPU)",
        "h264_amf": "AMD AMF (GPU)",
        "libx264": "CPU Multi-Core (libx264)",
    }

    profile = {
        "os_platform": sys.platform,
        "os_label": os_label,
        "arch": arch,
        "is_mac": is_mac,
        "is_apple_silicon": is_apple_silicon,
        "is_windows": is_windows,
        "cpu_name": cpu_name,
        "cpu_cores": cores,
        "ram_gb": ram_gb,
        "gpus": gpus,
        "available_encoders": available_encoders,
        "best_encoder": best_hw_encoder,
        "best_encoder_label": encoder_labels.get(best_hw_encoder, best_hw_encoder),
        "whisper_device": "cuda" if cuda_count > 0 else "cpu",
        "whisper_compute": "float16" if cuda_count > 0 else "int8",
        "recommended_concurrency": max(2, min(8, cores - 2 if cores > 4 else cores)),
        "remotion_gl": "swangle" if is_mac else "angle",
        "lan_ip": get_lan_ip(),
    }
    HW_CACHE_FILE.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
    return profile


def get_power_settings() -> dict[str, Any]:
    """Return user-selected power mode & external website connection settings."""
    hw = detect_hardware_profile()
    defaults = {
        "power_mode": "auto",  # 'auto' | 'turbo_gpu' | 'quality_cpu' | 'eco'
        "lan_access": True,
        "remote_webhook_url": "",
        "prefer_native_window": True,
    }
    if POWER_SETTINGS_FILE.exists():
        try:
            saved = json.loads(POWER_SETTINGS_FILE.read_text(encoding="utf-8"))
            defaults.update(saved)
        except Exception:
            pass
    return {**defaults, "hardware": hw}


def save_power_settings(
    power_mode: str = "auto",
    lan_access: bool = True,
    remote_webhook_url: str = "",
    prefer_native_window: bool = True,
) -> dict[str, Any]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        "power_mode": power_mode if power_mode in ("auto", "turbo_gpu", "quality_cpu", "eco") else "auto",
        "lan_access": bool(lan_access),
        "remote_webhook_url": remote_webhook_url.strip(),
        "prefer_native_window": bool(prefer_native_window),
    }
    POWER_SETTINGS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return get_power_settings()


def get_video_encode_args(purpose: str = "base_cuts") -> list[str]:
    """Return optimal FFmpeg video codec arguments for current OS + GPU + Power Mode."""
    cfg = get_power_settings()
    mode = cfg["power_mode"]
    hw = cfg["hardware"]
    best = hw.get("best_encoder", "libx264")

    if mode == "quality_cpu" or best == "libx264":
        preset = "veryfast" if mode == "eco" else "fast"
        crf = "16" if purpose == "base_cuts" else "14"
        return ["-c:v", "libx264", "-preset", preset, "-crf", crf, "-g", "15", "-pix_fmt", "yuv420p"]

    if best == "h264_videotoolbox":
        # macOS Apple Silicon / Intel hardware encoder
        q_val = "72" if purpose == "base_cuts" else "78"
        return ["-c:v", "h264_videotoolbox", "-q:v", q_val, "-allow_sw", "1", "-g", "15", "-pix_fmt", "yuv420p"]

    if best == "h264_nvenc":
        cq = "17" if purpose == "base_cuts" else "15"
        return ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", cq, "-g", "15", "-pix_fmt", "yuv420p"]

    if best == "h264_qsv":
        gq = "18" if purpose == "base_cuts" else "16"
        return ["-c:v", "h264_qsv", "-global_quality", gq, "-g", "15", "-pix_fmt", "yuv420p"]

    if best == "h264_amf":
        return ["-c:v", "h264_amf", "-quality", "quality", "-g", "15", "-pix_fmt", "yuv420p"]

    return ["-c:v", "libx264", "-preset", "fast", "-crf", "16", "-g", "15", "-pix_fmt", "yuv420p"]


def get_remotion_flags() -> list[str]:
    """Return Remotion CLI concurrency and GL backend flags tuned for the active OS & Power Mode."""
    cfg = get_power_settings()
    mode = cfg["power_mode"]
    hw = cfg["hardware"]
    cores = int(hw.get("cpu_cores", 4))

    if mode == "eco":
        conc = 2
    elif mode == "turbo_gpu":
        conc = max(4, min(12, cores))
    else:
        conc = int(hw.get("recommended_concurrency", 4))

    flags = [f"--concurrency={conc}"]
    if hw.get("is_windows"):
        flags.append("--gl=angle")
    return flags
