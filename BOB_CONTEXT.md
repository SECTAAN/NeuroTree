# BOB_CONTEXT.md
# Salin seluruh isi file ini sebagai pesan PERTAMA ke IBM Bob di sesi baru.
# Dengan ini Bob langsung paham kondisi proyek tanpa perlu dijelaskan ulang.
#
# Terakhir diperbarui : 2026-10-08 09:51
# Oleh (branch)       : master2
# Milestone terakhir  : M-11 RC Final QA — 318/318 pass, live E2E clean, dead-code removed, READY for demo

---

**Konteks proyek NeuroTree untuk Bob:**

Proyek: NeuroTree — AI adaptive learning platform. Branch Git: `master2`.

> ⚠️  **Catatan dari handoff sebelumnya:** No blockers. All P0/P1 resolved. mockProgressiveApi + mockRouterData.js deleted. calculate_progressive_mastery kept (test compat). 507kB chunk advisory is pre-existing non-blocking.

Stack:
- Frontend: React + Vite + TailwindCSS + React Flow (port 5173)
- Backend: Python + FastAPI + SQLite (port 8000)
- AI: Langflow (port 7860) — 5 flows: NT-01 s/d NT-05

**Milestone terakhir selesai: M-11 RC Final QA — 318/318 pass, live E2E clean, dead-code removed, READY for demo**

Git log terbaru:
- 10b342b chore: M-11 dead-code cleanup — remove mockProgressiveApi, mockRouterData.js; clarify legacy function docstrings
- 677a69b chore: commit .gitignore log-file entries (BOM + dev log patterns)
- e7e0a92 chore: handoff — M-10 — P1-5 chip race fix, P1-6 confirmed clean, P0-4 VITE_API_URL
- 7426864 feat: M-10 — P1-5 chip race fix, P1-6 confirmed clean, P0-4 VITE_API_URL + automation scripts
- d9739da feat: M-9B — RouterModal real data + audit 403/404 fix
- bf13403 feat: M-9A — real camera OCR confirmation + extract.py hardening

Commits belum di-push: 0

File penting:
- Backend API: `backend/app/api/` (material.py, quiz.py, master_light.py, career.py, extract.py)
- Mastery logic: `backend/app/services/mastery_service.py`
- Frontend context: `frontend/src/context/AppContext.jsx`
- Frontend graph: `frontend/src/components/flow/SkillTreeCanvas.jsx`
- API calls: `frontend/src/services/api.js`
- Dev scripts: `scripts/dev.ps1` (Windows), `scripts/dev.sh` (Mac/Linux)

Remaining issues (prioritas tinggi):
- P1-5: Recommendation chip race condition (target node mungkin belum tersedia saat chip render)
- P1-6: Landing page auto-advance setelah 6 detik (ada setTimeout yang navigasi otomatis)
- P0-4: VITE_API_URL hardcoded di api.js (butuh env var untuk production deploy)

Remaining cleanup (opsional):
- Hapus `calculate_progressive_mastery()` dari mastery_service.py (legacy, tidak dipakai di prod)
- Hapus `mockProgressiveApi` export dari api.js (tidak diimport di mana pun)

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
