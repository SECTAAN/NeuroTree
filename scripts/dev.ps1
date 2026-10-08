# NeuroTree — Dev Server (Windows)
# Nyalakan Backend + Frontend + Langflow sekaligus dalam satu terminal
#
# Usage:
#   .\scripts\dev.ps1
#
# Tekan Ctrl+C untuk menghentikan semua service.

$ErrorActionPreference = "SilentlyContinue"

$ROOT   = Split-Path -Parent $PSScriptRoot
$PYTHON = Join-Path $ROOT "backend\venv\Scripts\python.exe"

# Fallback ke python global kalau venv belum ada
if (-not (Test-Path $PYTHON)) { $PYTHON = "python" }

function Check-Port($port) {
    $conn = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet 2>$null
    return $conn
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      NeuroTree  —  Dev Mode              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Cek apakah port sudah dipakai ────────────────────────────────────────────
$portWarnings = @()
if (Check-Port 8000) { $portWarnings += "8000 (backend) sudah dipakai" }
if (Check-Port 5173) { $portWarnings += "5173 (frontend) sudah dipakai" }
if ($portWarnings.Count -gt 0) {
    Write-Host "  ⚠️   Port berikut sudah dipakai (mungkin masih ada proses lama):" -ForegroundColor Yellow
    $portWarnings | ForEach-Object { Write-Host "      - $_" -ForegroundColor Yellow }
    Write-Host ""
}

# ── Langflow ──────────────────────────────────────────────────────────────────
if (-not (Check-Port 7860)) {
    Write-Host "  🚀  Memulai Langflow (port 7860)…" -ForegroundColor Cyan
    $lfLog = Join-Path $ROOT "langflow.log"
    Start-Process -FilePath "python" `
        -ArgumentList "-m langflow run --host 0.0.0.0 --port 7860" `
        -RedirectStandardOutput $lfLog `
        -RedirectStandardError  $lfLog `
        -WindowStyle Hidden `
        -PassThru | Out-Null
    Write-Host "     Log: $lfLog" -ForegroundColor DarkGray

    # Tunggu Langflow siap (max 30 detik)
    Write-Host "     Menunggu Langflow siap" -NoNewline -ForegroundColor DarkGray
    $tries = 0
    do {
        Start-Sleep -Seconds 2
        Write-Host "." -NoNewline -ForegroundColor DarkGray
        $tries++
    } while (-not (Check-Port 7860) -and $tries -lt 15)
    Write-Host ""
    if (Check-Port 7860) {
        Write-Host "     ✅  Langflow siap di http://localhost:7860" -ForegroundColor Green
    } else {
        Write-Host "     ⚠️   Langflow belum merespons — lanjut tanpa menunggu" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✅  Langflow sudah berjalan di port 7860" -ForegroundColor Green
}

# ── Backend ───────────────────────────────────────────────────────────────────
Write-Host "  🚀  Memulai Backend FastAPI (port 8000)…" -ForegroundColor Cyan
$beLog = Join-Path $ROOT "backend.log"

$beProc = Start-Process -FilePath $PYTHON `
    -ArgumentList "-m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" `
    -WorkingDirectory (Join-Path $ROOT "backend") `
    -RedirectStandardOutput $beLog `
    -RedirectStandardError  $beLog `
    -WindowStyle Hidden `
    -PassThru
Write-Host "     Log: $beLog" -ForegroundColor DarkGray

# Tunggu backend siap (max 15 detik)
Write-Host "     Menunggu backend siap" -NoNewline -ForegroundColor DarkGray
$tries = 0
do {
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline -ForegroundColor DarkGray
    $tries++
} while (-not (Check-Port 8000) -and $tries -lt 15)
Write-Host ""
if (Check-Port 8000) {
    Write-Host "     ✅  Backend siap di http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "     ⚠️   Backend belum merespons — cek backend.log" -ForegroundColor Yellow
}

# ── Frontend ──────────────────────────────────────────────────────────────────
Write-Host "  🚀  Memulai Frontend Vite (port 5173)…" -ForegroundColor Cyan
$feLog = Join-Path $ROOT "frontend.log"

$feProc = Start-Process -FilePath "pnpm" `
    -ArgumentList "dev" `
    -WorkingDirectory (Join-Path $ROOT "frontend") `
    -RedirectStandardOutput $feLog `
    -RedirectStandardError  $feLog `
    -WindowStyle Hidden `
    -PassThru
Write-Host "     Log: $feLog" -ForegroundColor DarkGray

# Tunggu frontend siap (max 15 detik)
Write-Host "     Menunggu frontend siap" -NoNewline -ForegroundColor DarkGray
$tries = 0
do {
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline -ForegroundColor DarkGray
    $tries++
} while (-not (Check-Port 5173) -and $tries -lt 15)
Write-Host ""
if (Check-Port 5173) {
    Write-Host "     ✅  Frontend siap di http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "     ⚠️   Frontend belum merespons — cek frontend.log" -ForegroundColor Yellow
}

# ── Status ringkas ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Semua service berjalan!                 ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  🌐  Frontend  http://localhost:5173     ║" -ForegroundColor White
Write-Host "║  ⚡  Backend   http://localhost:8000     ║" -ForegroundColor White
Write-Host "║  🤖  Langflow  http://localhost:7860     ║" -ForegroundColor White
Write-Host "║  📖  API Docs  http://localhost:8000/docs║" -ForegroundColor White
Write-Host "╠══════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Logs:                                   ║" -ForegroundColor DarkGray
Write-Host "║    backend.log   frontend.log            ║" -ForegroundColor DarkGray
Write-Host "║    langflow.log                          ║" -ForegroundColor DarkGray
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Tekan Ctrl+C untuk menghentikan semua service." -ForegroundColor DarkGray
Write-Host ""

# Tunggu sampai Ctrl+C
try {
    while ($true) { Start-Sleep -Seconds 5 }
} finally {
    Write-Host "`n  🛑  Menghentikan semua service…" -ForegroundColor Yellow
    if ($beProc -and -not $beProc.HasExited) { Stop-Process -Id $beProc.Id -Force -ErrorAction SilentlyContinue }
    if ($feProc -and -not $feProc.HasExited) { Stop-Process -Id $feProc.Id -Force -ErrorAction SilentlyContinue }
    # Langflow: matikan proses python yang menjalankan langflow
    Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowTitle -eq "" # background process
    } | ForEach-Object {
        $_.Kill()
    }
    Write-Host "  ✅  Semua service dihentikan.`n" -ForegroundColor Green
}
