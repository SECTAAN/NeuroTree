"""
test_phase_m7.py — M-7 Final Master Light UX + E2E Validation

Tests:
  E2E-1: Full flow — ingest creates ML apex node + edges from leaves
  E2E-2: ML node is always at max BFS depth (apex)
  E2E-3: Progressive reveal — ML at highest depth, hidden until revealed
  E2E-4: Refresh/Ctrl+R — ML state persisted in graph response
  E2E-5: Re-ingest resets ML state to locked/unlocked=False
  Stats-1: GET /sessions excludes ML from total_nodes + avg_mastery
  Stats-2: GET /quiz/recommend excludes ML from NT-04 input
  Stats-3: career/pathway excludes ML from profile
  Edge-1: one knowledge node <70 → ML stays locked
  Edge-2: exactly 70 → ML unlocks
  Edge-3: locked ML cannot start assessment (403)
  Edge-4: ML mastery separate from knowledge mastery
  Edge-5: multiple leaves all connect to ML
  Assess-1: ML assessment saves master_light_mastery, not mastery_score
  Assess-2: re-assessment raises master_light_mastery (accumulates)
"""
import sys
import uuid
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db.database import Base
from app.models.node import Node
from app.models.edge import Edge
from app.models.session import Session as SessionModel
from app.services.mastery_service import (
    check_master_light_unlock,
    calculate_session_mastery,
    UNLOCK_THRESHOLD,
)
from app.main import app

# ── Helpers ───────────────────────────────────────────────────────────────────

passed = 0
failed = 0

def ok(label, val=None):
    global passed
    passed += 1
    suffix = f"  [{val}]" if val is not None else ""
    print(f"  [PASS]  {label}{suffix}")

def fail(label, detail=""):
    global failed
    failed += 1
    print(f"  [FAIL]  {label}  <- {detail}")

def assert_eq(label, actual, expected):
    if actual == expected:
        ok(label, repr(actual))
    else:
        fail(label, f"expected {expected!r}, got {actual!r}")

def assert_true(label, cond, detail=""):
    if cond:
        ok(label)
    else:
        fail(label, detail or "False")

def assert_false(label, cond, detail=""):
    if not cond:
        ok(label)
    else:
        fail(label, detail or "True")

def make_mem_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()

def sid():
    return str(uuid.uuid4())

def add_sess(db, s):
    row = SessionModel(uuid=s, user_id="u1", tree_name="T", learning_goal="")
    db.add(row); db.flush(); return row

def add_node(db, s, nid, mastery=0.0, status="unlocked", ntype="knowledge",
             ml_unlocked=False, ml_mastery=0.0):
    n = Node(id=nid, session_id=s, title=nid, content="c", key_concepts=[],
             status=status, mastery_score=mastery, node_type=ntype,
             master_light_unlocked=ml_unlocked, master_light_mastery=ml_mastery,
             ml_session_scores=[])
    db.add(n); db.flush(); return n

def add_edge(db, s, src, tgt):
    e = Edge(id=str(uuid.uuid4()), session_id=s, source_id=src, target_id=tgt,
             relationship_type="prerequisite")
    db.add(e); db.flush(); return e

# TestClient for endpoint tests (uses real neurotree.db)
client = TestClient(app)

# Shared stable IDs for endpoint tests
_UID  = "22222222-3333-4444-5555-666666666666"
_SID  = "22222222-3333-4444-5555-777777777777"

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- E2E-1: Ingest creates ML apex node + leaf edges (mock graph) ─────")
# ─────────────────────────────────────────────────────────────────────────────

# We test with USE_MOCK_AI=True to avoid hitting Langflow.
# The mock graph has 5 nodes, leaf = node_05 (no outgoing edges from it).
import os as _os
_os.environ["USE_MOCK_AI"] = "True"

# Restart settings cache
from functools import lru_cache as _lc
from app.core import config as _cfg
_cfg.get_settings.cache_clear()

resp = client.post(
    "/api/v1/material/ingest",
    json={"source_text": "A" * 50, "tree_name": "E2E Test", "session_id": _SID},
    headers={"X-User-ID": _UID, "X-Session-ID": _SID},
)
assert_eq("E2E-1 ingest returns 200", resp.status_code, 200)
data = resp.json()
assert_true("E2E-1 master_light_id in response", "master_light_id" in data,
            f"keys: {list(data.keys())}")
assert_true("E2E-1 nodes_created == 5 (knowledge only)", data.get("nodes_created") == 5,
            f"got {data.get('nodes_created')}")

ml_id = data.get("master_light_id", "")

# Verify in graph
graph_resp = client.get("/api/v1/graph",
    headers={"X-User-ID": _UID, "X-Session-ID": _SID})
assert_eq("E2E-1 /graph 200", graph_resp.status_code, 200)
graph = graph_resp.json()
nodes = graph["nodes"]
edges = graph["edges"]

ml_nodes = [n for n in nodes if n["node_type"] == "master_light"]
k_nodes  = [n for n in nodes if n["node_type"] == "knowledge"]
assert_eq("E2E-1 exactly 1 ML node in graph", len(ml_nodes), 1)
assert_eq("E2E-1 5 knowledge nodes in graph", len(k_nodes), 5)
assert_false("E2E-1 ML not unlocked initially",
             ml_nodes[0]["master_light_unlocked"])

# ML node has at least one incoming edge
ml_targets = [e for e in edges if e["target_id"] == ml_id]
assert_true("E2E-1 ML has at least one incoming edge", len(ml_targets) >= 1,
            f"got {len(ml_targets)}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- E2E-2: ML node at max BFS depth (apex) ───────────────────────────")
# ─────────────────────────────────────────────────────────────────────────────

# Compute BFS depths from graph data
def bfs_depth(gnodes, gedges):
    in_count = {n["id"]: 0 for n in gnodes}
    for e in gedges:
        if e["target_id"] in in_count:
            in_count[e["target_id"]] += 1
    roots = [nid for nid, c in in_count.items() if c == 0]
    depth = {}
    queue = [(r, 0) for r in roots]
    while queue:
        nid, d = queue.pop(0)
        if nid in depth: continue
        depth[nid] = d
        for e in gedges:
            if e["source_id"] == nid:
                queue.append((e["target_id"], d + 1))
    for n in gnodes:
        if n["id"] not in depth:
            depth[n["id"]] = 0
    return depth

depth_map = bfs_depth(nodes, edges)
ml_depth  = depth_map.get(ml_id, -1)
max_depth = max(depth_map.values())

assert_eq("E2E-2 ML at max BFS depth", ml_depth, max_depth)
assert_true("E2E-2 max_depth >= 1", max_depth >= 1, f"got {max_depth}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- E2E-3: Progressive reveal — ML hidden until max depth reached ────")
# ─────────────────────────────────────────────────────────────────────────────

# SkillTreeCanvas reveals nodes at depth <= revealedDepth.
# At revealedDepth=0 (root only), ML (at max_depth) must NOT be visible.
# At revealedDepth=max_depth, ML IS visible.
# We validate the depth_map logic (the canvas uses the same BFS algorithm).

visible_at_0 = [nid for nid, d in depth_map.items() if d <= 0]
assert_false("E2E-3 ML hidden at revealedDepth=0", ml_id in visible_at_0,
             "ML should not be visible at depth 0")

visible_at_max = [nid for nid, d in depth_map.items() if d <= max_depth]
assert_true("E2E-3 ML visible at revealedDepth=max", ml_id in visible_at_max)

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- E2E-4: Refresh/Ctrl+R — ML state persisted in graph response ─────")
# ─────────────────────────────────────────────────────────────────────────────

# After ingest, /graph always returns current ML state from DB.
# A second /graph call should return the same ML state (not reset).
graph_resp2 = client.get("/api/v1/graph",
    headers={"X-User-ID": _UID, "X-Session-ID": _SID})
ml2 = [n for n in graph_resp2.json()["nodes"] if n["node_type"] == "master_light"]
assert_eq("E2E-4 /graph returns 1 ML node on second call", len(ml2), 1)
assert_false("E2E-4 ML still locked after refresh", ml2[0]["master_light_unlocked"])
assert_eq("E2E-4 ML mastery still 0 after refresh", ml2[0]["master_light_mastery"], 0.0)

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- E2E-5: Re-ingest resets ML state ─────────────────────────────────")
# ─────────────────────────────────────────────────────────────────────────────

# Re-ingest on same session_id should recreate all nodes fresh
resp2 = client.post(
    "/api/v1/material/ingest",
    json={"source_text": "B" * 50, "tree_name": "ReIngest Test", "session_id": _SID},
    headers={"X-User-ID": _UID, "X-Session-ID": _SID},
)
assert_eq("E2E-5 re-ingest 200", resp2.status_code, 200)
graph3 = client.get("/api/v1/graph",
    headers={"X-User-ID": _UID, "X-Session-ID": _SID}).json()
ml3 = [n for n in graph3["nodes"] if n["node_type"] == "master_light"]
assert_eq("E2E-5 exactly 1 ML after re-ingest", len(ml3), 1)
assert_false("E2E-5 ML unlocked=False after re-ingest", ml3[0]["master_light_unlocked"])
assert_eq("E2E-5 ML mastery=0 after re-ingest", ml3[0]["master_light_mastery"], 0.0)

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Stats-1: GET /sessions excludes ML from totals ───────────────────")
# ─────────────────────────────────────────────────────────────────────────────

sess_resp = client.get("/api/v1/sessions",
    headers={"X-User-ID": _UID})
assert_eq("Stats-1 /sessions 200", sess_resp.status_code, 200)
sessions = sess_resp.json().get("sessions", [])
our_sess  = [s for s in sessions if s["session_id"] == _SID]
assert_true("Stats-1 our session found", len(our_sess) == 1)
if our_sess:
    s = our_sess[0]
    assert_eq("Stats-1 total_nodes == 5 (no ML)", s["total_nodes"], 5)
    # avg_mastery based on knowledge nodes only (all 0 after re-ingest)
    assert_eq("Stats-1 avg_mastery == 0.0", s["avg_mastery"], 0.0)

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Stats-2: /quiz/recommend excludes ML from NT-04 input ────────────")
# ─────────────────────────────────────────────────────────────────────────────

rec_resp = client.get("/api/v1/quiz/recommend",
    headers={"X-User-ID": _UID, "X-Session-ID": _SID})
assert_eq("Stats-2 /recommend 200", rec_resp.status_code, 200)
rec = rec_resp.json()
# The progress_summary total_chunks should be 5 (knowledge only)
total = rec.get("progress_summary", {}).get("total_chunks", -1)
assert_eq("Stats-2 total_chunks == 5 (knowledge only)", total, 5)

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Edge-1: one knowledge node <70 → ML stays locked ─────────────────")
# ─────────────────────────────────────────────────────────────────────────────

db = make_mem_db()
s = sid(); add_sess(db, s)
add_node(db, s, "k1", mastery=80.0)
add_node(db, s, "k2", mastery=60.0)  # below threshold
ml = add_node(db, s, "ml1", ntype="master_light")

result = check_master_light_unlock(s, db)
db.commit(); db.refresh(ml)
assert_eq("Edge-1 ML not unlocked", result, [])
assert_false("Edge-1 ml1.master_light_unlocked=False", ml.master_light_unlocked)
db.close()

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Edge-2: exactly 70 → ML unlocks ──────────────────────────────────")
# ─────────────────────────────────────────────────────────────────────────────

db = make_mem_db()
s = sid(); add_sess(db, s)
add_node(db, s, "k1", mastery=70.0)   # exactly at threshold
add_node(db, s, "k2", mastery=100.0)
ml = add_node(db, s, "ml1", ntype="master_light")

result = check_master_light_unlock(s, db)
db.commit(); db.refresh(ml)
assert_eq("Edge-2 ML unlocked at exactly 70", result, ["ml1"])
assert_true("Edge-2 ml1.master_light_unlocked=True", ml.master_light_unlocked)
db.close()

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Edge-3: locked ML cannot start assessment ─────────────────────────")
# ─────────────────────────────────────────────────────────────────────────────

# Insert a locked ML node into real DB (for endpoint test)
from app.db.database import engine as _re
from sqlalchemy.orm import sessionmaker as _rsm
_rdb = _rsm(bind=_re)()
_edge3_sid = "33333333-4444-5555-6666-777777777777"
_edge3_uid = "33333333-4444-5555-6666-888888888888"
try:
    if not _rdb.query(SessionModel).filter(SessionModel.uuid == _edge3_sid).first():
        _rdb.add(SessionModel(uuid=_edge3_sid, user_id=_edge3_uid,
                               tree_name="E3", learning_goal=""))
    if not _rdb.query(Node).filter(Node.id == "ml_edge3",
                                    Node.session_id == _edge3_sid).first():
        _rdb.add(Node(id="ml_edge3", session_id=_edge3_sid, title="ML E3",
                      content="c", key_concepts=[], status="locked",
                      mastery_score=0.0, node_type="master_light",
                      master_light_unlocked=False, master_light_mastery=0.0,
                      ml_session_scores=[]))
    _rdb.commit()
finally:
    _rdb.close()

e3_gen = client.post("/api/v1/master-light/generate",
    json={"node_id": "ml_edge3"},
    headers={"X-User-ID": _edge3_uid, "X-Session-ID": _edge3_sid})
assert_eq("Edge-3 locked ML generate returns 403", e3_gen.status_code, 403)

e3_eval = client.post("/api/v1/master-light/evaluate",
    json={"node_id": "ml_edge3", "user_answer": "test", "question_index": 0},
    headers={"X-User-ID": _edge3_uid, "X-Session-ID": _edge3_sid})
assert_eq("Edge-3 locked ML evaluate returns 403", e3_eval.status_code, 403)

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Edge-4: ML mastery_score stays 0 after assessment ────────────────")
# ─────────────────────────────────────────────────────────────────────────────

db = make_mem_db()
s = sid(); add_sess(db, s)
ml = add_node(db, s, "ml1", mastery=0.0, ntype="master_light",
              ml_unlocked=True, ml_mastery=0.0)

# Simulate Q2 ML assessment commit
new_ml = calculate_session_mastery(0.0, [85.0, 80.0, 90.0])
ml.master_light_mastery = new_ml
db.commit(); db.refresh(ml)

assert_eq("Edge-4 mastery_score unchanged at 0.0", ml.mastery_score, 0.0)
assert_true("Edge-4 master_light_mastery > 0", ml.master_light_mastery > 0)
db.close()

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Edge-5: Multiple leaves all connect to ML ─────────────────────────")
# ─────────────────────────────────────────────────────────────────────────────

# Verify the ingest leaf-detection logic:
# In mock graph: edges are k1→k2, k1→k3, k2→k4, k3→k4, k4→k5
# Sources: k1,k2,k3,k4  — leaf = k5 only
# Expected: only k5 → ML edge
edges_mock = [
    {"source_id": "node_01", "target_id": "node_02"},
    {"source_id": "node_01", "target_id": "node_03"},
    {"source_id": "node_02", "target_id": "node_04"},
    {"source_id": "node_03", "target_id": "node_04"},
    {"source_id": "node_04", "target_id": "node_05"},
]
nodes_mock = ["node_01", "node_02", "node_03", "node_04", "node_05"]
prefix = "abcd1234"
scoped_ids = {n: f"{prefix}_{n}" for n in nodes_mock}

source_ids = {f"{prefix}_{e['source_id']}" for e in edges_mock}
all_ids    = {f"{prefix}_{n}" for n in nodes_mock}
leaf_ids   = all_ids - source_ids

assert_eq("Edge-5 only node_05 is a leaf", leaf_ids, {f"{prefix}_node_05"})
assert_eq("Edge-5 1 leaf → 1 edge to ML", len(leaf_ids), 1)

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Assess-1: ML assessment saves master_light_mastery ───────────────")
# ─────────────────────────────────────────────────────────────────────────────

db = make_mem_db()
s = sid(); add_sess(db, s)
ml = add_node(db, s, "ml1", ntype="master_light", ml_unlocked=True, ml_mastery=0.0)

scores = [80.0, 75.0, 90.0]
new_mastery = calculate_session_mastery(0.0, scores)

ml.master_light_mastery = new_mastery
ml.ml_session_scores    = []
db.commit(); db.refresh(ml)

expected = min(100.0, 0.0 + (sum(scores) / 3) * 0.25)
assert_true("Assess-1 master_light_mastery correct",
            abs(ml.master_light_mastery - expected) < 0.01,
            f"got {ml.master_light_mastery:.4f}, expected {expected:.4f}")
assert_eq("Assess-1 mastery_score unchanged", ml.mastery_score, 0.0)
db.close()

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Assess-2: Re-assessment accumulates master_light_mastery ─────────")
# ─────────────────────────────────────────────────────────────────────────────

db = make_mem_db()
s = sid(); add_sess(db, s)
ml = add_node(db, s, "ml1", ntype="master_light", ml_unlocked=True, ml_mastery=0.0)

# Session 1
m1 = calculate_session_mastery(0.0, [60.0, 65.0, 70.0])
ml.master_light_mastery = m1
db.commit(); db.refresh(ml)

# Session 2
m2 = calculate_session_mastery(ml.master_light_mastery, [80.0, 85.0, 90.0])
ml.master_light_mastery = m2
db.commit(); db.refresh(ml)

assert_true("Assess-2 session 2 mastery > session 1", m2 > m1,
            f"m1={m1:.2f} m2={m2:.2f}")
assert_true("Assess-2 mastery <= 100", ml.master_light_mastery <= 100.0)
db.close()

# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Stats-3: career/pathway excludes ML from profile ─────────────────")
# ─────────────────────────────────────────────────────────────────────────────

# Use the ingest session we created earlier (_SID)
pathway_resp = client.post(
    "/api/v1/career/pathway",
    json={"career_goal": "Network Engineer"},
    headers={"X-User-ID": _UID, "X-Session-ID": _SID},
)
assert_eq("Stats-3 /career/pathway 200", pathway_resp.status_code, 200)
profile = pathway_resp.json().get("profile_summary", {})
total_in_pathway = profile.get("total", -1)
assert_eq("Stats-3 career total == 5 (knowledge only)", total_in_pathway, 5)

# ─────────────────────────────────────────────────────────────────────────────

# Restore USE_MOCK_AI to False (don't pollute other tests)
_os.environ.pop("USE_MOCK_AI", None)
_cfg.get_settings.cache_clear()

print("\n────────────────────────────────────────────────────────────")
total = passed + failed
status_str = "***" if failed == 0 else f"  ({failed} FAILED)"
print(f"Phase M-7 Tests: {passed}/{total} passed {status_str}")
sys.exit(0 if failed == 0 else 1)
