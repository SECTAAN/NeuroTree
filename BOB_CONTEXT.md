# BOB_CONTEXT.md
# Salin seluruh isi file ini sebagai pesan PERTAMA ke IBM Bob di sesi baru.
# Dengan ini Bob langsung paham kondisi proyek tanpa perlu dijelaskan ulang.
#
# ⚡ File ini diperbarui otomatis oleh: python scripts/handoff.py
#    Jalankan script itu setiap kali selesai kerja sebelum git push.
#
# Terakhir diperbarui : 2025-07-14
# Milestone terakhir  : M-9B + Release Audit selesai

---

**Konteks proyek NeuroTree untuk Bob:**

Proyek: NeuroTree — AI adaptive learning platform. Branch Git: `master2`.

Stack:
- Frontend: React + Vite + TailwindCSS + React Flow (port 5173)
- Backend: Python + FastAPI + SQLite (port 8000)
- AI: Langflow (port 7860) — 5 flows: NT-01 s/d NT-05

**Milestone terakhir selesai: M-9B + Release Audit**

Yang sudah selesai (jangan diubah):
- F-1 s/d F-6: ingest, graph, quiz, mastery, sessions, multi-tree, PDF/DOCX, camera OCR
- M-5 s/d M-9B: Master Light node, assessment, unlock, graph sync, RouterModal real data
- Audit fix: Axios interceptor preserve `err.status`; RouterModal 403/404 guard diperbaiki
- 298/298 backend tests pass. Frontend build clean (507 kB advisory — pre-existing).

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

Remaining cleanup (opsional, tidak blocking):
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
