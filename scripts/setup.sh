#!/usr/bin/env bash
# NeuroTree — Setup Otomatis (Mac/Linux)
# Jalankan SATU KALI di mesin baru setelah clone repo
#
# Usage:
#   bash scripts/setup.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log_step() { echo -e "\n${CYAN}▶  $1${NC}"; }
log_ok()   { echo -e "   ${GREEN}✅  $1${NC}"; }
log_warn() { echo -e "   ${YELLOW}⚠️   $1${NC}"; }
log_err()  { echo -e "   ${RED}❌  $1${NC}"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       NeuroTree  —  Setup Otomatis       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

# ── 1. Cek tools ──────────────────────────────────────────────────────────────
log_step "Mengecek tools yang dibutuhkan…"

MISSING=()
command -v python3 >/dev/null 2>&1 || MISSING+=("Python 3.10+  →  https://python.org/downloads")
command -v node    >/dev/null 2>&1 || MISSING+=("Node.js 18+   →  https://nodejs.org")
command -v pnpm    >/dev/null 2>&1 || MISSING+=("pnpm          →  npm install -g pnpm")

if [ ${#MISSING[@]} -gt 0 ]; then
    log_err "Tools berikut belum terinstall:"
    for m in "${MISSING[@]}"; do echo "     - $m"; done
    echo ""
    exit 1
fi

log_ok "Python   : $(python3 --version)"
log_ok "Node     : $(node --version)"
log_ok "pnpm     : $(pnpm --version)"

# Langflow
if python3 -c "import langflow" 2>/dev/null; then
    log_ok "Langflow : terinstall"
else
    log_warn "Langflow belum terinstall. Install dengan: pip install langflow"
fi

# ── 2. Backend venv ───────────────────────────────────────────────────────────
log_step "Menyiapkan Python virtual environment…"

VENV="$ROOT/backend/venv"
if [ ! -d "$VENV" ]; then
    python3 -m venv "$VENV"
    log_ok "venv dibuat di backend/venv"
else
    log_ok "venv sudah ada — skip"
fi

# ── 3. Install Python deps ────────────────────────────────────────────────────
log_step "Menginstall Python dependencies…"
"$VENV/bin/pip" install -r "$ROOT/backend/requirements.txt" -q
log_ok "Python dependencies terinstall"

# ── 4. Buat .env ──────────────────────────────────────────────────────────────
log_step "Menyiapkan file konfigurasi backend/.env…"

ENV_PATH="$ROOT/backend/.env"
EXAMPLE="$ROOT/backend/.env.example"

if [ ! -f "$ENV_PATH" ]; then
    cp "$EXAMPLE" "$ENV_PATH"
    log_ok "backend/.env dibuat dari .env.example"
    echo ""
    echo -e "   ${YELLOW}┌─────────────────────────────────────────────────────┐${NC}"
    echo -e "   ${YELLOW}│  WAJIB: buka backend/.env dan isi:                  │${NC}"
    echo -e "   ${YELLOW}│    LANGFLOW_API_KEY = (dari Langflow UI → Settings) │${NC}"
    echo -e "   ${YELLOW}│  Flow IDs akan diisi otomatis oleh import_flows.py  │${NC}"
    echo -e "   ${YELLOW}└─────────────────────────────────────────────────────┘${NC}"
else
    log_ok "backend/.env sudah ada — skip"
fi

# P0-4: frontend/.env (VITE_API_URL) — hanya perlu diisi untuk production deploy
FE_ENV="$ROOT/frontend/.env"
FE_EXAMPLE="$ROOT/frontend/.env.example"
if [ ! -f "$FE_ENV" ]; then
    cp "$FE_EXAMPLE" "$FE_ENV"
    log_ok "frontend/.env dibuat dari .env.example (VITE_API_URL kosong = pakai localhost:8000)"
else
    log_ok "frontend/.env sudah ada — skip"
fi

# ── 5. Frontend dependencies ──────────────────────────────────────────────────
log_step "Menginstall frontend dependencies (pnpm install)…"
cd "$ROOT/frontend" && pnpm install --silent
cd "$ROOT"
log_ok "Frontend dependencies terinstall"

# ── 6. Panduan berikutnya ─────────────────────────────────────────────────────
FLOWS_DIR="$ROOT/langflow_flows"
HAS_FLOWS=false
if [ -d "$FLOWS_DIR" ] && ls "$FLOWS_DIR"/NT-*.json 1>/dev/null 2>&1; then
    HAS_FLOWS=true
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Setup selesai!                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

if [ "$HAS_FLOWS" = true ]; then
    echo -e "  Langkah selanjutnya:"
    echo    "  1. Jalankan Langflow  : langflow run"
    echo    "  2. Import flows       : python3 scripts/import_flows.py"
    echo    "  3. Jalankan semua     : bash scripts/dev.sh"
else
    echo -e "  Langkah selanjutnya:"
    echo    "  1. Minta file langflow_flows/ dari temanmu"
    echo    "  2. Jalankan Langflow  : langflow run"
    echo    "  3. Import flows       : python3 scripts/import_flows.py"
    echo    "  4. Isi backend/.env   : LANGFLOW_API_KEY"
    echo    "  5. Jalankan semua     : bash scripts/dev.sh"
fi
echo ""
