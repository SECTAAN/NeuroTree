#!/usr/bin/env python3
"""
handoff.py — Perbarui BOB_CONTEXT.md sebelum serah terima giliran kerja.

Jalankan SETIAP KALI selesai kerja, sebelum git push:
    python scripts/handoff.py

Yang dilakukan:
    1. Baca milestone/notes dari argumen atau input interaktif
    2. Ambil git log terbaru otomatis
    3. Ambil daftar file yang berubah (git diff)
    4. Tulis ulang BOB_CONTEXT.md dengan info terkini
    5. Otomatis git add + commit BOB_CONTEXT.md

Usage:
    python scripts/handoff.py
    python scripts/handoff.py --milestone "M-10 selesai: P1-5 fix"
    python scripts/handoff.py --notes "P1-6 setengah jalan, lihat LandingPage.jsx baris 42"
"""

import subprocess
import pathlib
import sys
import argparse
import datetime

ROOT = pathlib.Path(__file__).parent.parent

# ── Helpers ──────────────────────────────────────────────────────────────────

def git(cmd: str) -> str:
    try:
        result = subprocess.run(
            ["git"] + cmd.split(),
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8"
        )
        return result.stdout.strip()
    except Exception:
        return ""

def git_log(n=5) -> str:
    lines = git(f"log --oneline -{n}").splitlines()
    return "\n".join(f"- {l}" for l in lines)

def git_diff_stat() -> str:
    stat = git("diff --stat HEAD")
    if not stat:
        stat = "(tidak ada perubahan belum di-commit)"
    return stat

def git_branch() -> str:
    return git("rev-parse --abbrev-ref HEAD") or "master2"

def git_ahead() -> str:
    ahead = git("rev-list --count @{u}..HEAD 2>/dev/null") or "0"
    return ahead

# ── Baca BOB_CONTEXT.md yang ada ─────────────────────────────────────────────

CONTEXT_PATH = ROOT / "BOB_CONTEXT.md"

def parse_existing() -> dict:
    """Ambil bagian yang perlu dipertahankan dari BOB_CONTEXT.md lama."""
    result = {
        "remaining_issues": [],
        "optional_cleanup": [],
        "rules": [],
    }
    if not CONTEXT_PATH.exists():
        return result

    content = CONTEXT_PATH.read_text(encoding="utf-8")
    lines = content.splitlines()

    section = None
    for line in lines:
        stripped = line.strip()
        if "Remaining issues" in line and "prioritas tinggi" in line:
            section = "remaining_issues"
        elif "Remaining cleanup" in line or "opsional" in line.lower() and "cleanup" in line.lower():
            section = "optional_cleanup"
        elif "Aturan WAJIB" in line:
            section = "rules"
        elif stripped.startswith("##") or stripped.startswith("Test command") or stripped.startswith("Build command"):
            section = None
        elif section and stripped.startswith("-"):
            result[section].append(stripped)

    return result

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Update BOB_CONTEXT.md untuk handoff")
    parser.add_argument("--milestone", "-m", default="", help="Milestone yang baru selesai")
    parser.add_argument("--notes",     "-n", default="", help="Catatan tambahan untuk penerus")
    parser.add_argument("--no-commit",       action="store_true", help="Jangan auto-commit")
    args = parser.parse_args()

    existing = parse_existing()

    # Input interaktif kalau tidak ada argumen
    milestone = args.milestone
    notes     = args.notes

    if not milestone:
        print("\n📝  Apa yang baru selesai dikerjakan? (contoh: M-10 — P1-5 fix selesai)")
        milestone = input("   > ").strip()

    if not notes:
        print("\n📝  Ada catatan untuk penerus? (kosongkan kalau tidak ada)")
        notes = input("   > ").strip()

    print("\n  📡  Mengumpulkan info repo…")

    branch  = git_branch()
    log     = git_log(6)
    ahead   = git_ahead()
    now     = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

    # Remaining issues — pakai dari file lama, bisa diedit manual
    remaining = "\n".join(existing["remaining_issues"]) or \
        "- P1-5: Recommendation chip race condition\n" \
        "- P1-6: Landing page auto-advance setelah 6 detik\n" \
        "- P0-4: VITE_API_URL hardcoded (butuh env var untuk production)"

    cleanup = "\n".join(existing["optional_cleanup"]) or \
        "- Hapus `calculate_progressive_mastery()` dari mastery_service.py (legacy)\n" \
        "- Hapus `mockProgressiveApi` export dari api.js (tidak diimport)"

    handoff_note = f"\n> ⚠️  **Catatan dari handoff sebelumnya:** {notes}" if notes else ""

    content = f"""# BOB_CONTEXT.md
# Salin seluruh isi file ini sebagai pesan PERTAMA ke IBM Bob di sesi baru.
# Dengan ini Bob langsung paham kondisi proyek tanpa perlu dijelaskan ulang.
#
# Terakhir diperbarui : {now}
# Oleh (branch)       : {branch}
# Milestone terakhir  : {milestone}

---

**Konteks proyek NeuroTree untuk Bob:**

Proyek: NeuroTree — AI adaptive learning platform. Branch Git: `{branch}`.
{handoff_note}

Stack:
- Frontend: React + Vite + TailwindCSS + React Flow (port 5173)
- Backend: Python + FastAPI + SQLite (port 8000)
- AI: Langflow (port 7860) — 5 flows: NT-01 s/d NT-05

**Milestone terakhir selesai: {milestone}**

Git log terbaru:
{log}

Commits belum di-push: {ahead}

File penting:
- Backend API: `backend/app/api/` (material.py, quiz.py, master_light.py, career.py, extract.py)
- Mastery logic: `backend/app/services/mastery_service.py`
- Frontend context: `frontend/src/context/AppContext.jsx`
- Frontend graph: `frontend/src/components/flow/SkillTreeCanvas.jsx`
- API calls: `frontend/src/services/api.js`
- Dev scripts: `scripts/dev.ps1` (Windows), `scripts/dev.sh` (Mac/Linux)

Remaining issues (prioritas tinggi):
{remaining}

Remaining cleanup (opsional):
{cleanup}

Aturan WAJIB diikuti:
- JANGAN ubah NT-01 sampai NT-05 Langflow flows kecuali diminta eksplisit
- JANGAN ubah behavior F-1 sampai F-6 kecuali diminta eksplisit
- Mastery threshold: 0–69.99 = review, 70–100 = mastered (harus konsisten di seluruh kode)
- JANGAN commit/push kecuali diminta
- Prefer perubahan kecil dan terisolasi
- Setelah implementasi: jalankan test backend + frontend build, laporkan hasilnya

Test command (backend, Windows):
```
cd backend
$env:PYTHONIOENCODING='utf-8'
python test_phase_f2.py; python test_phase_f4.py; python test_phase_f7.py
python test_phase_f8a.py; python test_phase_m6.py; python test_phase_m7.py
python test_phase_m8b.py; python test_phase_m9a.py
```

Build command (frontend):
```
cd frontend
pnpm build
```
"""

    CONTEXT_PATH.write_text(content, encoding="utf-8")
    print(f"  ✅  BOB_CONTEXT.md diperbarui")

    # Auto-commit
    if not args.no_commit:
        subprocess.run(["git", "add", "BOB_CONTEXT.md"], cwd=ROOT)
        subprocess.run(
            ["git", "commit", "-m", f"chore: handoff — {milestone}"],
            cwd=ROOT
        )
        print(f"  ✅  BOB_CONTEXT.md di-commit: 'chore: handoff — {milestone}'")
        print(f"\n  Sekarang jalankan: git push origin {branch}")
    else:
        print(f"  ℹ️   --no-commit aktif. Commit manual dengan:")
        print(f"     git add BOB_CONTEXT.md && git commit -m 'chore: handoff — {milestone}'")

    print(f"""
╔══════════════════════════════════════════════════════╗
║  Handoff siap! Instruksi untuk penerus:              ║
╠══════════════════════════════════════════════════════╣
║  1. git pull origin {branch:<32}║
║  2. Buka BOB_CONTEXT.md                              ║
║  3. Salin SEMUA isinya                               ║
║  4. Paste sebagai pesan PERTAMA ke IBM Bob           ║
║  5. Lanjut kerja                                     ║
╚══════════════════════════════════════════════════════╝
""")

if __name__ == "__main__":
    main()
