"""Cross-platform Standalone Desktop Application Launcher for anthinh Studio (Windows & macOS).
Supports:
- Native frameless App Window mode (Edge/Chrome App Mode on Windows & macOS, or Safari/default browser fallback)
- Auto-bootstrapper (--setup) for new Mac/Windows machines
- Dual localhost + LAN server binding so external devices/websites can connect.
"""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = TOOLS_DIR.parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from common import REMOTION_DIR, refresh_windows_path
from hardware import detect_hardware_profile, get_power_settings


def is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex((host, port)) == 0


def open_native_app_window(url: str) -> bool:
    """Open URL as a standalone desktop application window (no browser address bar/tabs)."""
    app_url = f"{url}?mode=desktop" if "?" not in url else f"{url}&mode=desktop"

    if os.name == "nt":
        # Ưu tiên Microsoft Edge WebView/App mode có sẵn trên mọi máy Windows 10/11 hoặc Chrome
        win_browsers = [
            Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
            Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
            Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Google" / "Chrome" / "Application" / "chrome.exe",
            Path(os.environ.get("LocalAppData", "")) / "Google" / "Chrome" / "Application" / "chrome.exe",
        ]
        for exe in win_browsers:
            if exe.exists():
                subprocess.Popen([
                    str(exe),
                    f"--app={app_url}",
                    "--window-size=1480,920",
                    "--disable-features=Translate",
                ])
                return True
    elif sys.platform == "darwin":
        mac_browsers = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ]
        for exe in mac_browsers:
            if Path(exe).exists():
                subprocess.Popen([
                    exe,
                    f"--app={app_url}",
                    "--window-size=1480,920",
                ])
                return True
        if shutil.which("open"):
            subprocess.Popen(["open", url])
            return True

    webbrowser.open(url)
    return False


def ensure_cross_platform_env() -> None:
    """Auto-install node_modules on a new Mac/Windows machine if missing."""
    refresh_windows_path()
    if not (REMOTION_DIR / "node_modules").exists():
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        if shutil.which(npm_cmd):
            print("[WishEdit] Đang cài đặt Remotion node_modules lần đầu...")
            subprocess.run([npm_cmd, "install"], cwd=str(REMOTION_DIR), check=False)


def main() -> None:
    parser = argparse.ArgumentParser(description="Khởi chạy phần mềm WishEdit Desktop (Windows & macOS).")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--web", action="store_true", help="Mở bằng tab trình duyệt thay vì cửa sổ App độc lập")
    parser.add_argument("--no-window", action="store_true", help="Chỉ chạy server nền, không mở cửa sổ")
    args = parser.parse_args()

    ensure_cross_platform_env()
    hw = detect_hardware_profile()
    pwr = get_power_settings()

    bind_host = "0.0.0.0" if pwr.get("lan_access", False) else "127.0.0.1"
    local_url = f"http://127.0.0.1:{args.port}"
    lan_url = f"http://{hw.get('lan_ip', '127.0.0.1')}:{args.port}"

    print("========================================================")
    print(f"  WishEdit Desktop App ({hw['os_label']})")
    print(f"  CPU: {hw['cpu_name']} ({hw['cpu_cores']} luồng, {hw['ram_gb']} GB RAM)")
    print(f"  Tăng tốc phần cứng: {hw['best_encoder_label']}")
    print(f"  Local Studio: {local_url}")
    print("========================================================")

    use_native_app = not args.web and pwr.get("prefer_native_window", True)

    if is_port_open("127.0.0.1", args.port):
        print(f"[WishEdit] Ứng dụng đang chạy tại {local_url} — đang mở cửa sổ App...")
        if not args.no_window:
            if use_native_app:
                open_native_app_window(local_url)
            else:
                webbrowser.open(local_url)
        return

    if not args.no_window:
        def _launch_ui() -> None:
            for _ in range(40):
                if is_port_open("127.0.0.1", args.port):
                    if use_native_app:
                        open_native_app_window(local_url)
                    else:
                        webbrowser.open(local_url)
                    return
                time.sleep(0.25)

        threading.Thread(target=_launch_ui, daemon=True).start()

    import logging
    import uvicorn
    from server.app import app

    class _QuietJobsPollFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            msg = record.getMessage()
            return "/api/jobs/" not in msg

    logging.getLogger("uvicorn.access").addFilter(_QuietJobsPollFilter())
    uvicorn.run(app, host=bind_host, port=args.port)


if __name__ == "__main__":
    main()
