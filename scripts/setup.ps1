# NeuroTree — Setup Otomatis (Windows)
# Jalankan SATU KALI di mesin baru setelah clone repo
#
# Usage:
#   .\scripts\setup.ps1
#
# Yang dilakukan script ini:
#   1. Cek semua tools yang dibutuhkan (Python, Node, pnpm, Langflow)
#   2. Buat Python virtual environment backend
#   3. Install semua Python dependencies
#   4. Buat .env dari .env.example (jika belum ada)
#   5. Init database (tabel dibuat otomatis saat backend start)
#   6. Install frontend dependencies (pnpm install)
#   7. Panduan import Langflow flows

$ErrorActionPreference = "Stop"

$GREEN  = "Green"
$YELLOW = "Yellow"
$RED    = "Red"
$CYAN   = "Cyan"

function Log-Step($msg)  { Write-Host "`n▶  $msg" -ForegroundColor $CYAN }
function Log-OK($msg)    { Write-Host "   ✅  $msg" -ForegroundColor $GREEN }
function Log-Warn($msg)  { Write-Host "   ⚠️   $msg" -ForegroundColor $YELLOW }
function Log-Error($msg) { Write-Host "   ❌  $msg" -ForegroundColor $RED }

$ROOT = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       NeuroTree  —  Setup Otomatis       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan

# ── 1. Cek tools ──────────────────────────────────────────────────────────────
Log-Step "Mengecek tools yang dibutuhkan…"

$missing = @()

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    $missing += "Python 3.10+  →  https://python.org/downloads"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $missing += "Node.js 18+   →  https://nodejs.org"
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    $missing += "pnpm          →  npm install -g pnpm"
}

if ($missing.Count -gt 0) {
    Log-Error "Tools berikut belum terinstall:"
    $missing | ForEach-Object { Write-Host "     - $_" -ForegroundColor $RED }
    Write-Host ""
    exit 1
}

Log-OK "Python   : $(python --version)"
Log-OK "Node     : $(node --version)"
Log-OK "pnpm     : $(pnpm --version)"

# Langflow (opsional saat setup — wajib saat dev)
$langflowOK = $false
try {
    $lf = python -c "import langflow; print('ok')" 2>$null
    if ($lf -eq "ok") {
        $langflowOK = $true
        Log-OK "Langflow : terinstall"
    }
} catch {}
if (-not $langflowOK) {
    Log-Warn "Langflow belum terinstall. Install dengan: pip install langflow"
    Log-Warn "(Langflow diperlukan saat menjalankan dev server)"
}

# ── 2. Backend venv ───────────────────────────────────────────────────────────
Log-Step "Menyiapkan Python virtual environment…"

$VENV = Join-Path $ROOT "backend\venv"
if (-not (Test-Path $VENV)) {
    python -m venv $VENV
    Log-OK "venv dibuat di backend/venv"
} else {
    Log-OK "venv sudah ada — skip"
}

# ── 3. Install Python deps ────────────────────────────────────────────────────
Log-Step "Menginstall Python dependencies…"

$pip = Join-Path $VENV "Scripts\pip.exe"
& $pip install -r (Join-Path $ROOT "backend\requirements.txt") --quiet
Log-OK "Python dependencies terinstall"

# ── 4. Buat .env ──────────────────────────────────────────────────────────────
Log-Step "Menyiapkan file konfigurasi backend/.env…"

$envPath     = Join-Path $ROOT "backend\.env"
$examplePath = Join-Path $ROOT "backend\.env.example"

if (-not (Test-Path $envPath)) {
    Copy-Item $examplePath $envPath
    Log-OK "backend\.env dibuat dari .env.example"
    Write-Host ""
    Write-Host "   ┌─────────────────────────────────────────────────────┐" -ForegroundColor Yellow
    Write-Host "   │  WAJIB: buka backend\.env dan isi:                  │" -ForegroundColor Yellow
    Write-Host "   │    LANGFLOW_API_KEY = (dari Langflow UI → Settings) │" -ForegroundColor Yellow
    Write-Host "   │  Flow IDs akan diisi otomatis oleh import_flows.py  │" -ForegroundColor Yellow
    Write-Host "   └─────────────────────────────────────────────────────┘" -ForegroundColor Yellow
} else {
    Log-OK "backend\.env sudah ada — skip"
}

# P0-4: frontend/.env (VITE_API_URL) — hanya perlu diisi untuk production deploy
$feEnvPath     = Join-Path $ROOT "frontend\.env"
$feExamplePath = Join-Path $ROOT "frontend\.env.example"
if (-not (Test-Path $feEnvPath)) {
    Copy-Item $feExamplePath $feEnvPath
    Log-OK "frontend\.env dibuat dari .env.example (VITE_API_URL kosong = pakai localhost:8000)"
} else {
    Log-OK "frontend\.env sudah ada — skip"
}

# ── 5. Frontend dependencies ──────────────────────────────────────────────────
Log-Step "Menginstall frontend dependencies (pnpm install)…"

Push-Location (Join-Path $ROOT "frontend")
pnpm install --silent
Pop-Location
Log-OK "Frontend dependencies terinstall"

# ── 6. Panduan Langflow flows ─────────────────────────────────────────────────
$flowsDir = Join-Path $ROOT "langflow_flows"
$hasFlows = (Test-Path $flowsDir) -and ((Get-ChildItem $flowsDir -Filter "NT-*.json").Count -gt 0)

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         Setup selesai!                   ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

if ($hasFlows) {
    Write-Host "  Langkah selanjutnya:" -ForegroundColor Cyan
    Write-Host "  1. Jalankan Langflow  : langflow run" -ForegroundColor White
    Write-Host "  2. Import flows       : python scripts\import_flows.py" -ForegroundColor White
    Write-Host "  3. Jalankan semua     : .\scripts\dev.ps1" -ForegroundColor White
} else {
    Write-Host "  Langkah selanjutnya:" -ForegroundColor Cyan
    Write-Host "  1. Minta file langflow_flows/ dari temanmu" -ForegroundColor White
    Write-Host "  2. Jalankan Langflow  : langflow run" -ForegroundColor White
    Write-Host "  3. Import flows       : python scripts\import_flows.py" -ForegroundColor White
    Write-Host "  4. Isi backend\.env   : LANGFLOW_API_KEY" -ForegroundColor White
    Write-Host "  5. Jalankan semua     : .\scripts\dev.ps1" -ForegroundColor White
}
Write-Host ""
