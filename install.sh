#!/bin/bash
set -e

# =============================================================================
# Productiviteit ATR - Install Script (macOS / Linux)
# =============================================================================
# This script installs all dependencies needed to run the application.
# It is safe to run multiple times (idempotent).
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

# --- 5. Install Python build tools (needed for better-sqlite3 native module) ---
log_step "Build tools controleren..."
if [ "$OS" = "Darwin" ]; then
  if xcode-select -p &>/dev/null; then
    log_info "Xcode Command Line Tools gevonden."
  else
    log_warn "Xcode Command Line Tools installeren..."
    xcode-select --install 2>/dev/null || true
    log_info "Volg de prompt om Xcode Command Line Tools te installeren en draai dit script opnieuw."
  fi
fi

# --- 6. Install npm dependencies ---
log_step "Node.js dependencies installeren..."
cd "$PROJECT_DIR"

if [ -d "node_modules" ]; then
  log_info "node_modules gevonden. Dependencies updaten..."
  npm install
else
  log_info "Dependencies installeren (dit kan even duren)..."
  npm install
fi

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
npx electron-rebuild 2>/dev/null || {
  log_warn "electron-rebuild niet beschikbaar, handmatig rebuilden..."
  npm rebuild better-sqlite3
}

# --- Done ---
echo -e "\n${GREEN}${BOLD}✓ Installatie compleet!${NC}\n"
echo -e "Start de applicatie met:"
echo -e "  ${BOLD}npm start${NC}\n"
echo -e "Of bouw een .dmg installer:"
echo -e "  ${BOLD}npm run build${NC}\n"
