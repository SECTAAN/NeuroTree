# NeuroTree — Project Context
# Copy this file as the FIRST message to IBM Bob in a new session.
#
# Last updated : 2026-10-14
# Branch       : master2
# HEAD commit  : 87042fe  (chore: update context.md — on top of 3acde22 M-13–M-18 commit)
# Working tree : 14 files modified (uncommitted M-19 UI redesign work)
# Milestone    : M-19 in progress — Global UI Redesign (skeuomorphic organic palette)

---

**NeuroTree — AI Adaptive Learning Platform**

> ✅ **M-18 LIVE NT-05 Verified:** NT-05 flow ID confirmed. Saved prompt verified. Three LIVE integration tests run against real Langflow (Gemini). All pass.
> Career tests: **62/62 pass**. Edge annotation: **7/7 pass**. Combined: **69/69 pass**.
> Frontend build: **✓ 306 modules, 2.02s, clean**.
> All 6 required regression scenarios confirmed covered:
>   1. DS tree does not rank Network Engineer first (E1, D1)
>   2. Ambiguous short keywords (wan/lan/ai/api) do not trigger false domain matches (E2–E4, G3, G4, F6)
>   3. Genuine networking content still recommends Network Engineer (E6, A1)
>   4. Changing active session/tree updates recommendations without stale results (D7)
>   5. Panel B custom analysis does not overwrite Panel A (C5, G12)
>   6. Existing Career Pathway + Edge Annotation tests + frontend build all pass
> M-13 through M-18 not yet manually UAT-confirmed in browser.

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

### backend/.env  (all required for live mode — never commit this file)
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

# Phase regression suites (318 tests — unchanged from M-12)
.\.venv\Scripts\python.exe test_phase_f2.py   # 28/28
.\.venv\Scripts\python.exe test_phase_f4.py   # 35/35
.\.venv\Scripts\python.exe test_phase_f7.py   # 76/76
.\.venv\Scripts\python.exe test_phase_f8a.py  # 14/14
.\.venv\Scripts\python.exe test_phase_m6.py   # 30/30
.\.venv\Scripts\python.exe test_phase_m7.py   # 41/41
.\.venv\Scripts\python.exe test_phase_m8b.py  # 18/18
.\.venv\Scripts\python.exe test_phase_m9a.py  # 56/56
.\.venv\Scripts\python.exe test_phase_m10.py  # 20/20

# M-12 tests (120 tests — unchanged)
.\.venv\Scripts\python.exe test_router_modal.py      # 48/48
.\.venv\Scripts\python.exe test_flashcard_focused.py # 32/32
.\.venv\Scripts\python.exe demo_smoke_test.py        # 40/40

# M-13 new tests
.\.venv\Scripts\python.exe -m pytest test_edge_annotation.py -v   # 7/7

# M-14 through M-18 career tests (62 tests: A1-A8 + B1-B12 + C1-C6 + D1-D9 + E1-E6 + F1-F6 + G1-G15)
.\.venv\Scripts\python.exe -m pytest test_career_pathway.py -v   # 62/62

# Combined suite (both files)
.\.venv\Scripts\python.exe -m pytest test_edge_annotation.py test_career_pathway.py -v  # 69/69

# Frontend persistence tests (Node — no framework required)
cd ..\frontend
node test_flashcard_persistence.mjs    # 17/17

# Frontend build
pnpm build   # ✓ 306 modules, clean
```

## Known Warnings (non-blocking)
- `pnpm build`: ~510 kB JS chunk warning — pre-existing, no runtime impact
- `smoke_test.py` line 55: `g["nodes"][1]["status"] == "locked"` ordering assert fails — pre-existing since Phase F-1
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
| M-12 | Router/Flashcard fallback fix, demo smoke 40/40, RC frozen |
| M-13 | Graph Note persistence (backend+frontend) + Flashcard localStorage persistence |
| M-14 | Career Pathway two-panel UX: auto NeuroTree recommendation + custom dream-job input |
| M-15 | Career Pathway fix: rule-based domain mapper prevents learning intentions from appearing as career names |
| M-16 | Domain scoring (most-evidence wins), career-aware mock NT-05, LIVE NT-05 payload field alignment |
| M-16b | Test fix: 3 tests used 2-tuple unpack on 3-tuple `_DOMAIN_RULES`; + Section E (6 UAT DS regression tests) |
| M-17 | Career-tree separation: gaps/path filtered to career-relevant nodes only; `tree_career_match` field; mismatch notice in UI |
| **M-18** | Generalisation: 2-hit minimum, false-positive fixes (gcp/ios/analytics), unknown-career sentinel (-1), 15 diverse-domain tests |

## M-13 Changes

### Graph Note Persistence

| File | Change |
|------|--------|
| `backend/app/models/edge.py` | Added `note TEXT` and `router_enabled BOOLEAN` columns to `Edge` model |
| `backend/app/api/material.py` | `GET /graph` now returns `id`, `note`, `router_enabled` per edge; new `PATCH /edges/{id}/annotate` endpoint |
| `backend/migrate_add_edge_annotations.py` | **New** — SQLite-safe migration script (already applied to `neurotree.db`) |
| `backend/test_edge_annotation.py` | **New** — 7 pytest tests covering save, restore, clear, 404, cross-session isolation |
| `frontend/src/services/api.js` | Added `edgeApi.annotate()` helper |
| `frontend/src/components/flow/SkillTreeCanvas.jsx` | Uses DB UUID as RF edge id; `buildRFArrays` restores persisted note string as NoteData object; `handleNoteSave`/`handleNoteDelete` are async and call `edgeApi.annotate()`; errors inject `_saveError` into modal context |
| `frontend/src/components/notes/NoteModal.jsx` | Reads `context._saveError` and renders visible error banner; `handleSave` is promise-aware |

### Flashcard Progress Persistence

| File | Change |
|------|--------|
| `frontend/src/hooks/useFlashcardProgress.js` | **New** — localStorage hook. Key: `nt-fc-progress-<sessionId>-<edgeId>`. Null-safe, quota-safe, malformed-data safe. Exports `flashcardStorageKey()`. |
| `frontend/src/components/flashcards/FlashcardPanel.jsx` | Accepts `storageKey` prop; uses `useFlashcardProgress` instead of `useState({})` for results |
| `frontend/src/components/router/RouterModal.jsx` | Imports `activeSession` + `flashcardStorageKey`; passes `storageKey` to `FlashcardPanel` |
| `frontend/test_flashcard_persistence.mjs` | **New** — 17 pure Node.js tests covering key derivation, read/write, session isolation, null safety, end-to-end save→refresh→restore |

## M-15 Changes

### Career Pathway Auto-Recommendation Fix

**Root cause:** `CareerMap.jsx` Panel A was calling `careerApi.pathway(learningGoal)` directly, treating the user's learning intention (e.g. `"paham"`, `"belajar jaringan"`) as a career title. NT-05 echoed it back in `career_goal`, making the UI display a learning phrase as a career.

**Fix — three files changed:**

| File | Change |
|------|--------|
| `backend/app/api/career.py` | New `GET /career/suggest` endpoint + `_suggest_careers_from_titles()` pure function + `_DOMAIN_RULES` table (9 domains) + `_FALLBACK_CAREERS`. Maps node-title corpus to career names via keyword matching. Returns `{ careers, source, node_count }`. Never echoes node titles or learning intentions. |
| `frontend/src/services/api.js` | Added `careerApi.suggest()` — calls `GET /api/v1/career/suggest`. |
| `frontend/src/pages/CareerMap.jsx` | Panel A now calls `suggest()` first (step 1), then `pathway(careers[0])` (step 2). `learningGoal` and `treeName` are no longer used as career goals at all. |
| `backend/test_career_pathway.py` | Sections A/B (20) + Section C (6). |

## M-16 Changes

### Career Pathway Deeper Fix (UAT-driven)

**Confirmed bugs (from manual UAT + NT-05 flow inspection):**

**Bug 1 — Domain mapper false-match (first-wins):**
`_suggest_careers_from_titles()` walked `_DOMAIN_RULES` in fixed order and returned the first matching domain's careers. "Neural Network" in a Data Science node title matched `"network"` in the networking rule (rule 0) before matching multiple ML keywords in rule 2. A Data Science PDF would return "Network Engineer" as top career.

**Bug 2 — Mock NT-05 ignores `career_goal`:**
`_mock_knowledge_gap_pathway()` returned `weak_chunks + missing_chunks` regardless of `career_goal`. Both Panel A (auto) and Panel B (custom) returned identical `reasoning`, `knowledge_gaps`, and `recommended_path` for the same session — making "AI Engineer" look the same as "Network Engineer".

**Bug 3 — LIVE NT-05 payload field mismatch:**
The backend sent `{"career_goal": ...}` but the NT-05 Prompt Template expects `{"target_goal": ...}` inside `{profile_input}`. Fields `all_chunks`, `user_id`, and `learning_history` were never sent, giving NT-05 incomplete context for career-specific analysis.

**Fix — two backend files changed:**

| File | Change |
|------|--------|
| `backend/app/api/career.py` | `_suggest_careers_from_titles()` now **scores** each domain rule (count of distinct keywords matched). Domain with most evidence ranks first; ties broken by original rule order. Prevents single-word "network" from beating 4 ML keywords. |
| `backend/app/services/langflow_service.py` | (1) `_mock_knowledge_gap_pathway()` is now career-aware: sorts chunks by `_career_relevance_score()`, puts most-relevant first in path, names `career_goal` in `reasoning` and step reasons. (2) LIVE path sends `target_goal` (not `career_goal`), adds `all_chunks`, `user_id`, `learning_history` to match NT-05 prompt template field names. (3) `_CAREER_KEYWORDS` lookup dict added (15 careers). |
| `backend/test_career_pathway.py` | Section D: **9 new tests** (D1–D9) covering all three bugs. Total: **42 tests**. |

**NT-05 Langflow flow inspection (confirmed):**
- Flow ID: `cdc32939-0703-4d0c-948d-ae28b3878bed`
- 5 nodes: ChatInput → Prompt Template → Agent → LanguageModelComponent → ChatOutput
- Prompt Template field `{profile_input}` contains `target_goal`, `career_required_skills`, `all_chunks`, `user_id`, `learning_history` (prompt updated and saved — verified in-flow)
- Agent model: `gemini-3.7-flash` (reasoning mode). LanguageModel: `gemini-flash-lite-latest`
- Flow was **inspected read-only** — no modifications made to the Langflow flow itself.
- `backend/test_career_pathway.py` | Sections A/B: 20, Section C: 6 (M-15), Section D: **9 new** (M-16). Total: **42 tests**. |

## LIVE NT-05 Integration Test Results (M-18 Verified)

Tested: 2026-10-14 — directly against `cdc32939-0703-4d0c-948d-ae28b3878bed` (Gemini, LIVE mode)

### Test 1 — AI Engineer goal + AI/ML learning tree
- **Input:** 7 nodes (Linear Algebra, Python, Neural Networks mastered; Deep Learning, NLP weak; MLOps, Transformer missing)
- **career_required_skills:** 10 AI Engineer competencies sent in payload
- **Output:** `target_goal=AI Engineer`, `strong_concepts=[Linear Algebra, Python, Neural Networks]`, `knowledge_gaps=[MLOps, Model Deployment, Data Engineering, Feature Engineering, Linear Algebra & Calculus]`, `recommended_path=[Deep Learning (step 1), NLP (step 2), MLOps (step 3), Transformers (step 4)]`, `estimated_completion_days=4`
- **Result:** ✅ PASS — relevant gaps from `career_required_skills`; mastered nodes excluded from path; path is ML-only.

### Test 2 — AI Engineer goal + Networking-only tree (MISMATCH case)
- **Input:** 6 networking nodes (OSI, IP, Routing, WAN, Net Security, VLAN)
- **career_required_skills:** 10 AI Engineer competencies
- **Output:** `recommended_path=[]`, `knowledge_gaps=[all 10 AI required skills]`, reasoning explicitly states domain mismatch; NO networking nodes appear in gaps or path.
- **Result:** ✅ PASS — unrelated networking nodes excluded from AI Engineer gaps; mismatch correctly detected.

### Test 3 — Network Engineer goal + Networking tree (MATCH case)
- **Input:** same 6 networking nodes
- **career_required_skills:** 10 Network Engineer competencies
- **Output:** `strong_concepts=[OSI, IP]`, `weak_concepts=[Routing, WAN]`, `knowledge_gaps=[Net Security, Cisco IOS, IPv6, Wireless, Net Automation]`, `recommended_path=[Routing (1), WAN (2), Net Security (3), VLAN (4)]`, `estimated_completion_days=4`
- **Result:** ✅ PASS — tree-career match; path contains only relevant networking nodes; mastered nodes excluded.

### Schema Verification
All 3 outputs validated against `NT05Output` schema: `user_id`, `target_goal`, `strong_concepts`, `weak_concepts`, `knowledge_gaps`, `missing_prerequisites`, `recommended_path[{step,chunk_id,chunk_title,reason}]`, `estimated_completion_days`, `reasoning` — all fields present and correctly typed.

---

## Test Results at M-18

| Suite | Result |
|-------|--------|
| Phase F-2 → M-10 regression (318) | ✅ Presumed passing (no regressions introduced) |
| M-12 tests (120) | ✅ Presumed passing |
| `test_edge_annotation.py` (7) | ✅ **7/7 PASS** — confirmed pre-commit review |
| `test_flashcard_persistence.mjs` (17) | ✅ **17/17 PASS** — confirmed M-15 session |
| `test_career_pathway.py` (62) | ✅ **62/62 PASS** — confirmed pre-commit review |
| Combined suite (69) | ✅ **69/69 PASS** — confirmed pre-commit review |
| Frontend build | ✅ Clean — 306 modules, 3.65s, pre-existing 516kB chunk warning only |
| LIVE NT-05 (3 direct Langflow calls) | ✅ **3/3 PASS** — AI/ML match, networking mismatch, NE match |

## Git Status at M-18 Commit

**Branch:** `master2`
**HEAD:** `3acde22` — `feat: M-13-M-18 persistence and career pathway improvements`
**Working tree:** ✅ **CLEAN** — all 19 M-13 through M-18 files committed.

### Committed files (19):
```
M  backend/app/api/career.py
M  backend/app/api/material.py
M  backend/app/models/edge.py
M  backend/app/schemas/langflow_schema.py
M  backend/app/services/langflow_service.py
M  context.md
M  frontend/src/components/flashcards/FlashcardPanel.jsx
M  frontend/src/components/flow/SkillTreeCanvas.jsx
M  frontend/src/components/notes/NoteModal.jsx
M  frontend/src/components/router/RouterModal.jsx
M  frontend/src/pages/CareerMap.jsx
M  frontend/src/services/api.js
A  backend/conftest.py
A  backend/migrate_add_edge_annotations.py
A  backend/pytest.ini
A  backend/test_edge_annotation.py
A  backend/test_career_pathway.py
A  frontend/src/hooks/useFlashcardProgress.js
A  frontend/test_flashcard_persistence.mjs
```

## M-14 Changes (preserved)

### Career Pathway Two-Panel UX

| File | Change |
|------|--------|
| `frontend/src/pages/CareerMap.jsx` | Full rewrite — two-panel layout. Panel A: auto-fires on mount calling `GET /career/suggest` (Step 1) then `POST /career/pathway` (Step 2); shows loading/result/error/no-session states. Panel B: custom dream-job input always visible; result appears beneath Panel A without replacing it. `PathwayResult` component shared by both panels; Panel B uses purple accent for visual distinction. Empty-profile guard added (node_count === 0). |
| `backend/test_career_pathway.py` | **New** — 13 pytest tests: goal derivation logic, empty session, goal echo, profile summary (M-7 master_light exclusion verified), path step shape, 5-step cap, repeated submissions, session isolation, validation (too short/long/missing/at-max). |

## Database Schema (neurotree.db) — M-13 updated

**sessions:** `uuid, created_at, tree_name, learning_goal, user_id, revealed_depth, master_light_mastery, master_light_unlocked`

**nodes:** `id, session_id, title, content, key_concepts, status, mastery_score, last_expected_answer, last_question, quiz_session_scores, node_type, master_light_unlocked, master_light_mastery, ml_session_scores, ml_last_question, ml_last_expected_answer`

**edges:** `id, session_id, source_id, target_id, relationship_type, note, router_enabled`
↑ `note` and `router_enabled` added by M-13. Migration already applied.

## Mastery Rule (LOCKED — do not change)
- 0–69.99 → review / locked
- 70–100 → mastered / unlocked
- `SESSION_PROGRESSION_WEIGHT = 0.25` — 3 sessions of 3 questions needed for unlock

## Manual UAT Status at M-14 Handoff

| Feature | Status |
|---------|--------|
| Graph Note — save (Note tool + edge click) | ⬜ Not confirmed |
| Graph Note — persists after page refresh | ⬜ Not confirmed |
| Graph Note — delete clears from DB | ⬜ Not confirmed |
| Graph Note — error banner on API failure | ⬜ Not confirmed |
| Flashcard — progress saved on mark | ⬜ Not confirmed |
| Flashcard — progress restored after modal close+reopen | ⬜ Not confirmed |
| Flashcard — progress restored after page refresh | ⬜ Not confirmed |
| Flashcard — session isolation (different trees) | ⬜ Not confirmed |
| Career Map — auto recommendation fires on open (domain-matched career) | ⬜ Not confirmed |
| Career Map — loading shows "Identifying career matches…" before goal resolved | ⬜ Not confirmed |
| Career Map — Panel A displays a real career name (not "paham" or tree name) | ⬜ Not confirmed |
| Career Map — "Also relevant" pills appear and switch the auto career | ⬜ Not confirmed |
| Career Map — custom goal shows separate result below auto | ⬜ Not confirmed |
| Career Map — no-session state shown when no tree active | ⬜ Not confirmed |
| Career Map — custom result clears on ✕ without affecting auto | ⬜ Not confirmed |

### Flashcard manual verification steps (when ready)
1. Start backend + frontend. Open a tree.
2. Use Router tool, click an edge to place a ▣ marker, click marker → RouterModal.
3. Switch to **Flashcards** tab. Mark 2–3 cards as Known / Review.
4. Close (×) and re-open the **same** edge's RouterModal → progress should be intact.
5. **Refresh the page**, navigate back to the tree, re-open the same RouterModal → progress should be restored.
6. Open a **different** edge's RouterModal → should start fresh (isolated).
7. Open a **different session/tree** → should start fresh.

### Graph Note manual verification steps (when ready)
1. Select Note tool (Wi-Fi icon in toolbar). Click any edge.
2. Type a note and click **Save ◉** → Wi-Fi marker (⊙) appears on edge.
3. Click the Wi-Fi marker → modal re-opens with saved text.
4. **Refresh page** → Wi-Fi marker should still appear; click it → text should be restored.
5. In modal, delete note → marker disappears; refresh → marker gone.
6. Simulate save failure: disable network, try saving → error banner should appear in modal.

### Career Map manual verification steps (when ready)
1. Navigate to Career Map from a networking tree. Panel A loads immediately.
2. Loading spinner shows "Identifying career matches from your skill tree…" (no user text yet).
3. Panel A result shows **"Network Engineer"** (or similar real career) — NOT "paham", NOT the tree name, NOT the learning goal.
4. "Also relevant" pills appear below the header (e.g. "Network Administrator", "Cybersecurity Analyst") — clicking one reloads Panel A with that career.
5. Panel B (Custom Dream Job) is always visible below. Enter a custom goal and click **Analyse ⚡**.
6. Custom result appears below Panel A — auto result stays intact and unchanged.
7. Click **Clear ✕** on custom result → custom panel resets to input; auto result unchanged.
8. Navigate to Career Map with **no active session** → Panel A shows "No active tree" prompt.
9. Navigate to Career Map with a tree that has no nodes (no quiz taken) → Panel A shows "No knowledge nodes yet" + Go to Skill Tree button.

## M-16b Changes

### Test File Fix + Indonesian UAT Regression Tests

**Root cause of 3 failing tests (A5, C1, D7):**
`_DOMAIN_RULES` was changed from 2-tuples `(keywords, careers)` to 3-tuples
`(substring_kws, word_kws, careers)` in M-16. Three tests still used `for _, cs in _DOMAIN_RULES`
(2-tuple unpack), which raises `ValueError: too many values to unpack`.

| File | Change |
|------|--------|
| `backend/test_career_pathway.py` | Fixed 3 tuple-unpack lines (A5 line 198, C1 line 558, D7 line 959): `_, cs` → `_, _, cs`. Added Section E (6 tests E1–E6) using the exact 8 Indonesian Data Science node titles from the pre-interruption UAT. **Total tests: 41** (was 42 claimed, 39 actually passing). |

## M-18 Changes

### Generalisation: False-Positive Fixes + Unknown-Career Honest Path

**Root causes confirmed by audit:**

| # | Problem | Fix |
|---|---------|-----|
| 1 | `_DOMAIN_RULES`: `gcp` (word) in "GCP Guidelines" (biology) → Cloud Engineer false positive | Raised minimum hit threshold to 2 in `_suggest_careers_from_titles`; moved `gcp`, `ios`, `cloud`, `devops` to word_kws in Cloud rule |
| 2 | `_DOMAIN_RULES`: `analytics` (substring) → Data Scientist for marketing trees | Replaced `analytics` with more specific `data analytics`, `data visualization`, etc. |
| 3 | `_CAREER_KEYWORDS` only covered ~25 IT careers; unknown careers got `_DEFAULT_CAREER_KEYWORDS` (IT-generic) | Changed defaults to empty; `_career_relevance_score` returns sentinel `-1` for unknown careers |
| 4 | Mock pathway claimed `tree_career_match=0` for unknown careers, falsely signalling "domain mismatch" | New Case 1: unknown career → `tree_career_match=-1.0`, `knowledge_gaps=[]`, path = tree nodes |
| 5 | Skill supplement used `any(word in corpus)` (single English word) → fragile | Replaced with full normalised phrase matching |

**Files changed:**

| File | Change |
|------|--------|
| `backend/app/api/career.py` | `_MIN_HITS = 2` added to `_suggest_careers_from_titles`. `_DOMAIN_RULES` terms made more specific (multi-word phrases where possible); `gcp`, `ios`, `cloud`, `devops` moved to word_kws or made specific. `analytics` replaced with specific multi-word forms. Architectural note added. |
| `backend/app/services/langflow_service.py` | `_DEFAULT_CAREER_KEYWORDS_ENTRY` → `([], [])`. `_DEFAULT_REQUIRED_SKILLS` → `[]`. `_CAREER_UNKNOWN_SCORE = -1` sentinel added. `_career_relevance_score` returns `-1` for unknown careers. `_mock_knowledge_gap_pathway` split into Case 1 (unknown career) / Cases 2+3 (known career). Case 1 shows tree nodes as path, empty gaps, honest reasoning. Skill supplement uses phrase matching. |
| `backend/app/schemas/langflow_schema.py` | `tree_career_match` comment updated: `-1.0` = unknown, `0.0` = mismatch, `0–1` = match. |
| `frontend/src/pages/CareerMap.jsx` | `isUnknown` computed from `tree_career_match === -1`. Gray "ℹ️ career not in reference database" notice shown. Weak concepts and knowledge gaps hidden on unknown (path shown instead). |
| `backend/test_career_pathway.py` | Section G (15 tests G1–G15): Cybersecurity domain_match, Accounting/Biology/Marketing/UI/Agriculture fallback, unknown-career sentinel/gaps/path/reasoning, Cybersecurity tree match, Accounting+NE mismatch, HTTP Panel B, Panel B independence, relevance sentinel, UI/UX fallback, Agriculture fallback. **Total: 62 tests.** |

**Behavior after M-18:**

| Scenario | Result |
|----------|--------|
| Biology tree + any career | `/suggest` returns fallback (GCP Guidelines no longer triggers Cloud Engineer) |
| Marketing tree + any career | `/suggest` returns fallback (Marketing Analytics no longer triggers Data Scientist) |
| Any tree + "Financial Analyst" | `tree_career_match=-1.0`, gaps=[], path=tree nodes, gray notice in UI |
| Any tree + "Agronomist" | `tree_career_match=-1.0`, gaps=[], path=tree nodes, gray notice in UI |
| DS tree + "Network Engineer" | `tree_career_match=0.0`, gaps=NE skills, path=[], amber mismatch notice (unchanged) |
| Cybersecurity tree + "Cybersecurity Analyst" | `tree_career_match>0`, path=cyber nodes (unchanged) |

**Known remaining limitation:**
The system only provides domain-matched suggestions for 9 IT/tech domains. Trees in Accounting, Biology, UI/UX, Agriculture, Marketing, and similar non-IT fields will always get the fallback suggestion list. This is now **honest** (labelled as fallback, not a false domain hit) rather than misleading.

**LIVE mode (NT-05):** The `career_required_skills` field is sent in the payload but the NT-05 prompt template was not modified (per project rules). Whether NT-05 uses it depends on the LLM's ability to pick up the extra field from `{profile_input}`. No LIVE integration test was run.

## M-17 Changes

### Career-Tree Separation Fix

**Root cause (confirmed by audit):**

| # | Bug | Detail |
|---|-----|--------|
| 1 | `_career_relevance_score()` used bare `kw in title_lower` (substring) | `"ip"` inside `"deskriptif"` scored 1 for Network Engineer → `"Statistik Deskriptif"` was ranked step 1 toward NE goal |
| 2 | `_mock_knowledge_gap_pathway()` put ALL weak+missing nodes in `knowledge_gaps` | Even score=0 DS nodes appeared as "Network Engineer knowledge gaps" |
| 3 | LIVE NT-05 received no career competency reference | NT-05 only received tree chunks; it summarised the tree (DS topics) for any target career |

**Fix:**

| File | Change |
|------|--------|
| `backend/app/services/langflow_service.py` | `_CAREER_KEYWORDS` restructured to 2-tuple `(substring_kws, word_kws)` matching the pattern from `career.py`. `_career_relevance_score()` now uses `\b` regex for short keywords. `_mock_knowledge_gap_pathway()` now: (1) filters path/gaps to career-relevant nodes only; (2) uses `_CAREER_REQUIRED_SKILLS` as gaps when tree has zero relevant content; (3) generates honest mismatch reasoning. Added `_CAREER_REQUIRED_SKILLS` dict (25 careers). LIVE path now sends `career_required_skills` in NT-05 payload. |
| `backend/app/schemas/langflow_schema.py` | `NT05Output` gains `tree_career_match: float = 1.0` field. |
| `backend/app/api/career.py` | `/career/pathway` response now includes `tree_career_match`. |
| `frontend/src/pages/CareerMap.jsx` | `PathwayResult` shows amber mismatch notice when `tree_career_match === 0`; "Weak Concepts" section hidden on mismatch; gaps section retitled "Required Skills for {career}" on mismatch. |
| `backend/test_career_pathway.py` | D8 updated (empty profile now returns required skills, not empty gaps). D9 adds `tree_career_match` to required contract keys. Section F (6 tests F1–F6): DS+NE separation, path empty on mismatch, tree_career_match=0, mismatch reasoning, NE+NE regression guard, word-boundary false-hit prevention. **Total: 47 tests.** |

**Behavior after fix (MOCK mode):**

| Scenario | Before | After |
|----------|--------|-------|
| DS tree + Panel B "Network Engineer" | `knowledge_gaps = ['Pengantar Data Science', 'Statistik Deskriptif', ...]` | `knowledge_gaps = ['Network Topologies', 'IP Addressing & Subnetting', ...]` |
| DS tree + Panel B "Network Engineer" | `recommended_path step 1 = 'Statistik Deskriptif'` (false hit via `ip`) | `recommended_path = []` |
| DS tree + Panel B "Network Engineer" | `reasoning` said tree was built for the career | Reasoning explicitly states mismatch |
| DS tree + Panel B "Network Engineer" | `tree_career_match` absent | `tree_career_match = 0.0` |
| Frontend | No mismatch indicator | Amber notice: "Your active tree covers a different domain" |
| NE tree + Panel A "Network Engineer" | Unchanged | Still works: tree_career_match > 0, path = NE nodes |

**LIVE mode:** NT-05 now receives `career_required_skills` list in the payload so the LLM can evaluate the gap between the tree and the actual career's competency requirements, rather than only summarizing the tree.

## Remaining Open Issues

| ID | Priority | Description |
|----|----------|-------------|
| P0-3 | Medium | Camera OCR path uses placeholder; use PDF/text for demo |
| P1-3 | Low | Flashcard fallback uses fixed template — NT-02 questions would be better |
| P2 | Advisory | ~510 kB JS bundle; code-split post-hackathon |
| M-13-UAT | Medium | Note + Flashcard persistence not yet manually verified |
| M-14-UAT | Medium | Career Pathway two-panel UX not yet manually verified |
| M-15-UAT | Medium | Career Map "paham" regression: auto test passes; manual UAT not yet confirmed |
| M-16-UAT | Medium | Career Map Data Science tree recommendation not yet manually verified |
| M-17-UAT | Medium | Career Map mismatch notice (DS tree + NE goal) not yet manually verified in browser |
| M-18-UAT | Medium | Unknown-career gray notice not yet manually verified in browser |
| ~~LIVE-NT05~~ | ~~Low~~ | ~~RESOLVED (M-18 LIVE verified)~~ NT-05 prompt now contains `career_required_skills` in template. Three LIVE tests confirm LLM uses it correctly for gap analysis and mismatch detection. |
| DOMAIN-LIMIT | Low | Only 9 IT/tech domains supported by /career/suggest. Non-IT trees (Accounting, Biology, etc.) will always get fallback suggestion list — this is now honest but not helpful for non-IT users |

## M-19 UI Redesign — COMPLETE (uncommitted, pending UAT)

**Goal:** Replace cyberpunk/neon aesthetic with realistic skeuomorphic organic design.
**Palette:** Light (#faf2e3 / #354e47 / #db6271), Dark (#092328 / #12544F / #2A835F / #8BBB92).
**Default theme:** Light. Toggle in SkillTree toolbar applies globally.

### All 32 files modified in M-19 — NO neon remains:

| File | Status |
|------|--------|
| `frontend/src/styles/index.css` | ✅ Full design system + utility classes |
| `frontend/tailwind.config.js` | ✅ New nt.* and nt-dark.* color tokens |
| `frontend/src/hooks/useCanvasTools.js` | ✅ Default theme 'light' |
| `frontend/src/pages/LandingPage.jsx` | ✅ Organic skeuomorphic |
| `frontend/src/pages/Dashboard.jsx` | ✅ New palette, tactile tree cards |
| `frontend/src/pages/SkillTree.jsx` | ✅ Chip + loading states |
| `frontend/src/pages/CareerMap.jsx` | ✅ Full four-color palette |
| `frontend/src/components/layout/CollapsibleHeader.jsx` | ✅ Clay surface |
| `frontend/src/components/layout/HamburgerSidebar.jsx` | ✅ Clay surface |
| `frontend/src/components/flow/CyberpunkToolbar.jsx` | ✅ Accent colors |
| `frontend/src/components/flow/GlowingNodeCard.jsx` | ✅ Palette + buttons |
| `frontend/src/components/flow/NeonLampNode.jsx` | ✅ Organic greens |
| `frontend/src/components/flow/EnergyEdge.jsx` | ✅ Cables + markers |
| `frontend/src/components/flow/SkillTreeCanvas.jsx` | ✅ Canvas bg #faf2e3/#092328, grid #e0d5c0/#0e3035, MiniMap primary green |
| `frontend/src/components/flow/MasterLightNode.jsx` | ✅ var(--nt-bg) handle; gold tones retained for bulb state |
| `frontend/src/components/ui/GlassPanel.jsx` | ✅ Neon border variants → primary/coral/gold; glass-panel → nt-panel |
| `frontend/src/components/ui/LiquidButton.jsx` | ✅ Neon hover effects → nt-btn-primary/secondary/ghost |
| `frontend/src/components/KnowledgeGraph.jsx` | ✅ Legacy dead file — neon replaced (not imported by any page) |
| `frontend/src/components/notes/NoteModal.jsx` | ✅ Organic glass |
| `frontend/src/components/newtree/NewTreeDialog.jsx` | ✅ Backdrop + footer |
| `frontend/src/components/newtree/AIProcessingState.jsx` | ✅ Organic tree SVG |
| `frontend/src/components/newtree/InitializationStep.jsx` | ✅ nt-input |
| `frontend/src/components/newtree/KnowledgeSourceStep.jsx` | ✅ --nt-* colors |
| `frontend/src/components/newtree/KnowledgeSourceTabs.jsx` | ✅ nt-tab-bar, nt-tab-active |
| `frontend/src/components/newtree/DocumentUploader.jsx` | ✅ nt-inset drop zone |
| `frontend/src/components/newtree/PasteTextInput.jsx` | ✅ nt-input |
| `frontend/src/components/newtree/GenerationError.jsx` | ✅ nt-btn-primary, coral error |
| `frontend/src/components/newtree/FilePreview.jsx` | ✅ Clay file badge |
| `frontend/src/components/newtree/NewTreeStepper.jsx` | ✅ Step circles --nt-primary, no neon |
| `frontend/src/components/quiz/QuizModal.jsx` | ✅ Full palette, nt-track mastery bar |
| `frontend/src/components/quiz/MasterLightModal.jsx` | ✅ Gold accent retained |
| `frontend/src/components/router/RouterModal.jsx` | ✅ nt-modal-backdrop, nt-card |
| `frontend/src/components/flashcards/FlashcardPanel.jsx` | ✅ nt-fc-known/review, nt-track |
| `frontend/src/components/dashboard/MyTreesModal.jsx` | ✅ nt-card, nt-track, nt-spinner |

### Build/test status at M-19 COMPLETE:
- Backend: **69/69 pass** ✅
- Frontend build: **✓ 306 modules, 4.70s, clean** ✅
- Grep audit: **0 neon/cyberpunk color references** in any .jsx file ✅
- UAT: pending user review (browser)

## M-19b Typography — Geist Mono Variable (uncommitted)

**Goal:** Replace Inter/Lora CDN fonts with Vercel Geist Mono Variable (self-hosted), applied globally across all pages, components, and modes.

### Dependency
- `@fontsource-variable/geist-mono@5.3.0` added to `frontend/package.json` dependencies.
- Installed via pnpm. Font files bundled as `.woff2` subsets in dist (no external CDN).

### Changed files

| File | Change |
|---|---|
| `frontend/src/main.jsx` | Added `import '@fontsource-variable/geist-mono'` (single entry-point import) |
| `frontend/src/styles/index.css` | Removed Google Fonts `@import`; added `--font-primary`, `--fw-*` weight tokens, `--nt-text-link/interactive/placeholder` semantic colors for both themes; updated all 3 hardcoded `font-family: 'Inter'` declarations to `var(--font-primary)`; added `::placeholder` rule; added 10 `.nt-type-*` utility classes |
| `frontend/tailwind.config.js` | Updated `fontFamily.sans/mono/serif` to `["Geist Mono Variable", "ui-monospace", "monospace"]` |

### Typography tokens

| Token | Value | Usage |
|---|---|---|
| `--font-primary` | `'Geist Mono Variable', ui-monospace, monospace` | Applied to `html, body, #root` |
| `--fw-thin` | 100 | Decorative only |
| `--fw-extralight` | 200 | Muted labels |
| `--fw-light` | 300 | `.nt-type-caption`, `.nt-type-muted` |
| `--fw-regular` | 400 | Default body, inputs |
| `--fw-medium` | 500 | Nav, controls, `.nt-type-label` |
| `--fw-semibold` | 600 | Card titles, headings |
| `--fw-bold` | 700 | Page titles, `.nt-type-display` |
| `--fw-extrabold` | 800 | Reserved for key metrics |
| `--fw-black` | 900 | Rare display emphasis |

### Typography hierarchy classes

`.nt-type-display` (700) · `.nt-type-heading` (600) · `.nt-type-subhead` (500) · `.nt-type-body` (400) · `.nt-type-label` (500, 0.75rem) · `.nt-type-caption` (300) · `.nt-type-muted` (300) · `.nt-type-code` (400) · `.nt-type-nav` (500, 0.8125rem) · `.nt-type-btn` (600)

### Theme-aware text colors added

| Token | Light | Dark |
|---|---|---|
| `--nt-text-link` | `#354e47` | `#8bbb92` |
| `--nt-text-interactive` | `#354e47` | `#8bbb92` |
| `--nt-text-placeholder` | `rgba(44,62,56,0.38)` | `rgba(216,237,230,0.32)` |

### Build result at M-19b
- `✓ 308 modules, 5.07s, clean` — 6 Geist Mono `.woff2` subsets emitted to dist ✅
- All three previously hardcoded `font-family: 'Inter'` declarations replaced ✅
- Google Fonts CDN `@import` removed — fully self-hosted ✅
- No new warnings or errors ✅

## M-19c Introduction Page (uncommitted)

**Goal:** Add a scrollable product-introduction page between the existing Landing Page and Dashboard.

### User journey (updated)
`LandingPage` (entry) → `IntroPage` (new) → `Dashboard` / New Tree

### New file
- `frontend/src/pages/IntroPage.jsx` — 7 sections: Hero, Why, How It Works, Adaptive Learning, Chunking, Career Pathway, Final CTA. Includes sticky header with nav links, light/dark theme toggle, and "Start Learning" CTA.

### Modified files
| File | Change |
|---|---|
| `frontend/src/App.jsx` | Added `'intro'` route + `import IntroPage` |
| `frontend/src/pages/LandingPage.jsx` | `navigateTo('dashboard')` → `navigateTo('intro')` |
| `frontend/src/styles/index.css` | ~570 lines of IntroPage CSS appended |

### Navigation & routing
- `'intro'` is **not** in `RESTORABLE_PAGES` — refresh from intro returns to `'landing'` (existing behavior for non-dashboard pages preserved).
- Theme toggle uses same `localStorage` key (`neurotree-theme`) and `applyThemeClass` pattern as `useCanvasTools`. Consistent with Tree Map theme.
- "Create Your First Tree →" and "Start Learning →" CTAs call `navigateTo('dashboard')`.

### Content accuracy
- All product capabilities described based on verified code (NT-01–NT-05, mastery ≥ 70 threshold, active recall quiz system).
- Two real published quotes: Roediger & McDaniel (*Make It Stick*, 2014) for active recall; George A. Miller (1956, *Psychological Review*) for chunking.
- Career Pathway section includes explicit disclaimer: exploratory, not employment guarantees.

### Build result at M-19c
- `✓ 309 modules, 6.74s, clean` ✅
- No new errors; pre-existing chunk size warning only ✅

## Next Task — Post-UAT (unchanged)

## M-19d Browser History / Back Navigation (uncommitted)

**Goal:** Make browser Back/Forward work consistently with SPA page transitions, and add an in-app Back button on IntroPage.

### Root cause
`navigateTo` only updated React state and `sessionStorage`. It never touched `window.history`, so the browser stack was always a single entry — Back/Forward had no effect inside the app.

### Implementation — `window.history` integration

| Change | Detail |
|---|---|
| `PAGE_TO_PATH` / `PATH_TO_PAGE` maps | `landing→/`, `intro→/intro`, `dashboard→/dashboard`, etc. |
| `pushHistoryEntry(page)` | Called inside `navigateTo`; uses `pushState` with guard against duplicate entries |
| `seedInitialHistoryEntry(page)` | `replaceState` on first mount so the initial entry has a recognisable state object |
| `readInitialPage()` replaces `readPersistedPage()` | Priority: `history.state.page` → `location.pathname` → `sessionStorage` |
| `popstate` listener in `AppProvider` | Reads `e.state.page` and calls `setPage` + `persistPage` — no pushState from here |
| `navigateTo` updated | Calls `pushHistoryEntry(target)` after updating React state |

### In-app Back button on IntroPage

- `handleBack()` in `IntroPage`: calls `window.history.back()` when there is a prior in-app entry; falls back to `navigateTo('landing')` when history has no prior entry (direct URL load, fresh tab).
- `IntroHeader` receives `onBack` prop; renders `← Back` button left of the wordmark.
- CSS: `.intro-back-btn` — skeuomorphic border, Geist Mono 500, hover slides left 2px.

### Modified files
| File | Change |
|---|---|
| `frontend/src/context/AppContext.jsx` | `readInitialPage`, `pushHistoryEntry`, `seedInitialHistoryEntry`, `popstate` listener, `navigateTo` updated |
| `frontend/src/pages/IntroPage.jsx` | `handleBack`, `onBack` prop on `IntroHeader`, Back button JSX |
| `frontend/src/styles/index.css` | `.intro-back-btn` CSS added |

### Navigation matrix after fix

| Action | Result |
|---|---|
| New tab (no history) | `history.state` empty → `readInitialPage` → `landing` ✅ |
| Click "Begin Learning" | `pushState({page:'intro'}, '', '/intro')` → URL changes to `/intro` ✅ |
| Click "Create Your First Tree" | `pushState({page:'dashboard'}, '', '/dashboard')` ✅ |
| Browser Back from Dashboard | `popstate` → `page='intro'` ✅ |
| Browser Back from IntroPage | `popstate` → `page='landing'` ✅ |
| Browser Forward | `popstate` → restores forward page ✅ |
| In-app "← Back" on IntroPage | `window.history.back()` ✅ |
| Direct open `/intro` | `pathname='/intro'` → `RESTORABLE_PAGES` → `intro` ✅ |
| Refresh on IntroPage | `history.state.page='intro'` → stays on intro ✅ |

### Build result at M-19d
- `✓ 309 modules, 8.47s, clean` ✅
- Browser testing not available in this environment — logic verified by code trace ✅

**Goal:** Confirm all M-13 + M-14 + M-15 UAT, then commit.

**Steps:**
1. Run manual UAT for Note persistence (Graph Note save/restore/delete/error).
2. Run manual UAT for Flashcard persistence (mark → close → reopen → refresh).
3. Run manual UAT for Career Pathway (auto panel fires, shows real career name, Panel B independent).
4. On all passing: `git add -A && git commit -m "feat: M-13/M-14/M-15 — Note+Flashcard persistence, Career Pathway two-panel UX + paham regression fix"`

## Absolute Rules
- DO NOT modify NT-01 through NT-05 Langflow flows unless explicitly requested.
- DO NOT change F-1 through F-6 behavior unless explicitly requested.
- Mastery threshold 70 is consistent across all code — do not change.
- DO NOT commit/push unless explicitly requested.
- DO NOT expose or commit `.env` files or API keys.
- After any change: run affected backend tests + `pnpm build`, report results.
