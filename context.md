# NeuroTree — Project Context
# Copy this file as the FIRST message to IBM Bob in a new session.
#
# Last updated : 2026-10-09
# Branch       : master2
# HEAD commit  : aaf665b  (fix: resolve merge conflicts and master light database integration)
# Milestone    : M-12 — Router/Flashcard fix, Demo Smoke 40/40, RC frozen

---

**NeuroTree — AI Adaptive Learning Platform**

> ⚠️ **M-12 Handoff:** Flashcard fallback fix applied and verified.
> Demo smoke test 40/40 pass. Full suite 398/398 pass. Build clean. RC frozen.
> `smoke_test.py` line-55 ordering assert is a pre-existing failure unrelated to M-12.

## Stack
- **Frontend:** React + Vite + TailwindCSS + React Flow — `localhost:5173`
- **Backend:** Python + FastAPI + SQLite — `localhost:8000`
- **AI:** Langflow — `localhost:7860` — flows NT-01…NT-05

## Startup Commands

```powershell
# Backend (Windows)
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# Frontend (Windows)
cd frontend
pnpm dev

# Langflow (must be running separately on port 7860)
```

## Required Environment Variables

### backend/.env  (all required for live mode)
```
USE_MOCK_AI=False           # True = offline demo mode
LANGFLOW_BASE_URL=http://127.0.0.1:7860
LANGFLOW_API_KEY=<your-key>
LANGFLOW_FLOW_NT01=<uuid>
LANGFLOW_FLOW_NT02=<uuid>
LANGFLOW_FLOW_NT03=<uuid>
LANGFLOW_FLOW_NT04=<uuid>
LANGFLOW_FLOW_NT05=<uuid>
# DATABASE_URL=sqlite:///./neurotree.db  (default, no change needed)
```

### frontend/.env  (optional — defaults to localhost:8000)
```
# Leave empty for local dev. Set for production:
# VITE_API_URL=https://api.neurotree.example.com
```

## Test Commands (Windows PowerShell)

```powershell
cd backend
$env:PYTHONIOENCODING='utf-8'
$env:USE_MOCK_AI='True'

# Phase regression suites (318 tests)
.\.venv\Scripts\python.exe test_phase_f2.py   # 28/28
.\.venv\Scripts\python.exe test_phase_f4.py   # 35/35
.\.venv\Scripts\python.exe test_phase_f7.py   # 76/76
.\.venv\Scripts\python.exe test_phase_f8a.py  # 14/14
.\.venv\Scripts\python.exe test_phase_m6.py   # 30/30
.\.venv\Scripts\python.exe test_phase_m7.py   # 41/41
.\.venv\Scripts\python.exe test_phase_m8b.py  # 18/18
.\.venv\Scripts\python.exe test_phase_m9a.py  # 56/56
.\.venv\Scripts\python.exe test_phase_m10.py  # 20/20

# M-12 new tests (120 tests)
.\.venv\Scripts\python.exe test_router_modal.py      # 48/48
.\.venv\Scripts\python.exe test_flashcard_focused.py # 32/32
.\.venv\Scripts\python.exe demo_smoke_test.py        # 40/40

# Frontend build
cd ..\frontend
pnpm build
```

## Known Warnings (non-blocking)
- `pnpm build`: 508 kB JS chunk warning — pre-existing, no runtime impact
- `smoke_test.py` line 55: `g["nodes"][1]["status"] == "locked"` ordering assert fails — pre-existing since Phase F-1, unrelated to M-12
- PowerShell `2>&1` pipe shows httpx INFO logs as exit-code 1 on test scripts — all tests actually pass (check last line)

## Milestone History

| # | Summary |
|---|---------|
| M-1 to M-4 | Backend foundation, mastery engine, frontend, React Flow |
| M-5 + M-6 | Master Light node, assessment, unlock |
| M-7 | Master Light apex, stats exclusion |
| M-8A/B | Post-assessment graph refresh + live sync |
| M-9A | Real camera OCR + extract.py hardening |
| M-9B | RouterModal real data + 403/404 fix |
| M-10 | P1-5 chip race fix, VITE_API_URL |
| M-11 | RC QA — 318/318 pass, dead-code removed |
| **M-12** | Router/Flashcard fallback fix, demo smoke 40/40, RC frozen |

## M-12 Changes

| File | Change |
|------|--------|
| `frontend/src/components/router/RouterModal.jsx` | `buildFlashcards()`: fallback card from `node.content` when `key_concepts=[]`; removed module-level `_fcSeq` → local `seq` |
| `backend/test_router_modal.py` | New — 48 tests (Router + FlashcardPanel integration) |
| `backend/test_flashcard_focused.py` | New — 32 tests (flashcard scenarios A–J) |
| `backend/demo_smoke_test.py` | New — 40 tests (full golden path smoke test) |
| `context.md` | This file |

## Total Test Count at RC Freeze
**398 tests pass. 0 failures. Build clean.**

| Group | Count |
|-------|-------|
| Phase F-2 → M-10 (regression) | 318 |
| test_router_modal (M-12) | 48 |
| test_flashcard_focused (M-12) | 32 |
| demo_smoke_test (M-12) | 40 |
| **Total** | **398** |

## Database Schema (neurotree.db)

**sessions:** `uuid, created_at, tree_name, learning_goal, user_id, revealed_depth, master_light_mastery, master_light_unlocked`

**nodes:** `id, session_id, title, content, key_concepts, status, mastery_score, last_expected_answer, last_question, quiz_session_scores, node_type, master_light_unlocked, master_light_mastery, ml_session_scores, ml_last_question, ml_last_expected_answer`

**edges:** `id, session_id, source_id, target_id, relationship_type`

## Mastery Rule (LOCKED — do not change)
- 0–69.99 → review / locked
- 70–100 → mastered / unlocked
- `SESSION_PROGRESSION_WEIGHT = 0.25` — 3 sessions of 3 questions needed for unlock

## Remaining Open Issues (post-RC)

| ID | Priority | Description |
|----|----------|-------------|
| P0-3 | Medium | Camera OCR path uses placeholder; use PDF/text for demo |
| P1-3 | Low | Flashcard fallback uses fixed template — NT-02 questions would be better |
| P2 | Advisory | 508 kB JS bundle; code-split post-hackathon |

## Absolute Rules
- DO NOT modify NT-01 through NT-05 Langflow flows unless explicitly requested.
- DO NOT change F-1 through F-6 behavior unless explicitly requested.
- Mastery threshold 70 is consistent across all code — do not change.
- DO NOT commit/push unless explicitly requested.
- After any change: run backend tests + pnpm build, report results.
