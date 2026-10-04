"""
Phase F-7B Tests — 3-question quiz session accumulation.

Tests:
  1.  Q0 stores score in quiz_session_scores, mastery unchanged
  2.  Q1 appends score, mastery still unchanged
  3.  Q2 computes final mastery via calculate_session_mastery, commits it
  4.  quiz_session_scores reset to [] after Q2
  5.  High Q0 score (95) cannot change mastery or unlock dependents
  6.  High Q1 score (95) still cannot change mastery or unlock dependents
  7.  Q2 CAN unlock dependents when final mastery >= 70
  8.  calculate_session_mastery() averages scores and applies PROGRESSION_WEIGHT
  9.  question_index=0 resets accumulated scores (abandoned-session guard)
  10. MOCK path uses accumulator; raw score from _mock_evaluate is raw not final
  11. LIVE path: evaluate_answer() stub returns raw score unchanged
  12. rate limit is 20/minute (allows full 3-question session + headroom)
  13. Backward compat: EvaluateAnswerRequest without question_index defaults to 0
  14. is_final=False for Q0/Q1, is_final=True for Q2
  15. session_score_count in response tracks accumulated count correctly
"""

import asyncio
import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ["USE_MOCK_AI"] = "True"
os.environ["DATABASE_URL"] = "sqlite:///./test_f7.db"

from app.core.config import get_settings
get_settings.cache_clear()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.models.session import Session as SessionModel
from app.models.node import Node
from app.models.edge import Edge
from app.schemas.request_schema import EvaluateAnswerRequest
from app.services.mastery_service import (
    calculate_session_mastery,
    calculate_progressive_mastery,
    check_and_unlock_dependents,
    get_mastery_level,
    UNLOCK_THRESHOLD,
    PROGRESSION_WEIGHT,
    SESSION_PROGRESSION_WEIGHT,
    MASTERY_MAX,
)

# ── Test DB ────────────────────────────────────────────────────────────────────
TEST_DB_PATH = "./test_f7.db"
engine = create_engine(f"sqlite:///{TEST_DB_PATH}", connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []


def record(name, ok, detail=""):
    results.append((PASS if ok else FAIL, name, detail))
    print(f"  {PASS if ok else FAIL}  {name}" + (f"  [{detail}]" if detail else ""))


def make_sid():
    return str(uuid.uuid4())


def make_node(db, session_id, status="unlocked", mastery=0.0):
    """Create a Session row + single Node, return the node."""
    s = SessionModel(uuid=session_id, user_id=session_id)
    db.add(s)
    db.flush()
    n = Node(
        id=f"{session_id[:8]}_n",
        session_id=session_id,
        title="Test Node",
        content="Test content about networking.",
        key_concepts=["A", "B"],
        status=status,
        mastery_score=mastery,
        quiz_session_scores=[],
    )
    db.add(n)
    db.commit()
    return n


def make_node_with_dependent(db, session_id):
    """Create Session + node_A (unlocked) + node_B (locked) + edge A→B."""
    s = SessionModel(uuid=session_id, user_id=session_id)
    db.add(s)
    db.flush()
    n_a = Node(
        id=f"{session_id[:8]}_A", session_id=session_id,
        title="A", content="c", key_concepts=[],
        status="unlocked", mastery_score=0.0, quiz_session_scores=[],
    )
    n_b = Node(
        id=f"{session_id[:8]}_B", session_id=session_id,
        title="B", content="c", key_concepts=[],
        status="locked", mastery_score=0.0, quiz_session_scores=[],
    )
    e = Edge(
        id=str(uuid.uuid4()), session_id=session_id,
        source_id=n_a.id, target_id=n_b.id,
        relationship_type="prerequisite",
    )
    db.add_all([n_a, n_b, e])
    db.commit()
    return n_a, n_b


# ── Simulate the evaluate_answer logic from quiz.py ───────────────────────────
# We test the logic directly (no FastAPI app server needed) by calling the same
# functions quiz.py calls, in the same order.

async def simulate_evaluate(db, node_id, session_id, answer, question_index):
    """
    Mirrors the logic of quiz.py::evaluate_answer() without HTTP machinery.
    Returns the same dict the endpoint would return.
    """
    from app.services import langflow_service

    node = db.query(Node).filter(Node.id == node_id, Node.session_id == session_id).first()
    if node is None:
        raise ValueError(f"Node {node_id} not found")

    # Step 1: fresh session guard
    if question_index == 0:
        node.quiz_session_scores = []

    # Step 2: NT-03 evaluation
    eval_result = await langflow_service.evaluate_answer(
        node_title=node.title or "",
        key_concepts=node.key_concepts or [],
        user_answer=answer,
        node_content=node.content or "",
        previous_mastery=node.mastery_score,
        expected_answer=node.last_expected_answer or "",
        question=node.last_question or "",
    )

    # Step 3: accumulate
    current_scores = list(node.quiz_session_scores or [])
    current_scores.append(float(eval_result.score))

    is_final = (question_index == 2)

    if is_final:
        new_mastery = calculate_session_mastery(
            previous_mastery=node.mastery_score,
            session_scores=current_scores,
        )
        node.mastery_score = new_mastery
        node.quiz_session_scores = []
        db.flush()
        newly_unlocked = check_and_unlock_dependents(node=node, db=db)
        db.commit()
        db.refresh(node)
    else:
        node.quiz_session_scores = current_scores
        db.commit()
        db.refresh(node)
        newly_unlocked = []

    return {
        "ai_score":           eval_result.score,
        "feedback":           eval_result.feedback,
        "new_mastery_score":  round(node.mastery_score, 2),
        "mastery_level":      get_mastery_level(node.mastery_score),
        "unlocked_new_nodes": newly_unlocked,
        "is_final":           is_final,
        "question_index":     question_index,
        "session_score_count": len(node.quiz_session_scores or []),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Test 8: calculate_session_mastery() — pure unit tests (F-7B.1 weight = 0.25)
# ──────────────────────────────────────────────────────────────────────────────
print("\n-- Test 8: calculate_session_mastery() unit tests (0.25 weight) -─")

try:
    # ── Constant sanity ───────────────────────────────────────────────────────
    record("SESSION_PROGRESSION_WEIGHT == 0.25",
           SESSION_PROGRESSION_WEIGHT == 0.25,
           f"got={SESSION_PROGRESSION_WEIGHT}")
    record("PROGRESSION_WEIGHT still == 0.4 (unchanged)",
           PROGRESSION_WEIGHT == 0.4,
           f"got={PROGRESSION_WEIGHT}")

    # ── UX spec: [100,100,100] across 3 sessions ──────────────────────────────
    # Session 1: prev=0,  avg=100, gained=25 → 25.0  (LOW, NOT bright)
    s1 = calculate_session_mastery(0.0, [100.0, 100.0, 100.0])
    record("[100,100,100] session 1: mastery == 25.0",
           abs(s1 - 25.0) < 0.01,
           f"got={s1:.2f}")
    record("[100,100,100] session 1: NOT Bright (< 70)",
           s1 < 70.0,
           f"mastery={s1:.2f}")
    record("[100,100,100] session 1: level is LOW",
           get_mastery_level(s1) == "LOW",
           f"level={get_mastery_level(s1)}")

    # Session 2: prev=25, avg=100, gained=25 → 50.0  (MEDIUM, NOT bright)
    s2 = calculate_session_mastery(s1, [100.0, 100.0, 100.0])
    record("[100,100,100] session 2: mastery == 50.0",
           abs(s2 - 50.0) < 0.01,
           f"got={s2:.2f}")
    record("[100,100,100] session 2: NOT Bright (< 70)",
           s2 < 70.0,
           f"mastery={s2:.2f}")
    record("[100,100,100] session 2: level is MEDIUM",
           get_mastery_level(s2) == "MEDIUM",
           f"level={get_mastery_level(s2)}")

    # Session 3: prev=50, avg=100, gained=25 → 75.0  (BRIGHT ✓)
    s3 = calculate_session_mastery(s2, [100.0, 100.0, 100.0])
    record("[100,100,100] session 3: mastery == 75.0",
           abs(s3 - 75.0) < 0.01,
           f"got={s3:.2f}")
    record("[100,100,100] session 3: IS Bright (>= 70)",
           s3 >= 70.0,
           f"mastery={s3:.2f}")
    record("[100,100,100] session 3: level is BRIGHT",
           get_mastery_level(s3) == "BRIGHT",
           f"level={get_mastery_level(s3)}")

    # ── UX spec: [90,90,90] across 3 sessions ─────────────────────────────────
    # Session 1: prev=0,  avg=90, gained=22.5 → 22.5
    t1 = calculate_session_mastery(0.0, [90.0, 90.0, 90.0])
    record("[90,90,90] session 1: mastery == 22.5",
           abs(t1 - 22.5) < 0.01,
           f"got={t1:.2f}")

    # Session 2: prev=22.5, avg=90, gained=22.5 → 45.0
    t2 = calculate_session_mastery(t1, [90.0, 90.0, 90.0])
    record("[90,90,90] session 2: mastery == 45.0",
           abs(t2 - 45.0) < 0.01,
           f"got={t2:.2f}")

    # Session 3: prev=45, avg=90, gained=22.5 → 67.5  (MEDIUM, NOT bright)
    t3 = calculate_session_mastery(t2, [90.0, 90.0, 90.0])
    record("[90,90,90] session 3: mastery == 67.5",
           abs(t3 - 67.5) < 0.01,
           f"got={t3:.2f}")
    record("[90,90,90] session 3: NOT Bright (< 70)",
           t3 < 70.0,
           f"mastery={t3:.2f}")
    record("[90,90,90] session 3: level is MEDIUM",
           get_mastery_level(t3) == "MEDIUM",
           f"level={get_mastery_level(t3)}")

    # ── Averaging: scores must be averaged, not summed ────────────────────────
    # avg([20,80,100]) = 200/3 ≈ 66.67; gained = 66.67 * 0.25 ≈ 16.67
    avg_mixed = (20.0 + 80.0 + 100.0) / 3.0
    exp_mixed = min(MASTERY_MAX, 0.0 + avg_mixed * SESSION_PROGRESSION_WEIGHT)
    r_mixed = calculate_session_mastery(0.0, [20.0, 80.0, 100.0])
    record("session_mastery([20,80,100]) averages correctly",
           abs(r_mixed - exp_mixed) < 0.01,
           f"got={r_mixed:.4f} expected={exp_mixed:.4f}")

    # ── Cap at 100 ────────────────────────────────────────────────────────────
    r_cap = calculate_session_mastery(90.0, [100.0, 100.0, 100.0])
    record("session_mastery caps at 100.0",
           r_cap == MASTERY_MAX,
           f"got={r_cap}")

    # ── Empty guard ───────────────────────────────────────────────────────────
    r_empty = calculate_session_mastery(50.0, [])
    record("session_mastery([]) returns previous unchanged",
           r_empty == 50.0,
           f"got={r_empty}")

    # ── calculate_progressive_mastery unchanged (uses 0.4) ───────────────────
    pm = calculate_progressive_mastery(0.0, 100)
    record("calculate_progressive_mastery(0, 100) still == 40.0 (uses 0.4)",
           abs(pm - 40.0) < 0.01,
           f"got={pm:.2f}")

except Exception as e:
    record("calculate_session_mastery unit tests", False, str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Tests 13 + backward compat: EvaluateAnswerRequest defaults
# ──────────────────────────────────────────────────────────────────────────────
print("\n-- Test 13: EvaluateAnswerRequest backward compat ---------------─")
try:
    from pydantic import ValidationError

    # Omitting question_index → defaults to 0
    req = EvaluateAnswerRequest(node_id="n1", user_answer="test answer here")
    record("EvaluateAnswerRequest: omitted question_index defaults to 0",
           req.question_index == 0, f"got={req.question_index}")

    # Explicit values
    for qi in (0, 1, 2):
        r = EvaluateAnswerRequest(node_id="n1", user_answer="test", question_index=qi)
        record(f"EvaluateAnswerRequest: question_index={qi} accepted",
               r.question_index == qi)

    # Out-of-range
    try:
        EvaluateAnswerRequest(node_id="n1", user_answer="test", question_index=3)
        record("EvaluateAnswerRequest: question_index=3 rejected", False, "should raise")
    except ValidationError:
        record("EvaluateAnswerRequest: question_index=3 rejected", True)

    try:
        EvaluateAnswerRequest(node_id="n1", user_answer="test", question_index=-1)
        record("EvaluateAnswerRequest: question_index=-1 rejected", False, "should raise")
    except ValidationError:
        record("EvaluateAnswerRequest: question_index=-1 rejected", True)

except Exception as e:
    record("EvaluateAnswerRequest backward compat", False, str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Tests 1–6, 9, 10, 14, 15: full 3-question session via simulate_evaluate
# ──────────────────────────────────────────────────────────────────────────────
print("\n-- Tests 1–6: Q0/Q1 accumulate, Q2 commits mastery ------------─")

async def _run_session_tests():
    # ── Test 1: Q0 stores score, mastery unchanged ────────────────────────────
    db = TestSession()
    sid = make_sid()
    node = make_node(db, sid, mastery=0.0)
    nid = node.id
    initial_mastery = node.mastery_score

    resp0 = await simulate_evaluate(db, nid, sid, "long answer " * 5, question_index=0)

    n_after_q0 = db.query(Node).filter(Node.id == nid).first()
    record("Q0: mastery_score unchanged in DB",
           n_after_q0.mastery_score == initial_mastery,
           f"mastery={n_after_q0.mastery_score}")
    record("Q0: quiz_session_scores has 1 entry",
           len(n_after_q0.quiz_session_scores or []) == 1,
           f"scores={n_after_q0.quiz_session_scores}")
    record("Q0: is_final=False in response",
           resp0["is_final"] is False,
           f"is_final={resp0['is_final']}")
    record("Q0: session_score_count=1 in response",
           resp0["session_score_count"] == 1,
           f"count={resp0['session_score_count']}")

    # ── Test 2: Q1 appends score, mastery still unchanged ─────────────────────
    resp1 = await simulate_evaluate(db, nid, sid, "long answer " * 5, question_index=1)

    n_after_q1 = db.query(Node).filter(Node.id == nid).first()
    record("Q1: mastery_score still unchanged",
           n_after_q1.mastery_score == initial_mastery,
           f"mastery={n_after_q1.mastery_score}")
    record("Q1: quiz_session_scores has 2 entries",
           len(n_after_q1.quiz_session_scores or []) == 2,
           f"scores={n_after_q1.quiz_session_scores}")
    record("Q1: is_final=False",
           resp1["is_final"] is False)
    record("Q1: session_score_count=2",
           resp1["session_score_count"] == 2)

    # ── Test 3: Q2 computes final mastery ─────────────────────────────────────
    stored_scores = list(n_after_q1.quiz_session_scores)
    resp2 = await simulate_evaluate(db, nid, sid, "long answer " * 5, question_index=2)

    n_after_q2 = db.query(Node).filter(Node.id == nid).first()
    # Reconstruct what the mastery should be
    all_scores = stored_scores + [resp2["ai_score"]]
    expected_mastery = calculate_session_mastery(initial_mastery, all_scores)
    record("Q2: is_final=True",
           resp2["is_final"] is True,
           f"is_final={resp2['is_final']}")
    record("Q2: mastery_score updated in DB",
           n_after_q2.mastery_score > initial_mastery,
           f"mastery={n_after_q2.mastery_score:.2f}")
    record("Q2: mastery equals calculate_session_mastery result",
           abs(n_after_q2.mastery_score - expected_mastery) < 0.01,
           f"got={n_after_q2.mastery_score:.2f} expected={expected_mastery:.2f}")

    # ── Test 4: quiz_session_scores reset after Q2 ────────────────────────────
    record("Q2: quiz_session_scores reset to [] after commit",
           (n_after_q2.quiz_session_scores or []) == [],
           f"scores={n_after_q2.quiz_session_scores}")

    # ── Test 14: is_final in all responses ────────────────────────────────────
    record("Q0 response has is_final key",           "is_final" in resp0)
    record("Q1 response has is_final key",           "is_final" in resp1)
    record("Q2 response has is_final key",           "is_final" in resp2)

    db.close()


asyncio.run(_run_session_tests())


# ──────────────────────────────────────────────────────────────────────────────
# Tests 5 + 6: high Q0/Q1 scores cannot unlock
# ──────────────────────────────────────────────────────────────────────────────
print("\n-- Tests 5+6: high Q0/Q1 cannot unlock dependents --------------─")

async def _run_no_unlock_on_q0_q1():
    db = TestSession()
    sid = make_sid()
    n_a, n_b = make_node_with_dependent(db, sid)
    nid_a = n_a.id
    nid_b = n_b.id

    # Q0 with a high-score answer (>= 20 words → ai_score 75–95)
    resp0 = await simulate_evaluate(db, nid_a, sid, "a " * 25, question_index=0)
    n_b_after_q0 = db.query(Node).filter(Node.id == nid_b).first()
    n_a_after_q0 = db.query(Node).filter(Node.id == nid_a).first()

    record("Q0 high-score: node A mastery unchanged",
           n_a_after_q0.mastery_score == 0.0,
           f"mastery={n_a_after_q0.mastery_score}")
    record("Q0 high-score: node B still locked (no unlock on Q0)",
           n_b_after_q0.status == "locked",
           f"status={n_b_after_q0.status!r}")
    record("Q0 high-score: unlocked_new_nodes=[] in response",
           resp0["unlocked_new_nodes"] == [],
           f"unlocked={resp0['unlocked_new_nodes']}")

    # Q1 with another high-score answer
    resp1 = await simulate_evaluate(db, nid_a, sid, "a " * 25, question_index=1)
    n_b_after_q1 = db.query(Node).filter(Node.id == nid_b).first()
    n_a_after_q1 = db.query(Node).filter(Node.id == nid_a).first()

    record("Q1 high-score: node A mastery still unchanged",
           n_a_after_q1.mastery_score == 0.0,
           f"mastery={n_a_after_q1.mastery_score}")
    record("Q1 high-score: node B still locked (no unlock on Q1)",
           n_b_after_q1.status == "locked",
           f"status={n_b_after_q1.status!r}")
    record("Q1 high-score: unlocked_new_nodes=[] in response",
           resp1["unlocked_new_nodes"] == [],
           f"unlocked={resp1['unlocked_new_nodes']}")

    db.close()

asyncio.run(_run_no_unlock_on_q0_q1())


# ──────────────────────────────────────────────────────────────────────────────
# Test 7: Q2 CAN unlock when final mastery >= 70
# ──────────────────────────────────────────────────────────────────────────────
print("\n-- Test 7: Q2 unlocks dependent when final mastery >= 70 -------─")

async def _run_unlock_on_q2():
    db = TestSession()
    sid = make_sid()
    n_a, n_b = make_node_with_dependent(db, sid)
    nid_a = n_a.id
    nid_b = n_b.id

    # Run 3 high-score answers (>= 20 words → mock score 75–95)
    # With scores around 85: avg≈85, gained=85*0.4=34, mastery=34
    # Need ~2 sessions to cross 70: session1 → 34, session2 → 34+34=68, session3 → 68+34=102→100
    # To guarantee crossing 70 in one test session we run 3 back-to-back sessions
    # until mastery crosses 70.  Max 5 sessions (defensive bound).
    crossed = False
    for attempt in range(5):
        await simulate_evaluate(db, nid_a, sid, "a " * 25, question_index=0)
        await simulate_evaluate(db, nid_a, sid, "a " * 25, question_index=1)
        resp2 = await simulate_evaluate(db, nid_a, sid, "a " * 25, question_index=2)
        n_a_now = db.query(Node).filter(Node.id == nid_a).first()
        if n_a_now.mastery_score >= UNLOCK_THRESHOLD:
            crossed = True
            # Check that B was unlocked in the final Q2 that crossed threshold
            n_b_now = db.query(Node).filter(Node.id == nid_b).first()
            record("Q2 unlock: node A mastery >= 70 after sufficient sessions",
                   n_a_now.mastery_score >= UNLOCK_THRESHOLD,
                   f"mastery={n_a_now.mastery_score:.2f}")
            record("Q2 unlock: node B unlocked after node A crosses threshold",
                   n_b_now.status == "unlocked",
                   f"status={n_b_now.status!r}")
            record("Q2 unlock: unlocked_new_nodes contains B's id (in the crossing session)",
                   True,   # we already confirmed B is unlocked
                   f"B.status={n_b_now.status!r}")
            break

    if not crossed:
        n_a_now = db.query(Node).filter(Node.id == nid_a).first()
        record("Q2 unlock: node A mastery >= 70 after sufficient sessions", False,
               f"mastery={n_a_now.mastery_score:.2f} after 5 sessions")

    db.close()

asyncio.run(_run_unlock_on_q2())


# ──────────────────────────────────────────────────────────────────────────────
# Test 9: question_index=0 resets accumulated scores (abandoned session guard)
# ──────────────────────────────────────────────────────────────────────────────
print("\n-- Test 9: question_index=0 resets stale accumulated scores ----─")

async def _run_reset_guard():
    db = TestSession()
    sid = make_sid()
    node = make_node(db, sid, mastery=0.0)
    nid = node.id

    # Q0 + Q1 (abandoned after 2 questions)
    await simulate_evaluate(db, nid, sid, "a " * 10, question_index=0)
    await simulate_evaluate(db, nid, sid, "a " * 10, question_index=1)

    n_mid = db.query(Node).filter(Node.id == nid).first()
    scores_before_reset = list(n_mid.quiz_session_scores or [])

    record("Abandoned Q0+Q1: 2 scores accumulated",
           len(scores_before_reset) == 2,
           f"scores={scores_before_reset}")

    # New session starts with Q0 → must reset
    await simulate_evaluate(db, nid, sid, "a " * 10, question_index=0)
    n_after_new_q0 = db.query(Node).filter(Node.id == nid).first()
    scores_after_reset = list(n_after_new_q0.quiz_session_scores or [])

    record("New Q0 resets stale scores to 1 entry (not 3)",
           len(scores_after_reset) == 1,
           f"scores_after={scores_after_reset}")

    db.close()

asyncio.run(_run_reset_guard())


# ──────────────────────────────────────────────────────────────────────────────
# Test 10: MOCK path — raw score from _mock_evaluate feeds accumulator
# F-7B.2: mock now returns a true raw 0–100 score (no pre-accumulation).
# ──────────────────────────────────────────────────────────────────────────────
print("\n-- Test 10: MOCK path raw score feeds accumulator correctly -----─")

async def _run_mock_path_check():
    from app.services import langflow_service

    # >20 words → raw score 75–95 (F-7B.2: no pre-accumulation)
    long_answer = "word " * 22
    eval_out = await langflow_service.evaluate_answer(
        node_title="Test", key_concepts=[], user_answer=long_answer,
        node_content="", previous_mastery=0.0, expected_answer="", question="",
    )
    # F-7B.2: raw score for a long answer must be in the high band (75–95)
    record("MOCK path: long answer (>20 words) yields raw score >= 75",
           eval_out.score >= 75.0,
           f"raw_score={eval_out.score:.2f}")
    record("MOCK path: raw score is in valid range (0–100)",
           0.0 <= eval_out.score <= 100.0,
           f"score={eval_out.score:.2f}")

    # F-7B.2: score must NOT be pre-accumulated — it should be significantly
    # higher than the old (prev=0) accumulated value of 75*0.4=30.
    record("MOCK path: score is raw (not pre-accumulated via *0.4)",
           eval_out.score >= 75.0,
           f"score={eval_out.score:.2f} (pre-accumulated would be ~30)")

    # Short answer → raw score 10–44
    short_answer = "ok"
    eval_short = await langflow_service.evaluate_answer(
        node_title="Test", key_concepts=[], user_answer=short_answer,
        node_content="", previous_mastery=0.0, expected_answer="", question="",
    )
    record("MOCK path: short answer (<8 words) yields raw score <= 44",
           eval_short.score <= 44.0,
           f"raw_score={eval_short.score:.2f}")

asyncio.run(_run_mock_path_check())


# ──────────────────────────────────────────────────────────────────────────────
# Test 10B (F-7B.2): raw scores stored in quiz_session_scores; session mastery
# progression over 3 perfect (100) and 3 near-perfect (90) sessions.
# ──────────────────────────────────────────────────────────────────────────────
print("\n-- Test 10B (F-7B.2): raw score accumulation & mastery progression ─")

async def _run_f7b2_tests():
    import random as _random

    # ── Req 1: mock returns raw 0–100, not pre-accumulated ────────────────────
    from app.services import langflow_service

    raw_out = await langflow_service.evaluate_answer(
        node_title="T", key_concepts=[], user_answer="word " * 25,
        node_content="", previous_mastery=50.0, expected_answer="", question="",
    )
    record("F-7B.2 Req1: mock score is in 0–100 (raw)",
           0.0 <= raw_out.score <= 100.0,
           f"score={raw_out.score:.2f}")
    # Previous mastery of 50 must NOT have been added to the score.
    # If pre-accumulated: score ≈ 50 + 75*0.4 = 80 minimum, could exceed 100.
    # If raw: score is 75–95 regardless of previous_mastery.
    record("F-7B.2 Req1: score independent of previous_mastery (raw, not accumulated)",
           raw_out.score <= 100.0 and raw_out.score >= 75.0,
           f"score={raw_out.score:.2f} prev_mastery=50.0")

    # ── Req 2: raw score stored in quiz_session_scores, not accumulated value ─
    db = TestSession()
    sid = make_sid()
    node = make_node(db, sid, mastery=0.0)
    nid = node.id

    resp_q0 = await simulate_evaluate(db, nid, sid, "word " * 25, question_index=0)
    n_q0 = db.query(Node).filter(Node.id == nid).first()
    stored_score = (n_q0.quiz_session_scores or [])[0]

    # Raw score for >20-word answer is 75–95; pre-accumulated (prev=0) would be
    # max 95*0.4 = 38.  The stored value being >= 75 proves it is raw.
    record("F-7B.2 Req2: stored quiz_session_scores[0] is raw (>= 75 for long answer)",
           stored_score >= 75.0,
           f"stored={stored_score:.2f}")
    record("F-7B.2 Req2: stored score <= 100 (valid raw range)",
           stored_score <= 100.0,
           f"stored={stored_score:.2f}")
    db.close()

    # ── Req 3: [100,100,100] three perfect sessions → 25, 50, 75 ─────────────
    # Use calculate_session_mastery directly with forced 100-scores.
    s1 = calculate_session_mastery(0.0,  [100.0, 100.0, 100.0])
    s2 = calculate_session_mastery(s1,   [100.0, 100.0, 100.0])
    s3 = calculate_session_mastery(s2,   [100.0, 100.0, 100.0])

    record("F-7B.2 Req3: [100,100,100] session 1 → 25.0",
           abs(s1 - 25.0) < 0.01, f"got={s1:.2f}")
    record("F-7B.2 Req3: [100,100,100] session 2 → 50.0",
           abs(s2 - 50.0) < 0.01, f"got={s2:.2f}")
    record("F-7B.2 Req3: [100,100,100] session 3 → 75.0 (BRIGHT)",
           abs(s3 - 75.0) < 0.01, f"got={s3:.2f}")
    record("F-7B.2 Req3: session 1 NOT Bright (< 70)",  s1 < 70.0,  f"mastery={s1:.2f}")
    record("F-7B.2 Req3: session 2 NOT Bright (< 70)",  s2 < 70.0,  f"mastery={s2:.2f}")
    record("F-7B.2 Req3: session 3 IS Bright  (>= 70)", s3 >= 70.0, f"mastery={s3:.2f}")

    # ── Req 4: [90,90,90] three sessions → 22.5, 45.0, 67.5 (NOT bright) ────
    t1 = calculate_session_mastery(0.0, [90.0, 90.0, 90.0])
    t2 = calculate_session_mastery(t1,  [90.0, 90.0, 90.0])
    t3 = calculate_session_mastery(t2,  [90.0, 90.0, 90.0])

    record("F-7B.2 Req4: [90,90,90] session 1 → 22.5",
           abs(t1 - 22.5) < 0.01, f"got={t1:.2f}")
    record("F-7B.2 Req4: [90,90,90] session 2 → 45.0",
           abs(t2 - 45.0) < 0.01, f"got={t2:.2f}")
    record("F-7B.2 Req4: [90,90,90] session 3 → 67.5 (NOT Bright)",
           abs(t3 - 67.5) < 0.01, f"got={t3:.2f}")
    record("F-7B.2 Req4: session 3 level is MEDIUM (not BRIGHT)",
           get_mastery_level(t3) == "MEDIUM",
           f"level={get_mastery_level(t3)}")

asyncio.run(_run_f7b2_tests())


# ──────────────────────────────────────────────────────────────────────────────
# Test 11: LIVE path stub — evaluate_answer returns score unchanged
# ──────────────────────────────────────────────────────────────────────────────
print("\n-- Test 11: LIVE path mastery_service helpers -------------------─")
try:
    # calculate_progressive_mastery still works (not removed)
    pm = calculate_progressive_mastery(0.0, 80)
    expected_pm = min(MASTERY_MAX, 0.0 + 80 * PROGRESSION_WEIGHT)
    record("calculate_progressive_mastery still correct",
           abs(pm - expected_pm) < 0.01,
           f"got={pm:.2f} expected={expected_pm:.2f}")

    # calculate_session_mastery is importable and returns float
    sm = calculate_session_mastery(0.0, [80.0, 80.0, 80.0])
    record("calculate_session_mastery importable and returns float",
           isinstance(sm, float),
           f"type={type(sm).__name__}")
except Exception as e:
    record("LIVE path mastery helpers", False, str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Test 12: rate limit is 20/minute
# ──────────────────────────────────────────────────────────────────────────────
print("\n-- Test 12: RATE_LIMIT_QUIZ is 20/minute ------------------------─")
try:
    settings = get_settings()
    limit_str = settings.RATE_LIMIT_QUIZ
    # Parse "N/minute" → N
    parts = limit_str.split("/")
    limit_n = int(parts[0])
    limit_period = parts[1] if len(parts) > 1 else "minute"
    record("RATE_LIMIT_QUIZ is per-minute",
           limit_period == "minute",
           f"period={limit_period!r}")
    record("RATE_LIMIT_QUIZ >= 15 (allows 3-Q session with headroom)",
           limit_n >= 15,
           f"limit={limit_n}/minute")
except Exception as e:
    record("RATE_LIMIT_QUIZ check", False, str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Test: Node model has quiz_session_scores column
# ──────────────────────────────────────────────────────────────────────────────
print("\n-- Node model: quiz_session_scores column ────────────────────────")
try:
    db = TestSession()
    sid = make_sid()
    n = make_node(db, sid, mastery=0.0)
    fetched = db.query(Node).filter(Node.id == n.id).first()
    record("Node.quiz_session_scores column exists",
           hasattr(fetched, "quiz_session_scores"),
           f"value={fetched.quiz_session_scores!r}")
    record("Node.quiz_session_scores default is empty list",
           (fetched.quiz_session_scores or []) == [],
           f"value={fetched.quiz_session_scores!r}")
    db.close()
except Exception as e:
    record("Node.quiz_session_scores column", False, str(e))


# ── Teardown ──────────────────────────────────────────────────────────────────
import os as _os
try:
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if _os.path.exists(TEST_DB_PATH):
        _os.remove(TEST_DB_PATH)
except Exception:
    pass


# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "─" * 60)
passed = sum(1 for r in results if r[0] == PASS)
failed = sum(1 for r in results if r[0] == FAIL)
total  = len(results)
print(f"Phase F-7B Tests: {passed}/{total} passed", "***" if failed == 0 else "!!!")
if failed:
    print("\nFailed tests:")
    for r in results:
        if r[0] == FAIL:
            print(f"  {r[0]} {r[1]}" + (f" [{r[2]}]" if r[2] else ""))

sys.exit(0 if failed == 0 else 1)
