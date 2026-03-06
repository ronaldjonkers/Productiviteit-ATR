#!/bin/bash
set -e

# =============================================================================
# Productiviteit ATR - Install Script (macOS / Linux)
# =============================================================================
# Dit script installeert alles wat nodig is en maakt een app-icoon aan
# zodat de gebruiker de applicatie kan starten vanuit Finder of het Dock.
# Veilig om meerdere keren te draaien (idempotent).
# =============================================================================

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${BOLD}→ $1${NC}"; }

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Productiviteit ATR"

echo -e "\n${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Productiviteit ATR - Installer             ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}\n"

# --- 1. Check OS ---
log_step "Besturingssysteem controleren..."
OS="$(uname -s)"
case "$OS" in
  Darwin) log_info "macOS gedetecteerd." ;;
  Linux)  log_info "Linux gedetecteerd." ;;
  *)      log_error "Niet ondersteund OS: $OS"; exit 1 ;;
esac

# --- 2. Check/Install Homebrew (macOS only) ---
if [ "$OS" = "Darwin" ]; then
  log_step "Homebrew controleren..."
  if command -v brew &>/dev/null; then
    log_info "Homebrew is al geïnstalleerd."
  else
    log_warn "Homebrew niet gevonden. Installeren..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add brew to PATH for Apple Silicon Macs
    if [ -f /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    log_info "Homebrew geïnstalleerd."
  fi
fi

# --- 3. Check/Install Node.js ---
log_step "Node.js controleren..."
REQUIRED_NODE_MAJOR=18

if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -ge "$REQUIRED_NODE_MAJOR" ]; then
    log_info "Node.js $(node -v) gevonden (vereist: >= v${REQUIRED_NODE_MAJOR})."
  else
    log_warn "Node.js $(node -v) is te oud. Upgraden naar v${REQUIRED_NODE_MAJOR}+..."
    if [ "$OS" = "Darwin" ]; then
      brew install node
    else
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
    fi
  fi
else
  log_warn "Node.js niet gevonden. Installeren..."
  if [ "$OS" = "Darwin" ]; then
    brew install node
  else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  log_info "Node.js $(node -v) geïnstalleerd."
fi

# --- 4. Check npm ---
log_step "npm controleren..."
if command -v npm &>/dev/null; then
  log_info "npm $(npm -v) gevonden."
else
  log_error "npm niet gevonden. Installeer Node.js opnieuw."
  exit 1
fi

# --- 5. Check build tools ---
log_step "Build tools controleren..."
if [ "$OS" = "Darwin" ]; then
  if xcode-select -p &>/dev/null; then
    log_info "Xcode Command Line Tools gevonden."
  else
    log_warn "Xcode Command Line Tools installeren..."
    xcode-select --install 2>/dev/null || true
    echo -e "${YELLOW}Volg de prompt om Xcode Command Line Tools te installeren.${NC}"
    echo -e "${YELLOW}Draai daarna dit script opnieuw: ./install.sh${NC}"
    exit 0
  fi
fi

# --- 6. Install npm dependencies ---
log_step "Node.js dependencies installeren..."
cd "$PROJECT_DIR"
npm install

# --- 7. Verify installation ---
log_step "Installatie verifiëren..."

if [ -d "node_modules/electron" ] && [ -d "node_modules/better-sqlite3" ] && [ -d "node_modules/exceljs" ]; then
  log_info "Alle dependencies succesvol geïnstalleerd."
else
  log_error "Niet alle dependencies zijn geïnstalleerd. Probeer: npm install"
  exit 1
fi

# --- 8. Rebuild native modules for Electron ---
log_step "Native modules rebuilden voor Electron..."
npx electron-rebuild -f -w better-sqlite3 2>/dev/null || {
  log_warn "electron-rebuild gefaald, fallback..."
  npm rebuild better-sqlite3 2>/dev/null || true
}

# --- 9. Create macOS .app bundle ---
if [ "$OS" = "Darwin" ]; then
  log_step "macOS applicatie aanmaken..."

  APP_DIR="/Applications/${APP_NAME}.app"
  CONTENTS="${APP_DIR}/Contents"
  MACOS="${CONTENTS}/MacOS"
  RESOURCES="${CONTENTS}/Resources"

  # Remove old version
  rm -rf "${APP_DIR}"

  # Create directory structure
  mkdir -p "${MACOS}"
  mkdir -p "${RESOURCES}"

  # Info.plist
  cat > "${CONTENTS}/Info.plist" << PLIST
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
</dict>
</plist>
PLIST

  # Launcher script
  cat > "${MACOS}/launcher" << 'LAUNCHEREOF'
#!/bin/bash
# Productiviteit ATR - App Launcher
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

LAUNCHEREOF

  # Append PROJECT_DIR as a literal (not variable-expanded in heredoc)
  echo "PROJECT_DIR=\"${PROJECT_DIR}\"" >> "${MACOS}/launcher"

  cat >> "${MACOS}/launcher" << 'LAUNCHEREOF2'

# Check if project exists
if [ ! -d "${PROJECT_DIR}/node_modules" ]; then
    osascript -e 'display dialog "De applicatie is nog niet geïnstalleerd.\n\nVraag je IT-beheerder om install.sh uit te voeren." with title "Productiviteit ATR" buttons {"OK"} default button "OK" with icon caution'
    exit 1
fi

# Check node
if ! command -v node &>/dev/null; then
    osascript -e 'display dialog "Node.js is niet gevonden op deze computer.\n\nVraag je IT-beheerder om install.sh opnieuw uit te voeren." with title "Productiviteit ATR" buttons {"OK"} default button "OK" with icon caution'
    exit 1
fi

cd "${PROJECT_DIR}"

# Silently rebuild native modules if needed
npx electron-rebuild -f -w better-sqlite3 2>/dev/null &

# Launch the Electron app
exec npx electron . 2>/dev/null
LAUNCHEREOF2

  chmod +x "${MACOS}/launcher"

  # Generate app icon
  chmod +x "${PROJECT_DIR}/scripts/create-icon.sh" 2>/dev/null || true
  bash "${PROJECT_DIR}/scripts/create-icon.sh" "${RESOURCES}/app.icns" 2>/dev/null || true

  log_info "App aangemaakt in /Applications/${APP_NAME}.app"

  # --- 10. Create Desktop alias ---
  DESKTOP_ALIAS="$HOME/Desktop/${APP_NAME}"
  rm -f "${DESKTOP_ALIAS}" 2>/dev/null || true
  ln -sf "${APP_DIR}" "${DESKTOP_ALIAS}" 2>/dev/null || true
  log_info "Snelkoppeling op bureaublad aangemaakt."

  # Clear quarantine attribute so macOS doesn't block it
  xattr -dr com.apple.quarantine "${APP_DIR}" 2>/dev/null || true
fi

# --- Done ---
echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓ Installatie compleet!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${NC}\n"

if [ "$OS" = "Darwin" ]; then
  echo -e "De applicatie is nu beschikbaar als:\n"
  echo -e "  ${BOLD}1. App in /Applications/${APP_NAME}.app${NC}"
  echo -e "     → Dubbelklik om te openen, of sleep naar het Dock\n"
  echo -e "  ${BOLD}2. Snelkoppeling op het bureaublad${NC}\n"
  echo -e "  ${BOLD}3. Via Terminal:${NC} npm start\n"
  echo -e "Updates kunnen vanuit de app zelf worden geïnstalleerd.\n"
else
  echo -e "Start de applicatie met:\n"
  echo -e "  ${BOLD}npm start${NC}\n"
fi
