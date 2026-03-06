#!/bin/bash
# =============================================================================
# Creates a macOS .app bundle for Productiviteit ATR
# This creates a native-looking app that can be placed in /Applications or Dock
# =============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="Productiviteit ATR"
APP_DIR="${PROJECT_DIR}/dist/${APP_NAME}.app"
CONTENTS="${APP_DIR}/Contents"
MACOS="${CONTENTS}/MacOS"
RESOURCES="${CONTENTS}/Resources"

echo "Creating ${APP_NAME}.app..."

# Clean previous build
rm -rf "${APP_DIR}"

# Create directory structure
mkdir -p "${MACOS}"
mkdir -p "${RESOURCES}"

# --- Info.plist ---
cat > "${CONTENTS}/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIdentifier</key>
    <string>com.atr.productiviteit</string>
    <key>CFBundleName</key>
    <string>Productiviteit ATR</string>
    <key>CFBundleDisplayName</key>
    <string>Productiviteit ATR</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleIconFile</key>
    <string>app.icns</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

# --- Launcher script ---
cat > "${MACOS}/launcher" << LAUNCHER
#!/bin/bash
# Productiviteit ATR Launcher
# This script starts the Electron app from the project directory.

PROJECT_DIR="${PROJECT_DIR}"

# Ensure we're using the right PATH for node/npm
export PATH="/usr/local/bin:/opt/homebrew/bin:\$PATH"

# Check if node_modules exist
if [ ! -d "\${PROJECT_DIR}/node_modules" ]; then
    osascript -e 'display dialog "De applicatie is nog niet geïnstalleerd.\n\nVraag je IT-beheerder om install.sh uit te voeren." with title "Productiviteit ATR" buttons {"OK"} default button "OK" with icon caution'
    exit 1
fi

# Check if node is available
if ! command -v node &>/dev/null; then
    osascript -e 'display dialog "Node.js is niet gevonden.\n\nVraag je IT-beheerder om install.sh opnieuw uit te voeren." with title "Productiviteit ATR" buttons {"OK"} default button "OK" with icon caution'
    exit 1
fi

cd "\${PROJECT_DIR}"

# Rebuild native modules for Electron if needed (silently)
npx electron-rebuild -f -w better-sqlite3 2>/dev/null &

# Start the Electron app
npx electron . 2>/dev/null &
LAUNCHER

chmod +x "${MACOS}/launcher"

# --- Create app icon ---
"${PROJECT_DIR}/scripts/create-icon.sh" "${RESOURCES}/app.icns" 2>/dev/null || true

echo "✓ ${APP_NAME}.app created at: ${APP_DIR}"
