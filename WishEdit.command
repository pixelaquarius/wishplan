#!/bin/bash
# WishEdit — macOS & Linux One-Click Auto-Installer & Native App Launcher
set -u
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
[ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"

echo "========================================================"
echo "  WishEdit — Kiem tra moi truong & Khoi dong App"
echo "========================================================"

missing_formulas=()
command -v python3 >/dev/null 2>&1 || missing_formulas+=("python")
{ command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; } || missing_formulas+=("ffmpeg")
command -v node >/dev/null 2>&1 || missing_formulas+=("node")

if [ "${#missing_formulas[@]}" -gt 0 ]; then
    echo "[1/3] Thieu cong cu nen tang: ${missing_formulas[*]}"
    if ! command -v brew >/dev/null 2>&1; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || exit 1
        [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
        [ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
    fi
    brew install "${missing_formulas[@]}" || exit 1
fi

VENV_PY="_tools/.venv/bin/python"
if [ ! -f "$VENV_PY" ] && [ -d "_tools/.venv" ]; then
    rm -rf _tools/.venv
fi

if [ ! -f "$VENV_PY" ]; then
    echo "[2/3] Dang tao Python venv & cai dat AI/Whisper/FastAPI..."
    if command -v uv >/dev/null 2>&1; then
        uv venv _tools/.venv && uv pip install --python "$VENV_PY" fastapi uvicorn python-multipart faster-whisper pillow edge-tts
    else
        python3 -m venv _tools/.venv && "$VENV_PY" -m pip install --upgrade pip && "$VENV_PY" -m pip install fastapi uvicorn python-multipart faster-whisper pillow edge-tts
    fi
fi

if [ -d "_tools/remotion" ] && [ ! -d "_tools/remotion/node_modules" ]; then
    echo "[3/3] Dang cai dat Remotion & Chromium headless..."
    (cd _tools/remotion && npm install && npx --yes remotion browser ensure || true)
fi

exec "$VENV_PY" _tools/desktop_app.py "$@"
