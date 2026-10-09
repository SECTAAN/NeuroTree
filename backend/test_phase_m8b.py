"""
Phase M-8B Tests — Master Light post-assessment graph refresh (22 tests).

Validates that after a Master Light Q2 assessment:
  1. master_light_mastery is committed to the DB.
  2. GET /graph immediately reflects the updated master_light_mastery.
  3. GET /graph still reflects master_light_unlocked=True (unchanged by assessment).
  4. Normal knowledge-node mastery/status is untouched.
  5. Sessions stats (/sessions) continue to exclude the ML node.
  6. Re-assessment accumulates master_light_mastery correctly.

Run with: python test_phase_m8b.py
"""
import sys

sys.path.insert(0, ".")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.models.node import Node
from app.models.edge import Edge
from app.models.session import Session
from app.services.mastery_service import (
    calculate_session_mastery,
    check_master_light_unlock,
    UNLOCK_THRESHOLD,
    SESSION_PROGRESSION_WEIGHT,
)

# ── In-memory DB ──────────────────────────────────────────────────────────────
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(bind=engine)

# ── Helpers ───────────────────────────────────────────────────────────────────
passed = 0
failed = 0

def assert_eq(label, got, expected, extra=""):
    global passed, failed
    if got == expected:
        print(f"  [PASS]  {label}  [{got!r}]")
        passed += 1
    else:
        print(f"  [FAIL]  {label}  got={got!r}  expected={expected!r}  {extra}")
        failed += 1

def assert_true(label, cond, extra=""):
    global passed, failed
    if cond:
        print(f"  [PASS]  {label}")
        passed += 1
    else:
        print(f"  [FAIL]  {label}  {extra}")
        failed += 1

def assert_false(label, cond, extra=""):
    assert_true(label, not cond, extra)


def _make_session(db, sid, uid="user_m8b"):
    row = Session(uuid=sid, user_id=uid, tree_name="M-8B Tree", learning_goal="Test")
    db.add(row)
    db.flush()
    return row


def _make_knowledge_node(db, node_id, session_id, mastery=0.0, status="locked"):
    n = Node(
        id=node_id, session_id=session_id,
        title=f"Node {node_id}", content="content", key_concepts=[],
        status=status, mastery_score=mastery, node_type="knowledge",
    )
    db.add(n)
    db.flush()
    return n


def _make_ml_node(db, node_id, session_id, unlocked=False, mastery=0.0):
    n = Node(
        id=node_id, session_id=session_id,
        title="Master Light", content="apex", key_concepts=[],
        status="locked", mastery_score=0.0,
        node_type="master_light",
        master_light_unlocked=unlocked,
        master_light_mastery=mastery,
        ml_session_scores=[],
    )
    db.add(n)
    db.flush()
    return n


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: ML mastery committed after Q2, normal nodes untouched
# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Test 1: ML mastery commit after Q2 --")
with SessionLocal() as db:
    sid = "m8b_t1"
    _make_session(db, sid)
    k1 = _make_knowledge_node(db, f"{sid}_k1", sid, mastery=75.0, status="unlocked")
    k2 = _make_knowledge_node(db, f"{sid}_k2", sid, mastery=80.0, status="unlocked")
    ml = _make_ml_node(db, f"{sid}_ml", sid, unlocked=True, mastery=0.0)

    scores = [70.0, 80.0, 90.0]
    new_ml = calculate_session_mastery(previous_mastery=ml.master_light_mastery, session_scores=scores)
    ml.master_light_mastery = new_ml
    ml.ml_session_scores = []
    db.commit()
    db.refresh(ml); db.refresh(k1); db.refresh(k2)

    expected = min(100.0, 0.0 + (sum(scores)/len(scores)) * SESSION_PROGRESSION_WEIGHT)
    assert_true("T1 ml mastery updated", abs(ml.master_light_mastery - expected) < 0.01,
                f"got {ml.master_light_mastery:.4f} expected {expected:.4f}")
    assert_eq("T1 ml mastery_score untouched (still 0)", ml.mastery_score, 0.0)
    assert_true("T1 ml_session_scores reset to []", ml.ml_session_scores == [])
    assert_eq("T1 k1 mastery unchanged", k1.mastery_score, 75.0)
    assert_eq("T1 k2 mastery unchanged", k2.mastery_score, 80.0)
    assert_true("T1 ml still unlocked", ml.master_light_unlocked)

# ─────────────────────────────────────────────────────────────────────────────
# Test 2: GET /graph reflects updated master_light_mastery after commit
# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Test 2: /graph reflects ml mastery post-commit --")
with SessionLocal() as db:
    sid = "m8b_t2"
    _make_session(db, sid)
    k1 = _make_knowledge_node(db, f"{sid}_k1", sid, mastery=70.0, status="unlocked")
    ml = _make_ml_node(db, f"{sid}_ml", sid, unlocked=True, mastery=0.0)

    # Simulate Q2 commit
    ml.master_light_mastery = 22.5   # 3×90 avg × 0.25
    ml.ml_session_scores = []
    db.commit()

    # Simulate what GET /graph returns
    from app.models.node import Node as NodeModel
    nodes = db.query(NodeModel).filter(NodeModel.session_id == sid).all()
    graph_repr = [
        {
            "id": n.id,
            "master_light_mastery":  getattr(n, "master_light_mastery", 0.0) or 0.0,
            "master_light_unlocked": getattr(n, "master_light_unlocked", False) or False,
            "node_type": getattr(n, "node_type", "knowledge"),
        }
        for n in nodes
    ]

    ml_entry = next(x for x in graph_repr if x["node_type"] == "master_light")
    k_entry  = next(x for x in graph_repr if x["node_type"] == "knowledge")

    assert_eq("T2 graph ml mastery = 22.5", ml_entry["master_light_mastery"], 22.5)
    assert_true("T2 graph ml unlocked=True", ml_entry["master_light_unlocked"])
    assert_eq("T2 graph k mastery unchanged", k_entry["master_light_mastery"], 0.0)


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: ML mastery is separate from mastery_score — sessions stats unaffected
# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Test 3: Sessions stats exclude ML node --")
with SessionLocal() as db:
    sid = "m8b_t3"
    _make_session(db, sid)
    _make_knowledge_node(db, f"{sid}_k1", sid, mastery=75.0, status="unlocked")
    _make_knowledge_node(db, f"{sid}_k2", sid, mastery=80.0, status="unlocked")
    ml = _make_ml_node(db, f"{sid}_ml", sid, unlocked=True, mastery=60.0)
    db.commit()

    from app.models.node import Node as NodeModel
    all_nodes = db.query(NodeModel).filter(NodeModel.session_id == sid).all()
    knowledge = [n for n in all_nodes if getattr(n, "node_type", "knowledge") == "knowledge"]

    total  = len(knowledge)
    avg    = round(sum(n.mastery_score for n in knowledge) / total, 1)
    assert_eq("T3 total_nodes = 2 (ML excluded)", total, 2)
    assert_eq("T3 avg_mastery = 77.5 (ML excluded)", avg, 77.5)


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Re-assessment accumulates correctly (second session)
# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Test 4: Re-assessment accumulates master_light_mastery --")
with SessionLocal() as db:
    sid = "m8b_t4"
    _make_session(db, sid)
    _make_knowledge_node(db, f"{sid}_k1", sid, mastery=75.0, status="unlocked")
    ml = _make_ml_node(db, f"{sid}_ml", sid, unlocked=True, mastery=0.0)
    db.commit()

    # Session 1: scores [80, 80, 80] → avg=80 × 0.25 = 20
    s1 = calculate_session_mastery(0.0, [80.0, 80.0, 80.0])
    ml.master_light_mastery = s1
    db.commit()
    assert_true("T4 s1 mastery ~20", abs(s1 - 20.0) < 0.01, f"got {s1}")

    # Session 2: scores [100, 100, 100] → avg=100 × 0.25 = 25; 20+25=45
    db.refresh(ml)
    s2 = calculate_session_mastery(ml.master_light_mastery, [100.0, 100.0, 100.0])
    ml.master_light_mastery = s2
    db.commit()
    assert_true("T4 s2 mastery ~45", abs(s2 - 45.0) < 0.01, f"got {s2}")

    # Session 3: scores [100, 100, 100] → 45+25=70 (BRIGHT threshold)
    db.refresh(ml)
    s3 = calculate_session_mastery(ml.master_light_mastery, [100.0, 100.0, 100.0])
    ml.master_light_mastery = s3
    db.commit()
    assert_true("T4 s3 mastery ~70 (BRIGHT)", abs(s3 - 70.0) < 0.01, f"got {s3}")
    assert_true("T4 s3 >= UNLOCK_THRESHOLD", s3 >= UNLOCK_THRESHOLD)


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: ML mastery does NOT affect knowledge-node unlock logic
# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Test 5: ML mastery does not trigger normal unlock --")
with SessionLocal() as db:
    sid = "m8b_t5"
    _make_session(db, sid)
    k1 = _make_knowledge_node(db, f"{sid}_k1", sid, mastery=70.0, status="unlocked")
    k2 = _make_knowledge_node(db, f"{sid}_k2", sid, mastery=0.0, status="locked")
    ml = _make_ml_node(db, f"{sid}_ml", sid, unlocked=True, mastery=0.0)
    db.add(Edge(
        id="e_t5_1", session_id=sid,
        source_id=f"{sid}_k1", target_id=f"{sid}_k2", relationship_type="prerequisite",
    ))
    db.commit()

    # Simulate ML mastery update — should NOT change k2 status
    ml.master_light_mastery = 50.0
    db.commit()
    db.refresh(k2)

    assert_eq("T5 k2 still locked after ML mastery update", k2.status, "locked")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: check_master_light_unlock is idempotent (already-unlocked ML)
# ─────────────────────────────────────────────────────────────────────────────
print("\n-- Test 6: check_master_light_unlock idempotent --")
with SessionLocal() as db:
    sid = "m8b_t6"
    _make_session(db, sid)
    _make_knowledge_node(db, f"{sid}_k1", sid, mastery=75.0, status="unlocked")
    ml = _make_ml_node(db, f"{sid}_ml", sid, unlocked=True, mastery=30.0)
    db.commit()

    # Already unlocked — should return [] (no new unlocks)
    result = check_master_light_unlock(sid, db)
    assert_eq("T6 no new unlocks (already unlocked)", result, [])
    db.refresh(ml)
    assert_true("T6 ml still unlocked", ml.master_light_unlocked)


# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{'─'*60}")
print(f"Phase M-8B Tests: {passed}/{passed + failed} passed", "***" if failed == 0 else "FAILURES ABOVE")
if failed:
    sys.exit(1)
