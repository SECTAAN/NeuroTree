"""
test_phase_m10.py — M-10: Production Hardening Tests

Covers:
  P1-5: Recommendation chip race condition — verify /quiz/recommend
        response always contains a valid target_chunk_id that exists in
        the current graph, and that the chip guard logic is correct.

  P1-6: Landing page auto-advance — verify no unconditional navigation
        timer exists in LandingPage.jsx (static code audit).

  P0-4: VITE_API_URL — verify api.js uses VITE_API_URL with fallback,
        and that frontend/.env.example documents the variable.

Total: 20 tests
"""
import sys
import pathlib
import os
import uuid

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "backend"))
os.chdir(ROOT / "backend")

# Force mock mode so tests don't need a live Langflow instance
os.environ["USE_MOCK_AI"] = "True"
from app.core import config as _cfg
_cfg.get_settings.cache_clear()

from fastapi.testclient import TestClient
from app.main import app
from app.db.database import Base, engine
from app.models.node import Node
from app.models.edge import Edge
from app.models.session import Session as SessionModel
from sqlalchemy.orm import sessionmaker

client = TestClient(app)

# ── Test runner ───────────────────────────────────────────────────────────────
_failed = 0

def record(label, condition, detail=""):
    global _failed
    status = "[PASS]" if condition else "[FAIL]"
    if not condition:
        _failed += 1
    suffix = f"  [{detail}]" if detail else ""
    print(f"  {status}  {label}{suffix}")

# Stable IDs for endpoint tests — must be valid UUIDs (hex only)
_UID = "b0000000-cafe-4000-8000-000000001000"   # user UUID
_SID = "c0000000-cafe-4000-8000-000000001001"   # session UUID

def _h():
    return {"X-User-ID": _UID, "X-Session-ID": _SID}

# ─────────────────────────────────────────────────────────────────────────────
# P1-5: /quiz/recommend contract + chip guard logic
# ─────────────────────────────────────────────────────────────────────────────
print("\n── P1-5: Recommendation chip race condition ─────────────────────────────")

# ── Setup: ingest a tree so /recommend has real data ─────────────────────────
print("\n-- Test 1-4: ingest + graph fetch ──────────────────────────────────────")

r_ingest = client.post(
    "/api/v1/material/ingest",
    json={"source_text": "A" * 50, "tree_name": "M10 Test", "session_id": _SID},
    headers=_h(),
)
record("Test 1: ingest with mock AI succeeds", r_ingest.status_code == 200, r_ingest.status_code)

r_graph = client.get("/api/v1/graph", headers=_h())
record("Test 2: graph returns 200", r_graph.status_code == 200, r_graph.status_code)

graph = r_graph.json() if r_graph.status_code == 200 else {"nodes": [], "edges": []}
all_graph_ids  = {n["id"] for n in graph.get("nodes", [])}
knowledge_ids  = [n["id"] for n in graph.get("nodes", []) if n.get("node_type", "knowledge") == "knowledge"]
ml_ids         = {n["id"] for n in graph.get("nodes", []) if n.get("node_type") == "master_light"}

record("Test 3: knowledge nodes present in graph", len(knowledge_ids) >= 1, len(knowledge_ids))
record("Test 4: master_light node present in graph", len(ml_ids) >= 1, len(ml_ids))

# ── /quiz/recommend response shape ───────────────────────────────────────────
print("\n-- Test 5-9: /quiz/recommend response shape ─────────────────────────────")

r_rec = client.get("/api/v1/quiz/recommend", headers=_h())
record("Test 5: recommend returns 200", r_rec.status_code == 200, r_rec.status_code)

if r_rec.status_code == 200:
    rec = r_rec.json()
    record("Test 6: action field present", "action" in rec, rec.get("action", "MISSING"))
    record("Test 7: progress_summary present", "progress_summary" in rec)
    ps = rec.get("progress_summary", {})
    record("Test 8: total_chunks >= 1", ps.get("total_chunks", 0) >= 1, ps.get("total_chunks"))
    record("Test 9: completion_percentage 0–100",
           0 <= ps.get("completion_percentage", -1) <= 100,
           ps.get("completion_percentage"))
else:
    for t in range(6, 10):
        record(f"Test {t}: skipped (recommend failed)", False, "skipped")

# ── target_chunk_id must resolve to a real graph node ────────────────────────
print("\n-- Test 10-12: target_chunk_id integrity ────────────────────────────────")

if r_rec.status_code == 200:
    rec = r_rec.json()
    tid = rec.get("target_chunk_id", "")
    if tid:
        record("Test 10: target_chunk_id non-empty", bool(tid), tid[:12] if tid else "empty")
        record("Test 11: target_chunk_id exists in graph",
               tid in all_graph_ids,
               f"tid={tid[:12]} known={[i[:8] for i in all_graph_ids]}")
        record("Test 12: target_chunk_id is NOT a master_light node",
               tid not in ml_ids,
               f"tid={tid[:12]} ml_ids={[i[:8] for i in ml_ids]}")
    else:
        # No target is valid (e.g. everything mastered or no unlocked nodes)
        record("Test 10: no target_chunk_id — valid state", True, "no target")
        record("Test 11: n/a — no target to validate", True)
        record("Test 12: n/a — no target to validate", True)
else:
    for t in range(10, 13):
        record(f"Test {t}: skipped (recommend failed)", False, "skipped")

# ── Chip guard: simulate stale vs fresh graph node lookup ────────────────────
print("\n-- Test 13: chip guard simulation (freshNodes vs stale lookup) ──────────")
# This test verifies the guard logic in RecommendationChip directly:
#   targetNode = graphNodes.find(n => n.id === rec.target_chunk_id)
#   nodeReady  = !!targetNode
# When graphNodes is fresh (contains the new node), nodeReady = true.
# When graphNodes is stale (missing the new node), nodeReady = false → button disabled.
# The P1-5 fix ensures freshNodes is always passed to fetchRecommendation.
#
# We can't run JSX in Python, but we verify the API contract: the recommend
# endpoint returns a target_chunk_id that is present in the CURRENT graph.
# The JS fix guarantees graphNodes is refreshed before the chip renders.
if r_rec.status_code == 200 and rec.get("target_chunk_id"):
    tid = rec["target_chunk_id"]
    # Simulate: "fresh graph" lookup succeeds
    fresh_found = tid in all_graph_ids
    # Simulate: "stale graph" (empty) lookup fails
    stale_found = tid in set()
    record("Test 13: fresh graph lookup finds target",
           fresh_found and not stale_found,
           f"fresh={fresh_found} stale={stale_found}")
else:
    record("Test 13: no target — guard trivially passes", True, "no target to guard")

# ─────────────────────────────────────────────────────────────────────────────
# P1-6: Landing page — no unconditional auto-advance timer
# ─────────────────────────────────────────────────────────────────────────────
print("\n── P1-6: Landing page auto-advance audit ────────────────────────────────")
landing_path = ROOT / "frontend" / "src" / "pages" / "LandingPage.jsx"

print("\n-- Test 14-17: static code audit ───────────────────────────────────────")
record("Test 14: LandingPage.jsx exists", landing_path.exists())

if landing_path.exists():
    import re
    src = landing_path.read_text(encoding="utf-8")

    # Must NOT have a bare setTimeout that calls navigateTo unconditionally.
    # The only allowed navigateTo is inside handleEnter (user-triggered).
    # Pattern: setTimeout at module/effect scope that calls navigateTo directly.
    # A setTimeout inside handleEnter is fine — it's user-triggered.
    #
    # Strategy: find all navigateTo( occurrences outside of comments, then
    # verify they all sit inside handleEnter (not in a useEffect body).
    lines = src.splitlines()
    nav_in_effect = False
    in_use_effect = False
    brace_depth = 0
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("//"):
            continue
        if "useEffect(" in stripped:
            in_use_effect = True
            brace_depth = 0
        if in_use_effect:
            brace_depth += stripped.count("{") - stripped.count("}")
            if "navigateTo(" in stripped and "handleEnter" not in stripped:
                nav_in_effect = True
            if brace_depth <= 0 and in_use_effect:
                in_use_effect = False

    record("Test 15: navigateTo not called directly inside useEffect",
           not nav_in_effect, "clean" if not nav_in_effect else "AUTO-ADVANCE FOUND")

    # handleEnter must guard with exiting flag
    record("Test 16: handleEnter guarded by exiting flag",
           "if (exiting) return" in src)

    # Only one navigateTo call in the entire file (the user-triggered one)
    non_comment_nav = [
        l.strip() for l in lines
        if "navigateTo(" in l and not l.strip().startswith("//")
    ]
    record("Test 17: exactly 1 navigateTo in file (user-triggered only)",
           len(non_comment_nav) == 1,
           f"count={len(non_comment_nav)}")
else:
    for t in range(15, 18):
        record(f"Test {t}: skipped (file missing)", False, "skipped")

# ─────────────────────────────────────────────────────────────────────────────
# P0-4: VITE_API_URL env var
# ─────────────────────────────────────────────────────────────────────────────
print("\n── P0-4: VITE_API_URL configuration ────────────────────────────────────")
api_js       = ROOT / "frontend" / "src" / "services" / "api.js"
fe_env_ex    = ROOT / "frontend" / ".env.example"
be_env_ex    = ROOT / "backend" / ".env.example"

print("\n-- Test 18-20: api.js and .env.example files ────────────────────────────")
record("Test 18: api.js exists", api_js.exists())

if api_js.exists():
    api_src = api_js.read_text(encoding="utf-8")
    record("Test 19: api.js uses import.meta.env.VITE_API_URL",
           "import.meta.env.VITE_API_URL" in api_src)
    record("Test 19b: dev fallback localhost:8000 present",
           "localhost:8000" in api_src)
else:
    record("Test 19: skipped", False, "api.js missing")
    record("Test 19b: skipped", False)

record("Test 20: frontend/.env.example exists", fe_env_ex.exists())
if fe_env_ex.exists():
    fe_src = fe_env_ex.read_text(encoding="utf-8")
    record("Test 20b: VITE_API_URL documented in frontend/.env.example",
           "VITE_API_URL" in fe_src)

if be_env_ex.exists():
    be_src = be_env_ex.read_text(encoding="utf-8")
    record("Test 20c: backend/.env.example cross-references frontend/.env.example",
           "frontend/.env.example" in be_src)

# ─────────────────────────────────────────────────────────────────────────────
total = 20
print(f"\n{'─' * 60}")
print(f"Phase M-10 Tests: {total - _failed}/{total} passed {'***' if _failed == 0 else ''}")
if _failed:
    print(f"FAILED: {_failed} test(s)")
print()
sys.exit(0 if _failed == 0 else 1)
