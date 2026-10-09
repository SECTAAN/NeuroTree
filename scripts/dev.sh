#!/usr/bin/env bash
# NeuroTree — Dev Server (Mac/Linux)
# Nyalakan Backend + Frontend + Langflow sekaligus
#
# Usage:
#   bash scripts/dev.sh
#
# Tekan Ctrl+C untuk menghentikan semua service.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/backend/venv"
PYTHON="$VENV/bin/python"
[ ! -f "$PYTHON" ] && PYTHON="python3"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; DARK='\033[0;90m'; NC='\033[0m'

check_port() { nc -z localhost "$1" 2>/dev/null; }

PIDS=()

cleanup() {
    echo -e "\n\n  ${YELLOW}🛑  Menghentikan semua service…${NC}"
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null
    done
    wait 2>/dev/null
    echo -e "  ${GREEN}✅  Semua service dihentikan.${NC}\n"
    exit 0
}
trap cleanup INT TERM

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      NeuroTree  —  Dev Mode              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Langflow ──────────────────────────────────────────────────────────────────
if check_port 7860; then
    echo -e "  ${GREEN}✅  Langflow sudah berjalan di port 7860${NC}"
else
    echo -e "  ${CYAN}🚀  Memulai Langflow (port 7860)…${NC}"
    python3 -m langflow run --host 0.0.0.0 --port 7860 \
        > "$ROOT/langflow.log" 2>&1 &
    PIDS+=($!)
    echo -e "     ${DARK}Log: langflow.log${NC}"

    echo -n "     Menunggu Langflow siap"
    for i in $(seq 1 20); do
        sleep 2
        echo -n "."
        check_port 7860 && break
    done
    echo ""
    if check_port 7860; then
        echo -e "     ${GREEN}✅  Langflow siap di http://localhost:7860${NC}"
    else
        echo -e "     ${YELLOW}⚠️   Langflow belum merespons — lanjut tanpa menunggu${NC}"
    fi
fi

# ── Backend ───────────────────────────────────────────────────────────────────
echo -e "  ${CYAN}🚀  Memulai Backend FastAPI (port 8000)…${NC}"
cd "$ROOT/backend"
"$PYTHON" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
    > "$ROOT/backend.log" 2>&1 &
PIDS+=($!)
cd "$ROOT"
echo -e "     ${DARK}Log: backend.log${NC}"

echo -n "     Menunggu backend siap"
for i in $(seq 1 15); do
    sleep 1; echo -n "."
    check_port 8000 && break
done
echo ""
if check_port 8000; then
    echo -e "     ${GREEN}✅  Backend siap di http://localhost:8000${NC}"
else
    echo -e "     ${YELLOW}⚠️   Backend belum merespons — cek backend.log${NC}"
fi

# ── Frontend ──────────────────────────────────────────────────────────────────
echo -e "  ${CYAN}🚀  Memulai Frontend Vite (port 5173)…${NC}"
cd "$ROOT/frontend"
pnpm dev > "$ROOT/frontend.log" 2>&1 &
PIDS+=($!)
cd "$ROOT"
echo -e "     ${DARK}Log: frontend.log${NC}"

echo -n "     Menunggu frontend siap"
for i in $(seq 1 15); do
    sleep 1; echo -n "."
    check_port 5173 && break
done
echo ""
if check_port 5173; then
    echo -e "     ${GREEN}✅  Frontend siap di http://localhost:5173${NC}"
else
    echo -e "     ${YELLOW}⚠️   Frontend belum merespons — cek frontend.log${NC}"
fi

# ── Status ringkas ────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Semua service berjalan!                 ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  🌐  Frontend  http://localhost:5173     ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ⚡  Backend   http://localhost:8000     ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🤖  Langflow  http://localhost:7860     ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  📖  API Docs  http://localhost:8000/docs${GREEN}║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${DARK}║  Logs: backend.log  frontend.log         ║${NC}"
echo -e "${DARK}║        langflow.log                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${DARK}Tekan Ctrl+C untuk menghentikan semua service.${NC}"
echo ""

# Tunggu sampai Ctrl+C
wait
