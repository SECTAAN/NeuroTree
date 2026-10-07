"""
F-8E.3 Tests — Progressive Reveal State Persistence.

Tests:
  1.  GET /graph returns revealed_depth field (default 0 for new session)
  2.  PATCH /sessions/{id}/reveal persists a new depth value
  3.  GET /graph after PATCH returns the updated revealed_depth
  4.  revealed_depth 0 returns only root-depth nodes (logical check on default)
  5.  PATCH /sessions/{id}/reveal rejects negative values
  6.  PATCH /sessions/{id}/reveal rejects non-integer values
  7.  POST /material/ingest on existing session resets revealed_depth to 0
  8.  A second session has its own independent revealed_depth
  9.  PATCH /sessions/{unknown}/reveal returns 404
  10. revealed_depth column exists in sessions table with default 0
"""
import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ["USE_MOCK_AI"]  = "True"
os.environ["DATABASE_URL"] = "sqlite:///./test_progressive_reveal.db"

from app.core.config import get_settings
get_settings.cache_clear()

# Force table creation on the test DB before TestClient starts.
# (Base.metadata.create_all normally runs in the FastAPI lifespan,
# but we need it up-front so module-level test setup can insert rows.)
from app.db.database import engine, Base
from app.models import Session as SessionModel, Node, Edge  # noqa: F401
Base.metadata.create_all(bind=engine)

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []


def record(name, ok, detail=""):
    results.append((PASS if ok else FAIL, name, detail))
    print(f"  {PASS if ok else FAIL}  {name}" + (f"  [{detail}]" if detail else ""))


def make_user_id():
    return str(uuid.uuid4())


def make_session_id():
    return str(uuid.uuid4())


def ingest(user_id, session_id, text="This is a test document for learning purposes."):
    return client.post(
        "/api/v1/material/ingest",
        json={
            "source_text":   text,
            "tree_name":     "Test Tree",
            "learning_goal": "Test",
            "session_id":    session_id,
        },
        headers={"X-User-ID": user_id, "X-Session-ID": session_id},
    )


# ── Setup: create a session ────────────────────────────────────────────────────
USER_A  = make_user_id()
SESS_A  = make_session_id()
ingest(USER_A, SESS_A)


# ── Test 1: GET /graph returns revealed_depth (default 0) ─────────────────────
print("\n-- Test 1: GET /graph includes revealed_depth -----------------------")
r = client.get("/api/v1/graph", headers={"X-User-ID": USER_A, "X-Session-ID": SESS_A})
ok = r.status_code == 200 and "revealed_depth" in r.json()
record("GET /graph includes revealed_depth field", ok, f"status={r.status_code}")
if ok:
    record("revealed_depth default is 0", r.json()["revealed_depth"] == 0,
           f"value={r.json()['revealed_depth']}")


# ── Test 2: PATCH /sessions/{id}/reveal persists depth ────────────────────────
print("\n-- Test 2: PATCH /sessions/{id}/reveal persists value ---------------")
r = client.patch(
    f"/api/v1/sessions/{SESS_A}/reveal",
    json={"revealed_depth": 2},
    headers={"X-User-ID": USER_A, "X-Session-ID": SESS_A},
)
ok = r.status_code == 200
record("PATCH /sessions/{id}/reveal returns 200", ok, f"status={r.status_code} body={r.text[:80]}")
if ok:
    record("response contains updated revealed_depth",
           r.json().get("revealed_depth") == 2,
           f"value={r.json().get('revealed_depth')}")


# ── Test 3: GET /graph after PATCH returns updated depth ──────────────────────
print("\n-- Test 3: GET /graph after PATCH returns persisted value -----------")
r = client.get("/api/v1/graph", headers={"X-User-ID": USER_A, "X-Session-ID": SESS_A})
ok = r.status_code == 200 and r.json().get("revealed_depth") == 2
record("GET /graph returns persisted revealed_depth after PATCH", ok,
       f"value={r.json().get('revealed_depth')}")


# ── Test 4: Default revealed_depth = 0 for a brand-new session ────────────────
print("\n-- Test 4: Brand-new session defaults to revealed_depth 0 ----------")
USER_B = make_user_id()
SESS_B = make_session_id()
ingest(USER_B, SESS_B)
r = client.get("/api/v1/graph", headers={"X-User-ID": USER_B, "X-Session-ID": SESS_B})
ok = r.status_code == 200 and r.json().get("revealed_depth") == 0
record("New session GET /graph revealed_depth == 0", ok,
       f"value={r.json().get('revealed_depth')}")


# ── Test 5: Negative revealed_depth rejected ──────────────────────────────────
print("\n-- Test 5: Negative revealed_depth rejected -------------------------")
r = client.patch(
    f"/api/v1/sessions/{SESS_A}/reveal",
    json={"revealed_depth": -1},
    headers={"X-User-ID": USER_A, "X-Session-ID": SESS_A},
)
record("PATCH with revealed_depth=-1 returns 422", r.status_code == 422,
       f"status={r.status_code}")


# ── Test 6: Non-integer value rejected ────────────────────────────────────────
print("\n-- Test 6: Non-integer revealed_depth rejected ----------------------")
r = client.patch(
    f"/api/v1/sessions/{SESS_A}/reveal",
    json={"revealed_depth": "two"},
    headers={"X-User-ID": USER_A, "X-Session-ID": SESS_A},
)
record("PATCH with revealed_depth='two' returns 422", r.status_code == 422,
       f"status={r.status_code}")


# ── Test 7: Re-ingest resets revealed_depth to 0 ─────────────────────────────
print("\n-- Test 7: Re-ingest resets revealed_depth to 0 --------------------")
# First confirm it's at 2 from test 2
r = client.get("/api/v1/graph", headers={"X-User-ID": USER_A, "X-Session-ID": SESS_A})
before = r.json().get("revealed_depth")
# Re-ingest
ingest(USER_A, SESS_A, text="A completely new document for this session with fresh content.")
r = client.get("/api/v1/graph", headers={"X-User-ID": USER_A, "X-Session-ID": SESS_A})
after = r.json().get("revealed_depth")
record("Re-ingest resets revealed_depth to 0",
       before == 2 and after == 0,
       f"before={before} after={after}")


# ── Test 8: Two sessions have independent revealed_depth ─────────────────────
print("\n-- Test 8: Independent revealed_depth per session -------------------")
USER_C = make_user_id()
SESS_C = make_session_id()
ingest(USER_C, SESS_C)

# Set SESS_C depth to 3
client.patch(
    f"/api/v1/sessions/{SESS_C}/reveal",
    json={"revealed_depth": 3},
    headers={"X-User-ID": USER_C, "X-Session-ID": SESS_C},
)
# SESS_A should still be 0 (reset by re-ingest in test 7)
r_a = client.get("/api/v1/graph", headers={"X-User-ID": USER_A, "X-Session-ID": SESS_A})
r_c = client.get("/api/v1/graph", headers={"X-User-ID": USER_C, "X-Session-ID": SESS_C})
ok = r_a.json().get("revealed_depth") == 0 and r_c.json().get("revealed_depth") == 3
record("Sessions have independent revealed_depth values", ok,
       f"A={r_a.json().get('revealed_depth')} C={r_c.json().get('revealed_depth')}")


# ── Test 9: PATCH on unknown session returns 404 ──────────────────────────────
print("\n-- Test 9: PATCH on unknown session returns 404 --------------------")
r = client.patch(
    f"/api/v1/sessions/{make_session_id()}/reveal",
    json={"revealed_depth": 1},
    headers={"X-User-ID": USER_A},
)
record("PATCH on unknown session returns 404", r.status_code == 404,
       f"status={r.status_code}")


# ── Test 10: Column exists in DB with default 0 ───────────────────────────────
print("\n-- Test 10: revealed_depth column exists in DB ----------------------")
import sqlite3 as _sqlite3
db_path = "./test_progressive_reveal.db"
try:
    conn = _sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(sessions)")
    cols = {row[1]: row for row in cur.fetchall()}
    conn.close()
    col_exists = "revealed_depth" in cols
    # SQLite stores server_default as the literal string "0" or "'0'" depending
    # on the ORM version; normalise by stripping surrounding quotes.
    raw_default = str(cols["revealed_depth"][4]).strip("'") if col_exists else ""
    default_ok  = col_exists and raw_default == "0"
    record("revealed_depth column exists in sessions table", col_exists)
    record("revealed_depth column has default value 0", default_ok,
           f"default={cols.get('revealed_depth', [None]*5)[4]!r}")
except Exception as e:
    record("DB column check", False, str(e)[:80])


# ── Cleanup ───────────────────────────────────────────────────────────────────
import os as _os
try:
    if _os.path.exists("./test_progressive_reveal.db"):
        _os.remove("./test_progressive_reveal.db")
except Exception:
    pass


# ── Summary ───────────────────────────────────────────────────────────────────
print()
passed = sum(1 for r in results if r[0] == PASS)
failed = sum(1 for r in results if r[0] == FAIL)
total  = len(results)
print(f"F-8E.3 Progressive Reveal Tests: {passed}/{total} passed",
      "***" if failed == 0 else "!!!")
if failed:
    print("\nFailed tests:")
    for r in results:
        if r[0] == FAIL:
            print(f"  {r[0]} {r[1]}" + (f" [{r[2]}]" if r[2] else ""))

sys.exit(0 if failed == 0 else 1)
