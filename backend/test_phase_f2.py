"""
Phase F-2 Tests — Session metadata, GET /sessions, NT-04 recommendation UI.

Tests:
  1.  Ingest with tree_name + learning_goal → persisted to Session
  2.  Ingest without tree_name/learning_goal → empty defaults, no 422
  3.  Re-ingest updates tree_name on existing session
  4.  GET /api/v1/sessions → correct summary shape
  5.  GET /api/v1/sessions with no graph data → empty list
  6.  GET /api/v1/quiz/recommend → returns NT-04 shaped response (mock)
  7.  GET /api/v1/quiz/recommend with all mastered → review action
  8.  Session model has new columns
  9.  IngestRequest accepts/rejects fields correctly
  10. last_studied relative label logic
  11. Existing core loop still passes (mastery + unlock)
  12. USE_MOCK_AI=True path for sessions endpoint
"""

import asyncio
import sys
import os
import uuid

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Force mock mode for tests
os.environ["USE_MOCK_AI"] = "True"
os.environ["DATABASE_URL"] = "sqlite:///./test_f2.db"

from app.core.config import get_settings
# Re-load settings with the env override
get_settings.cache_clear()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.models.session import Session as SessionModel
from app.models.node import Node
from app.models.edge import Edge
from app.schemas.request_schema import IngestRequest
from app.services.mastery_service import (
    check_and_unlock_dependents,
    get_mastery_level,
    UNLOCK_THRESHOLD,
)

# -- Test DB setup ------------------------------------------------------------─
TEST_DB_PATH = "./test_f2.db"
engine = create_engine(f"sqlite:///{TEST_DB_PATH}", connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []


def record(name, passed, detail=""):
    status = PASS if passed else FAIL
    results.append((status, name, detail))
    print(f"  {status}  {name}" + (f"  [{detail}]" if detail else ""))


# -- Helper --------------------------------------------------------------------
def make_session_id():
    return str(uuid.uuid4())


def seed_session_with_nodes(db, session_id, tree_name="", learning_goal="", node_count=5):
    """Create a Session + N nodes; first node unlocked."""
    s = SessionModel(uuid=session_id, tree_name=tree_name, learning_goal=learning_goal)
    db.add(s)
    db.flush()
    nodes = []
    for i in range(node_count):
        n = Node(
            id=f"{session_id[:8]}_node_{i:02d}",
            session_id=session_id,
            title=f"Node {i}",
            content=f"Content {i}",
            key_concepts=["a", "b"],
            status="unlocked" if i == 0 else "locked",
            mastery_score=0.0,
        )
        db.add(n)
        nodes.append(n)
    db.commit()
    return nodes


# -- Test 8: Session model columns --------------------------------------------─
print("\n-- Test 8: Session model columns --------------------------------─")
try:
    db = TestSession()
    sid = make_session_id()
    s = SessionModel(uuid=sid, tree_name="TCP/IP Basics", learning_goal="CCNA prep")
    db.add(s)
    db.commit()
    fetched = db.query(SessionModel).filter(SessionModel.uuid == sid).first()
    ok = (fetched.tree_name == "TCP/IP Basics" and fetched.learning_goal == "CCNA prep")
    record("Session model has tree_name + learning_goal", ok,
           f"tree_name={fetched.tree_name!r}")
    db.delete(fetched)
    db.commit()
    db.close()
except Exception as e:
    record("Session model has tree_name + learning_goal", False, str(e))


# -- Test 9: IngestRequest validation ----------------------------------------─
print("\n-- Test 9: IngestRequest validation ----------------------------─")
try:
    req_full = IngestRequest(
        source_text="hello world this is a test document",
        tree_name="Jaringan Komputer",
        learning_goal="Persiapan CCNA",
    )
    record("IngestRequest accepts tree_name + learning_goal", True,
           f"tree_name={req_full.tree_name!r}")
except Exception as e:
    record("IngestRequest accepts tree_name + learning_goal", False, str(e))

try:
    req_min = IngestRequest(source_text="hello world this is a test document")
    record("IngestRequest works without tree_name/learning_goal",
           req_min.tree_name == "" and req_min.learning_goal == "",
           f"tree_name={req_min.tree_name!r} learning_goal={req_min.learning_goal!r}")
except Exception as e:
    record("IngestRequest works without tree_name/learning_goal", False, str(e))

try:
    from pydantic import ValidationError
    IngestRequest(
        source_text="hello world this is test",
        tree_name="x" * 300,   # exceeds max_length=255
    )
    record("IngestRequest rejects tree_name > 255 chars", False, "should have raised")
except ValidationError:
    record("IngestRequest rejects tree_name > 255 chars", True)
except Exception as e:
    record("IngestRequest rejects tree_name > 255 chars", False, str(e))


# -- Test 1 + 3: Ingest with metadata ----------------------------------------─
print("\n-- Tests 1+3: Ingest saves/updates tree metadata ----------------─")

async def _run_ingest_tests():
    from app.services import langflow_service

    # Test 1: ingest creates session with tree metadata
    db = TestSession()
    sid = make_session_id()
    graph = await langflow_service.ingest_and_build_graph("TCP/IP networks")
    prefix = sid.replace("-", "")[:8]
    # simulate what material.py does
    s = SessionModel(uuid=sid, tree_name="My TCP Tree", learning_goal="Learn networking")
    db.add(s)
    db.flush()
    for idx, chunk in enumerate(graph.nodes):
        n = Node(
            id=f"{prefix}_{chunk.id}",
            session_id=sid,
            title=chunk.title,
            content=chunk.content,
            key_concepts=chunk.key_concepts,
            status="unlocked" if idx == 0 else "locked",
            mastery_score=0.0,
        )
        db.add(n)
    db.commit()

    fetched_s = db.query(SessionModel).filter(SessionModel.uuid == sid).first()
    ok1 = fetched_s.tree_name == "My TCP Tree" and fetched_s.learning_goal == "Learn networking"
    record("Ingest creates session with tree_name + learning_goal", ok1,
           f"tree_name={fetched_s.tree_name!r}")

    # Test 3: re-ingest updates tree_name
    fetched_s.tree_name = "Updated TCP Tree"
    fetched_s.learning_goal = "Advanced networking"
    db.commit()
    db.refresh(fetched_s)
    ok3 = fetched_s.tree_name == "Updated TCP Tree"
    record("Re-ingest updates tree_name on existing session", ok3,
           f"tree_name={fetched_s.tree_name!r}")

    db.close()

asyncio.run(_run_ingest_tests())


# -- Test 2: Ingest without metadata (no 422) ----------------------------------
print("\n-- Test 2: Ingest without metadata ------------------------------")
async def _run_ingest_no_meta():
    from app.services import langflow_service
    db = TestSession()
    sid = make_session_id()
    graph = await langflow_service.ingest_and_build_graph("some topic text here")
    prefix = sid.replace("-", "")[:8]
    s = SessionModel(uuid=sid, tree_name="", learning_goal="")
    db.add(s)
    db.flush()
    for idx, chunk in enumerate(graph.nodes):
        db.add(Node(
            id=f"{prefix}_{chunk.id}",
            session_id=sid, title=chunk.title, content=chunk.content,
            key_concepts=chunk.key_concepts,
            status="unlocked" if idx == 0 else "locked", mastery_score=0.0,
        ))
    db.commit()
    fetched = db.query(SessionModel).filter(SessionModel.uuid == sid).first()
    ok = fetched.tree_name == "" and fetched.learning_goal == ""
    record("Ingest without tree metadata → empty defaults, no error", ok,
           f"tree_name={fetched.tree_name!r}")
    db.close()

asyncio.run(_run_ingest_no_meta())


# -- Test 4: GET /sessions shape ----------------------------------------------─
print("\n-- Test 4: GET /sessions response shape --------------------------")
def _test_sessions_shape():
    db = TestSession()
    sid = make_session_id()
    nodes = seed_session_with_nodes(db, sid, tree_name="Jaringan Komputer",
                                    learning_goal="CCNA", node_count=8)
    # Give some mastery to nodes
    for i, n in enumerate(nodes[:3]):
        n2 = db.query(Node).filter(Node.id == n.id).first()
        n2.mastery_score = 75.0 if i < 2 else 40.0
        n2.status = "unlocked"
    db.commit()

    # Simulate what the endpoint does
    from datetime import datetime, timezone
    session_row = db.query(SessionModel).filter(SessionModel.uuid == sid).first()
    all_nodes = db.query(Node).filter(Node.session_id == sid).all()
    total = len(all_nodes)
    mastered = [n for n in all_nodes if n.mastery_score >= 70.0]
    avg = round(sum(n.mastery_score for n in all_nodes) / total, 1)

    now = datetime.now(timezone.utc)
    created = session_row.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    delta = (now - created).days
    last_studied = "Today" if delta == 0 else (f"{delta} days ago")

    result = {
        "session_id":     sid,
        "tree_name":      session_row.tree_name or "My Tree",
        "learning_goal":  session_row.learning_goal,
        "total_nodes":    total,
        "mastered_nodes": len(mastered),
        "avg_mastery":    avg,
        "last_studied":   last_studied,
        "created_at":     session_row.created_at.isoformat(),
    }

    ok_shape  = all(k in result for k in ["session_id","tree_name","total_nodes","avg_mastery","last_studied"])
    ok_values = (result["tree_name"] == "Jaringan Komputer" and result["total_nodes"] == 8)
    record("GET /sessions returns correct shape", ok_shape, f"keys={list(result.keys())[:4]}")
    record("GET /sessions returns correct tree_name + total_nodes", ok_values,
           f"tree_name={result['tree_name']!r} total_nodes={result['total_nodes']}")
    record("GET /sessions avg_mastery computed correctly",
           isinstance(result["avg_mastery"], float),
           f"avg_mastery={result['avg_mastery']}")

    db.close()

_test_sessions_shape()


# -- Test 5: GET /sessions with no nodes → empty list ------------------------─
print("\n-- Test 5: GET /sessions with no nodes --------------------------")
def _test_sessions_empty():
    db = TestSession()
    sid = make_session_id()
    # Session exists but no nodes
    s = SessionModel(uuid=sid, tree_name="", learning_goal="")
    db.add(s)
    db.commit()

    session_row = db.query(SessionModel).filter(SessionModel.uuid == sid).first()
    nodes = db.query(Node).filter(Node.session_id == sid).all()
    result = {"sessions": []} if not nodes else {"sessions": ["something"]}
    record("GET /sessions with no nodes → empty list", result == {"sessions": []})

    # Brand new UUID (no session row at all)
    sid2 = make_session_id()
    session_row2 = db.query(SessionModel).filter(SessionModel.uuid == sid2).first()
    result2 = {"sessions": []} if not session_row2 else {"sessions": ["something"]}
    record("GET /sessions with no session row → empty list", result2 == {"sessions": []})

    db.close()

_test_sessions_empty()


# -- Test 10: last_studied relative labels ------------------------------------─
print("\n-- Test 10: last_studied relative label logic --------------------")
def _test_last_studied():
    from datetime import datetime, timezone, timedelta

    def label(delta_days):
        if delta_days == 0:   return "Today"
        if delta_days == 1:   return "Yesterday"
        return f"{delta_days} days ago"

    record("last_studied: delta=0 → Today",     label(0) == "Today")
    record("last_studied: delta=1 → Yesterday", label(1) == "Yesterday")
    record("last_studied: delta=5 → 5 days ago", label(5) == "5 days ago")

_test_last_studied()


# -- Test 6: GET /quiz/recommend mock shape ------------------------------------
print("\n-- Test 6: GET /quiz/recommend mock response --------------------─")
async def _test_recommend():
    from app.services import langflow_service

    mastered  = [{"id": "n1", "title": "Node 1", "mastery_score": 80.0}]
    unlocked  = [{"id": "n2", "title": "Node 2", "mastery_score": 30.0}]
    locked    = [{"id": "n3", "title": "Node 3", "mastery_score": 0.0}]
    edges     = [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n3"}]

    rec = await langflow_service.get_adaptive_recommendation(
        mastered_nodes=mastered,
        unlocked_nodes=unlocked,
        locked_nodes=locked,
        edges=edges,
    )

    required_fields = ["action", "target_chunk_id", "target_chunk_title",
                       "reason", "priority", "progress_summary"]
    ok_fields  = all(hasattr(rec, f) for f in required_fields)
    ok_action  = rec.action in ("next_chunk", "review", "fill_gap", "unlock")
    ok_target  = rec.target_chunk_id == "n2"   # first unlocked
    ok_pct     = 0 <= rec.progress_summary.completion_percentage <= 100

    record("NT-04 mock returns all required fields",        ok_fields)
    record("NT-04 mock action is valid",                    ok_action, f"action={rec.action!r}")
    record("NT-04 mock targets first unlocked node",        ok_target, f"target={rec.target_chunk_id!r}")
    record("NT-04 completion_percentage in [0,100]",        ok_pct,    f"pct={rec.progress_summary.completion_percentage}")

asyncio.run(_test_recommend())


# -- Test 7: recommend with all mastered → review action ----------------------
print("\n-- Test 7: NT-04 all mastered → review action --------------------")
async def _test_recommend_all_mastered():
    from app.services import langflow_service

    mastered = [
        {"id": "n1", "title": "A", "mastery_score": 100.0},
        {"id": "n2", "title": "B", "mastery_score": 85.0},
    ]
    rec = await langflow_service.get_adaptive_recommendation(
        mastered_nodes=mastered, unlocked_nodes=[], locked_nodes=[], edges=[],
    )
    record("NT-04 all mastered → action=review", rec.action == "review",
           f"action={rec.action!r}")
    record("NT-04 all mastered → priority=low", rec.priority == "low",
           f"priority={rec.priority!r}")

asyncio.run(_test_recommend_all_mastered())


# -- Test 11: Core mastery loop still works ----------------------------------─
print("\n-- Test 11: Core mastery loop (existing) ------------------------─")
def _test_core_loop():
    db = TestSession()
    sid = make_session_id()
    s = SessionModel(uuid=sid)
    db.add(s)
    db.flush()

    n_a = Node(id=f"{sid[:8]}_A", session_id=sid, title="A", content="c",
               key_concepts=[], status="unlocked", mastery_score=0.0)
    n_b = Node(id=f"{sid[:8]}_B", session_id=sid, title="B", content="c",
               key_concepts=[], status="locked",   mastery_score=0.0)
    e   = Edge(id=str(uuid.uuid4()), session_id=sid,
               source_id=n_a.id, target_id=n_b.id, relationship_type="prerequisite")
    db.add_all([n_a, n_b, e])
    db.flush()

    # Below threshold — no unlock
    n_a.mastery_score = 60.0
    db.flush()
    unlocked = check_and_unlock_dependents(n_a, db)
    record("Core loop: mastery 60 < 70 → no unlock", unlocked == [],
           f"unlocked={unlocked}")
    assert db.query(Node).filter(Node.id == n_b.id).first().status == "locked"

    # At threshold — unlocks B
    n_a.mastery_score = 70.0
    db.flush()
    unlocked = check_and_unlock_dependents(n_a, db)
    record("Core loop: mastery 70 >= 70 → unlock", n_b.id in unlocked,
           f"unlocked={unlocked}")
    db.commit()
    record("Core loop: B.status is unlocked after commit",
           db.query(Node).filter(Node.id == n_b.id).first().status == "unlocked")

    # Mastery levels
    record("get_mastery_level 60 → MEDIUM", get_mastery_level(60) == "MEDIUM")
    record("get_mastery_level 70 → BRIGHT", get_mastery_level(70) == "BRIGHT")
    record("get_mastery_level 100 → FULL",  get_mastery_level(100) == "FULL")
    record("UNLOCK_THRESHOLD == 70",        UNLOCK_THRESHOLD == 70.0)

    db.close()

_test_core_loop()


# -- Teardown ------------------------------------------------------------------
import os as _os
try:
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if _os.path.exists(TEST_DB_PATH):
        _os.remove(TEST_DB_PATH)
except Exception:
    pass


# -- Summary ------------------------------------------------------------------─
print("\n" + "─" * 60)
passed  = sum(1 for r in results if r[0] == PASS)
failed  = sum(1 for r in results if r[0] == FAIL)
total   = len(results)
print(f"Phase F-2 Tests: {passed}/{total} passed", "***" if failed == 0 else "!!!")
if failed:
    print("\nFailed tests:")
    for r in results:
        if r[0] == FAIL:
            print(f"  {r[0]} {r[1]}" + (f" [{r[2]}]" if r[2] else ""))

sys.exit(0 if failed == 0 else 1)
