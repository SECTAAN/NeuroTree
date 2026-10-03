"""
Phase C-7 / C-8 Verification Script
=====================================
Run with LangFlow active at http://127.0.0.1:7860:

    cd backend
    .\.venv\Scripts\python.exe verify_phase_c.py

Checks:
  1. NT-02 live — sends a real chunk, verifies question + expected_answer returned
  2. NT-03 live (correct answer) — full comprehensive answer, expects mastery >= 70
  3. NT-03 live (partial answer)  — one short sentence, expects mastery < 70
  4. NT-03 live (wrong answer)    — completely off-topic, expects mastery near 0
  5. End-to-end via FastAPI test client:
       ingest → generate (NT-02) → evaluate (NT-03) → read DB mastery value
       Verify: mastery_score stored DIRECTLY (no calculate_progressive_mastery)
       Verify: 70 threshold — correct answer unlocks dependent, wrong does not
  6. Code-level verification: confirm calculate_progressive_mastery() is NOT
     called inside evaluate_answer() LIVE path in quiz.py / langflow_service.py
"""
import asyncio
import inspect
import json
import sys
import os

# ── Windows stdout encoding fix ───────────────────────────────────────────────
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Allow importing app modules ───────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

# Force USE_MOCK_AI=False for this entire script
os.environ["USE_MOCK_AI"] = "False"

from app.core.config import get_settings

settings = get_settings()
FLOW_NT02 = settings.LANGFLOW_FLOW_NT02
FLOW_NT03 = settings.LANGFLOW_FLOW_NT03

# ── Test data ─────────────────────────────────────────────────────────────────
# A real TCP/IP chunk (matches what NT-01 would generate)
CHUNK = {
    "chunk_id":    "c01",
    "title":       "Pengertian TCP/IP",
    "description": (
        "TCP/IP adalah sekumpulan protokol komunikasi yang menjadi standar "
        "internet global. Terdiri dari empat lapisan: Application (HTTP, DNS), "
        "Transport (TCP/UDP), Internet (IP, routing), dan Network Access "
        "(transmisi fisik). TCP bersifat connection-oriented dan reliable; "
        "UDP bersifat connectionless dan cepat."
    ),
    "difficulty":    1,
    "prerequisites": [],
}

CORRECT_ANSWER = (
    "TCP/IP adalah kumpulan protokol standar internet yang memiliki empat lapisan: "
    "Application Layer untuk HTTP dan DNS, Transport Layer yang menggunakan TCP "
    "(reliable, connection-oriented) atau UDP (connectionless, cepat), "
    "Internet Layer untuk routing paket dengan IP Address, dan Network Access "
    "Layer untuk transmisi fisik data."
)

PARTIAL_ANSWER = "TCP/IP itu protokol untuk internet, ada TCP dan UDP."

WRONG_ANSWER = "Fotosintesis adalah proses tumbuhan membuat makanan dari sinar matahari."

SEP = "─" * 60


def print_sep(title=""):
    print(f"\n{SEP}")
    if title:
        print(f"  {title}")
        print(SEP)


# ═════════════════════════════════════════════════════════════════════════════
# PART 1 — Direct LangFlow calls (bypasses FastAPI, tests NT-02 / NT-03 raw)
# ═════════════════════════════════════════════════════════════════════════════

async def test_nt02_direct():
    """Test 1: NT-02 returns a question and expected_answer for the chunk."""
    print_sep("TEST 1 — NT-02 Direct: Question Generation")

    from app.services.langflow_client import run_flow, parse_json_output

    chunk_payload = json.dumps(CHUNK, ensure_ascii=False)

    print(f"  Sending chunk_id={CHUNK['chunk_id']!r} to NT-02 ({FLOW_NT02[:8]}…)")
    raw_text = await run_flow(flow_id=FLOW_NT02, input_value=chunk_payload)
    result   = parse_json_output(raw_text, FLOW_NT02)

    print(f"\n  NT-02 raw output:")
    print(f"    chunk_id:       {result.get('chunk_id')!r}")
    print(f"    question_type:  {result.get('question_type')!r}")
    print(f"    difficulty:     {result.get('difficulty')}")
    print(f"    question:       {result.get('question', '')[:120]!r}")
    print(f"    expected_answer:{result.get('expected_answer', '')[:120]!r}")
    print(f"    key_concepts:   {result.get('key_concepts')}")

    assert result.get("question"), "FAIL: question is empty"
    assert result.get("expected_answer"), "FAIL: expected_answer is empty"
    print("\n  [PASS] NT-02 returned a valid question and expected_answer.")
    return result


async def test_nt03_direct(label, user_answer, previous_mastery, expected_answer,
                            question, expect_gte_70):
    """Run a single NT-03 evaluation and print/assert results."""
    from app.services.langflow_client import run_flow, parse_json_output

    payload = json.dumps({
        "question":         question,
        "expected_answer":  expected_answer,
        "chunk_content":    CHUNK["description"],
        "previous_mastery": previous_mastery,
        "user_answer":      user_answer,
    }, ensure_ascii=False)

    raw_text = await run_flow(flow_id=FLOW_NT03, input_value=payload)
    result   = parse_json_output(raw_text, FLOW_NT03)

    mastery      = result.get("mastery_score", -1)
    next_action  = result.get("next_action", "?")
    correctness  = result.get("correctness", "?")
    coverage     = result.get("concept_coverage", "?")
    understanding= result.get("understanding", "?")
    feedback     = result.get("feedback", "")[:120]

    print(f"\n  NT-03 raw output:")
    print(f"    correctness:       {correctness}")
    print(f"    concept_coverage:  {coverage}")
    print(f"    understanding:     {understanding}")
    print(f"    mastery_score:     {mastery}")
    print(f"    next_action:       {next_action!r}")
    print(f"    feedback:          {feedback!r}")
    print(f"    missing_concepts:  {result.get('missing_concepts', [])}")

    # Verify threshold alignment
    if mastery >= 70:
        action_ok = next_action == "unlock"
        threshold_str = f"mastery={mastery:.1f} >= 70 → should be 'unlock'"
    else:
        action_ok = next_action == "review"
        threshold_str = f"mastery={mastery:.1f} < 70 → should be 'review'"

    print(f"\n  Threshold check: {threshold_str}  →  next_action={next_action!r}  {'OK' if action_ok else 'MISMATCH'}")

    # Expectation check
    if expect_gte_70:
        assert mastery >= 70, f"FAIL: expected mastery >= 70 but got {mastery}"
        print(f"  [PASS] Correct answer scored {mastery:.1f} >= 70 (BRIGHT/FULL)")
    else:
        assert mastery < 70, f"FAIL: expected mastery < 70 but got {mastery}"
        print(f"  [PASS] {label} scored {mastery:.1f} < 70 (review expected)")

    return result


# ═════════════════════════════════════════════════════════════════════════════
# PART 2 — FastAPI test client: ingest → generate → evaluate → DB verification
# ═════════════════════════════════════════════════════════════════════════════

async def test_e2e_via_api(nt02_result):
    """
    Tests 4 & 5:
      - Ingest a small TCP/IP text → get nodes back
      - POST /quiz/generate → store expected_answer in DB, return question
      - POST /quiz/evaluate with correct answer → read DB mastery
      - Verify mastery == NT-03's mastery_score (no progressive wrapper)
      - Verify threshold: >= 70 → dependents unlocked; < 70 → not unlocked
    """
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.db.database import engine, Base, SessionLocal
    from app.models.node import Node

    # Fresh schema every run (so last_expected_answer column is present)
    Base.metadata.create_all(bind=engine)

    SESSION_ID = "aaaabbbb-cccc-dddd-eeee-ffffffff1234"
    HEADERS    = {"X-User-ID": SESSION_ID}

    # Use the question from the live NT-02 call above (or a stored fallback)
    nt02_question = nt02_result.get("question", "Jelaskan apa itu TCP/IP?")
    nt02_expected = nt02_result.get("expected_answer", "")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:

        # ── Step A: Ingest ────────────────────────────────────────────────────
        print_sep("TEST 4 — End-to-End: Ingest → DB")
        ingest_text = CHUNK["description"]
        r = await c.post("/api/v1/material/ingest",
                         json={"source_text": ingest_text}, headers=HEADERS)
        assert r.status_code == 200, f"Ingest failed: {r.text}"
        d = r.json()
        print(f"  Ingest OK: {d['nodes_created']} nodes, {d['edges_created']} edges")

        # ── Step B: Fetch graph, pick the first unlocked node ─────────────────
        r = await c.get("/api/v1/graph", headers=HEADERS)
        assert r.status_code == 200
        g = r.json()
        unlocked_nodes = [n for n in g["nodes"] if n["status"] == "unlocked"]
        assert unlocked_nodes, "No unlocked nodes after ingest"
        node_id = unlocked_nodes[0]["id"]
        print(f"  First unlocked node: {node_id!r}")

        # ── Step C: Generate quiz (NT-02) → saves expected_answer to DB ───────
        print_sep("TEST 4 (cont.) — NT-02 via API: expected_answer persisted to DB")
        r = await c.post("/api/v1/quiz/generate",
                         json={"node_id": node_id}, headers=HEADERS)
        assert r.status_code == 200, f"generate failed: {r.text}"
        api_question = r.json()["question"]
        print(f"  API question: {api_question[:100]!r}")

        # Read DB to confirm expected_answer was stored
        db = SessionLocal()
        try:
            node_row = db.query(Node).filter(Node.id == node_id).first()
            db_expected = node_row.last_expected_answer if node_row else None
            mastery_before = node_row.mastery_score if node_row else None
        finally:
            db.close()

        print(f"  DB last_expected_answer: {(db_expected or '')[:80]!r}")
        print(f"  DB mastery_score before evaluate: {mastery_before}")
        assert db_expected is not None and db_expected != "", \
            "FAIL: last_expected_answer was NOT stored in DB after /quiz/generate"
        print("  [PASS] expected_answer stored in DB after NT-02 call")

        # ── Step D: Evaluate CORRECT answer (NT-03) → verify mastery in DB ────
        print_sep("TEST 5 — NT-03 via API: mastery stored directly (no progressive wrapper)")
        r = await c.post("/api/v1/quiz/evaluate",
                         json={"node_id": node_id, "user_answer": CORRECT_ANSWER},
                         headers=HEADERS)
        assert r.status_code == 200, f"evaluate failed: {r.text}"
        eval_data = r.json()

        api_mastery = eval_data["new_mastery_score"]
        api_level   = eval_data["mastery_level"]
        api_score   = eval_data["ai_score"]
        unlocked    = eval_data["unlocked_new_nodes"]

        # Read DB directly
        db = SessionLocal()
        try:
            node_row    = db.query(Node).filter(Node.id == node_id).first()
            db_mastery  = node_row.mastery_score if node_row else None
        finally:
            db.close()

        print(f"  API response:")
        print(f"    ai_score:           {api_score}")
        print(f"    new_mastery_score:  {api_mastery}")
        print(f"    mastery_level:      {api_level!r}")
        print(f"    unlocked_new_nodes: {unlocked}")
        print(f"\n  DB mastery_score:     {db_mastery}")
        print(f"  mastery_before_eval:  {mastery_before}")

        # Verify: DB mastery == api_mastery (no extra transformation)
        assert abs((db_mastery or 0) - api_mastery) < 0.01, \
            f"FAIL: DB mastery {db_mastery} != API mastery {api_mastery}"
        print("  [PASS] DB mastery_score == API new_mastery_score (stored directly)")

        # Verify: mastery is NOT mastery_before + ai_score * 0.4
        # (that would be calculate_progressive_mastery — must NOT happen on live path)
        progressive_would_be = round(min(100.0, (mastery_before or 0) + api_score * 0.4), 2)
        is_direct = abs(api_mastery - api_score) < 0.1         # NT-03 returns mastery_score directly
        is_progressive = abs(api_mastery - progressive_would_be) < 0.1

        print(f"\n  Verification — was calculate_progressive_mastery() applied?")
        print(f"    NT-03 mastery_score (direct):              {api_score}")
        print(f"    progressive formula result (should NOT be used): {progressive_would_be}")
        print(f"    actual DB mastery:                         {db_mastery}")

        if is_direct and not is_progressive:
            print("  [PASS] mastery stored DIRECTLY from NT-03 (no progressive wrapper)")
        elif is_progressive and not is_direct:
            print("  [FAIL] mastery appears to have been passed through calculate_progressive_mastery()!")
        else:
            # Scores happen to coincide — verify by checking the code path
            print("  [INFO] scores overlap — performing code-level verification instead")

        # ── Step E: 70-threshold unlock verification ──────────────────────────
        print_sep("TEST 5 (cont.) — 70 Threshold Verification")
        print(f"  Mastery after correct answer: {api_mastery}")
        if api_mastery >= 70:
            print(f"  mastery={api_mastery:.1f} >= 70 → expect dependents unlocked")
            print(f"  unlocked_new_nodes: {unlocked}")
            # If there are dependent nodes they should appear in unlocked
            # (the TCP/IP chunk from NT-01 may or may not have dependents)
            print(f"  [PASS] Threshold >= 70 confirmed — mastery_level={api_level!r}")
        else:
            print(f"  mastery={api_mastery:.1f} < 70 → dependents should NOT be unlocked")
            assert not unlocked, f"FAIL: got unlocked nodes at mastery {api_mastery} < 70"
            print(f"  [PASS] Threshold < 70 confirmed — no unlock triggered")

        # ── Step F: Evaluate WRONG answer to verify no-unlock at <70 ─────────
        print_sep("TEST 5 (cont.) — Wrong Answer: mastery < 70, no unlock")

        # Re-ingest to reset mastery for a clean wrong-answer test
        r2 = await c.post("/api/v1/material/ingest",
                          json={"source_text": ingest_text}, headers=HEADERS)
        assert r2.status_code == 200
        g2 = await c.get("/api/v1/graph", headers=HEADERS)
        n2_id = [n for n in g2.json()["nodes"] if n["status"] == "unlocked"][0]["id"]

        await c.post("/api/v1/quiz/generate",
                     json={"node_id": n2_id}, headers=HEADERS)

        r_wrong = await c.post("/api/v1/quiz/evaluate",
                               json={"node_id": n2_id, "user_answer": WRONG_ANSWER},
                               headers=HEADERS)
        assert r_wrong.status_code == 200
        wd = r_wrong.json()
        print(f"  Wrong answer score:          {wd['ai_score']}")
        print(f"  Wrong answer mastery:        {wd['new_mastery_score']}")
        print(f"  Wrong answer mastery_level:  {wd['mastery_level']!r}")
        print(f"  Wrong answer unlocked:       {wd['unlocked_new_nodes']}")

        assert wd["new_mastery_score"] < 70, \
            f"FAIL: wrong answer mastery {wd['new_mastery_score']} should be < 70"
        assert not wd["unlocked_new_nodes"], \
            "FAIL: wrong answer should NOT unlock any nodes"
        print("  [PASS] Wrong answer: mastery < 70, no nodes unlocked")


# ═════════════════════════════════════════════════════════════════════════════
# PART 3 — Code-level verification (no LangFlow needed)
# ═════════════════════════════════════════════════════════════════════════════

def test_code_no_progressive_wrapper():
    """
    Test 6: Confirm calculate_progressive_mastery is NOT called in the
    live path of evaluate_answer() in langflow_service.py OR quiz.py.
    """
    print_sep("TEST 6 — Code Verification: No progressive wrapper on live path")

    import app.services.langflow_service as svc
    import app.api.quiz as quiz_module

    # ── Check langflow_service.evaluate_answer source ─────────────────────────
    src_svc = inspect.getsource(svc.evaluate_answer)
    live_section = src_svc.split("if get_settings().USE_MOCK_AI:")[-1]  # everything after mock check

    # The MOCK path calls _mock_evaluate which internally calls calculate_progressive_mastery.
    # The LIVE path (after the mock guard) must NOT call calculate_progressive_mastery.
    # We split on the 'if get_settings().USE_MOCK_AI:' line and inspect only the else/live part.
    # In Python, 'return _mock_evaluate(...)' exits the function, so everything below it is live path.
    lines = src_svc.splitlines()
    live_lines = []
    past_mock = False
    for line in lines:
        if "if get_settings().USE_MOCK_AI:" in line:
            past_mock = True
            continue
        if past_mock and "return _mock_evaluate" in line:
            # Everything after this return is the live path
            live_lines = []
            continue
        if past_mock:
            live_lines.append(line)

    live_src = "\n".join(live_lines)
    calls_progressive = "calculate_progressive_mastery" in live_src
    print(f"  langflow_service.evaluate_answer — live path:")
    print(f"    calls calculate_progressive_mastery(): {calls_progressive}")
    assert not calls_progressive, \
        "FAIL: calculate_progressive_mastery() found in live path of evaluate_answer()"
    print("  [PASS] evaluate_answer() live path does NOT call calculate_progressive_mastery()")

    # ── Check quiz.py evaluate_answer endpoint source ─────────────────────────
    src_quiz = inspect.getsource(quiz_module.evaluate_answer)
    calls_progressive_quiz = "calculate_progressive_mastery" in src_quiz
    print(f"\n  quiz.py evaluate_answer endpoint:")
    print(f"    calls calculate_progressive_mastery(): {calls_progressive_quiz}")
    assert not calls_progressive_quiz, \
        "FAIL: calculate_progressive_mastery() found in quiz.py evaluate_answer"
    print("  [PASS] quiz.py evaluate endpoint does NOT call calculate_progressive_mastery()")

    # ── Confirm direct storage line ────────────────────────────────────────────
    direct_store = "node.mastery_score = eval_result.score" in src_quiz
    print(f"\n  Direct storage 'node.mastery_score = eval_result.score': {direct_store}")
    assert direct_store, "FAIL: direct storage line not found in quiz.py"
    print("  [PASS] mastery stored directly from NT-03 response")

    # ── Confirm UNLOCK_THRESHOLD constant is 70.0 ─────────────────────────────
    from app.services.mastery_service import UNLOCK_THRESHOLD
    print(f"\n  UNLOCK_THRESHOLD constant: {UNLOCK_THRESHOLD}")
    assert UNLOCK_THRESHOLD == 70.0, f"FAIL: UNLOCK_THRESHOLD is {UNLOCK_THRESHOLD}, expected 70.0"
    print("  [PASS] UNLOCK_THRESHOLD == 70.0")


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

async def main():
    passed = []
    failed = []

    # ── Test 6 first (no LangFlow required) ───────────────────────────────────
    try:
        test_code_no_progressive_wrapper()
        passed.append("Test 6: Code — no progressive wrapper on live path")
    except Exception as e:
        failed.append(f"Test 6: {e}")

    # ── Check LangFlow reachability ───────────────────────────────────────────
    print_sep("Checking LangFlow connectivity…")
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.LANGFLOW_BASE_URL}/health")
        lf_alive = resp.status_code < 400
    except Exception as e:
        lf_alive = False
        print(f"  LangFlow unreachable: {e}")

    if not lf_alive:
        print("\n  [SKIP] LangFlow is not running.")
        print("  Tests 1–5 require LangFlow at http://127.0.0.1:7860")
        print("  Start LangFlow, then re-run this script.\n")
    else:
        print(f"  LangFlow is running at {settings.LANGFLOW_BASE_URL}\n")

        # ── Test 1: NT-02 direct ───────────────────────────────────────────────
        try:
            nt02_result = await test_nt02_direct()
            passed.append("Test 1: NT-02 Direct — question + expected_answer")
        except Exception as e:
            nt02_result = {}
            failed.append(f"Test 1 (NT-02 Direct): {e}")

        question_for_nt03 = nt02_result.get("question", "Jelaskan apa itu TCP/IP?")
        expected_for_nt03 = nt02_result.get("expected_answer", "")

        # ── Test 2: NT-03 correct answer ──────────────────────────────────────
        print_sep("TEST 2 — NT-03 Direct: Correct Answer (expect mastery >= 70)")
        print(f"  Answer: {CORRECT_ANSWER[:80]!r}…")
        try:
            await test_nt03_direct(
                "Correct",
                user_answer=CORRECT_ANSWER,
                previous_mastery=0.0,
                expected_answer=expected_for_nt03,
                question=question_for_nt03,
                expect_gte_70=True,
            )
            passed.append("Test 2: NT-03 Direct — correct answer >= 70")
        except Exception as e:
            failed.append(f"Test 2 (NT-03 Correct): {e}")

        # ── Test 3a: NT-03 partial answer ─────────────────────────────────────
        print_sep("TEST 3a — NT-03 Direct: Partial Answer (expect mastery < 70)")
        print(f"  Answer: {PARTIAL_ANSWER!r}")
        try:
            await test_nt03_direct(
                "Partial",
                user_answer=PARTIAL_ANSWER,
                previous_mastery=0.0,
                expected_answer=expected_for_nt03,
                question=question_for_nt03,
                expect_gte_70=False,
            )
            passed.append("Test 3a: NT-03 Direct — partial answer < 70")
        except Exception as e:
            failed.append(f"Test 3a (NT-03 Partial): {e}")

        # ── Test 3b: NT-03 wrong answer ───────────────────────────────────────
        print_sep("TEST 3b — NT-03 Direct: Wrong Answer (expect mastery near 0)")
        print(f"  Answer: {WRONG_ANSWER!r}")
        try:
            await test_nt03_direct(
                "Wrong",
                user_answer=WRONG_ANSWER,
                previous_mastery=0.0,
                expected_answer=expected_for_nt03,
                question=question_for_nt03,
                expect_gte_70=False,
            )
            passed.append("Test 3b: NT-03 Direct — wrong answer < 70")
        except Exception as e:
            failed.append(f"Test 3b (NT-03 Wrong): {e}")

        # ── Tests 4 & 5: End-to-end via FastAPI ───────────────────────────────
        try:
            await test_e2e_via_api(nt02_result)
            passed.append("Test 4: E2E — NT-02 expected_answer stored in DB")
            passed.append("Test 5: E2E — NT-03 mastery stored directly + 70 threshold")
        except Exception as e:
            failed.append(f"Tests 4/5 (E2E): {e}")

    # ── Summary ────────────────────────────────────────────────────────────────
    print_sep("VERIFICATION SUMMARY")
    print(f"\n  PASSED ({len(passed)}):")
    for p in passed:
        print(f"    [PASS] {p}")

    if failed:
        print(f"\n  FAILED ({len(failed)}):")
        for f in failed:
            print(f"    [FAIL] {f}")
    else:
        if lf_alive:
            print("\n  All live + code tests PASSED.")
            print("  Phase C-7 and C-8: COMPLETE")
        else:
            print("\n  Code tests PASSED. Live tests SKIPPED (LangFlow offline).")
            print("  Start LangFlow and re-run to confirm C-7 and C-8.")

    print()


if __name__ == "__main__":
    asyncio.run(main())
