#!/bin/bash
# Build macOS Drag-and-Drop .dmg Installer for anthinh Studio (run on macOS / GitHub Actions macos-latest)

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
STAGE_DIR="$DIST_DIR/dmg_stage"
APP_OUT="$STAGE_DIR/AnThinh Studio.app"
STUDIO_OUT="$APP_OUT/Contents/Resources/studio"
DMG_PATH="$DIST_DIR/AnThinh-Studio-macOS.dmg"

if [ "$(uname)" != "Darwin" ]; then
    echo "[LOI] Script nay can chay tren macOS (vi can cong cu hdiutil cua Apple)."
    exit 1
fi

rm -rf "$STAGE_DIR" "$DMG_PATH"
mkdir -p "$STUDIO_OUT/Projects" "$STUDIO_OUT/_style_refs"

# 1. Copy .app bundle skeleton (Info.plist, AnThinhStudio, AnThinhStudio.icns)
cp -R "$ROOT_DIR/AnThinh Studio.app" "$APP_OUT"

# 2. Embed clean workspace payload inside .app/Contents/Resources/studio
rsync -a \
    --exclude='.venv' \
    --exclude='node_modules' \
    --exclude='.cache' \
    --exclude='.env' \
    --exclude='__pycache__' \
    --exclude='.remotion' \
    --exclude='dist' \
    --exclude='out' \
    --exclude='*.pyc' \
    "$ROOT_DIR/_tools/" "$STUDIO_OUT/_tools/"

rsync -a "$ROOT_DIR/.agents/" "$STUDIO_OUT/.agents/"
rsync -a "$ROOT_DIR/Projects/_template/" "$STUDIO_OUT/Projects/_template/"
rsync -a --exclude='*.mp4' --exclude='*.mov' --exclude='*.mkv' --exclude='*.webm' --exclude='*.xlsx' --exclude='_frames' \
    "$ROOT_DIR/_style_refs/" "$STUDIO_OUT/_style_refs/"

cp -f "$ROOT_DIR/AnThinh Studio.command" "$STUDIO_OUT/AnThinh Studio.command"
[ -f "$ROOT_DIR/README.md" ] && cp -f "$ROOT_DIR/README.md" "$STUDIO_OUT/README.md"
date -u +"%Y%m%d-%H%M%S" > "$STUDIO_OUT/.bundle_version"

chmod +x "$APP_OUT/Contents/MacOS/AnThinhStudio" "$STUDIO_OUT/AnThinh Studio.command"
ln -s /Applications "$STAGE_DIR/Applications"

# 3. Create compressed UDZO .dmg image
hdiutil create \
    -volname "anthinh Studio" \
    -srcfolder "$STAGE_DIR" \
    -ov \
    -format UDZO \
    "$DMG_PATH"

rm -rf "$STAGE_DIR"
echo "Da tao xong file cai dat macOS DMG: $DMG_PATH"
