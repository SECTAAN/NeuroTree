"""
test_edge_annotation.py — focused tests for edge annotation (note + router_enabled).

Tests:
  1. GET /graph includes 'id' field on each edge
  2. GET /graph includes 'note' and 'router_enabled' on each edge
  3. PATCH /edges/:id/annotate — save a note
  4. PATCH /edges/:id/annotate — GET /graph restores the note after a reload
  5. PATCH /edges/:id/annotate — delete a note (empty string → NULL)
  6. PATCH /edges/:id/annotate — 404 for unknown edge
  7. PATCH /edges/:id/annotate — 404 for edge belonging to a different session

Run from backend/:
    .venv/Scripts/python.exe -m pytest test_edge_annotation.py -v
"""
import uuid
import sqlite3
import os
import pytest
from fastapi.testclient import TestClient

# ── Minimal in-memory SQLite setup ────────────────────────────────────────────
# We patch the database URL before importing the app so SQLAlchemy creates
# tables against a temporary in-memory file (not the real neurotree.db).
_TEST_DB = f"test_edge_ann_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ["USE_MOCK_AI"]  = "True"

from app.main import app  # noqa: E402 — must come after env patch
import app.db.database as _db_module
import app.core.config as _cfg_module
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ── Force isolated engine (cross-module safety) ───────────────────────────────
# Clear lru_cache so get_settings() re-reads our DATABASE_URL, and rebind
# the SQLAlchemy engine so queries land in our test DB even if app.main was
# already imported by a previously collected test module.
_cfg_module.get_settings.cache_clear()  # type: ignore[attr-defined]

_test_url = f"sqlite:///{_TEST_DB}"
_new_engine = create_engine(_test_url, connect_args={"check_same_thread": False})
_db_module.engine = _new_engine
_db_module.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_new_engine)

from app.db.database import Base
Base.metadata.create_all(bind=_new_engine)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# Fixed UUIDs so the module-scoped fixture is stable across tests
_USER_ID = str(uuid.uuid4())


@pytest.fixture(scope="module")
def session_with_graph(client):
    """Ingest a tiny doc and return (session_id, edge_ids_from_graph)."""
    sid = str(uuid.uuid4())
    headers = {"X-User-ID": _USER_ID, "X-Session-ID": sid}

    resp = client.post(
        "/api/v1/material/ingest",
        json={
            "source_text": (
                "Alpha is the first concept. "
                "Beta builds on Alpha. "
                "Gamma extends Beta."
            ),
            "tree_name":     "annotation-test",
            "learning_goal": "test",
            "session_id":    sid,
        },
        headers=headers,
        timeout=90,
    )
    assert resp.status_code == 200, f"Ingest failed: {resp.text}"

    # Fetch the graph to get real edge ids
    g = client.get("/api/v1/graph", headers=headers)
    assert g.status_code == 200
    data = g.json()
    return sid, headers, data["edges"]


# ── Test 1+2: GET /graph edge shape ───────────────────────────────────────────

def test_graph_edges_have_id_field(session_with_graph):
    _, _, edges = session_with_graph
    assert len(edges) > 0, "Expected at least one edge after ingest"
    for e in edges:
        assert "id" in e, f"Edge missing 'id': {e}"
        assert e["id"], "Edge 'id' must be non-empty"


def test_graph_edges_have_annotation_fields(session_with_graph):
    _, _, edges = session_with_graph
    for e in edges:
        assert "note"           in e, f"Edge missing 'note': {e}"
        assert "router_enabled" in e, f"Edge missing 'router_enabled': {e}"
        assert e["note"] is None,          "New edge note should be None"
        assert e["router_enabled"] is False, "New edge router_enabled should be False"


# ── Test 3: PATCH saves a note ─────────────────────────────────────────────────

def test_patch_saves_note(session_with_graph, client):
    sid, headers, edges = session_with_graph
    edge_id = edges[0]["id"]

    resp = client.patch(
        f"/api/v1/edges/{edge_id}/annotate",
        json={"note": "This is my note"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["edge_id"]         == edge_id
    assert body["note"]            == "This is my note"
    assert body["router_enabled"] is False


# ── Test 4: GET /graph restores the note after PATCH ──────────────────────────

def test_graph_restores_note_after_patch(session_with_graph, client):
    sid, headers, edges = session_with_graph
    edge_id = edges[0]["id"]

    # Ensure the note is set (test 3 ran first, but let's be idempotent)
    client.patch(
        f"/api/v1/edges/{edge_id}/annotate",
        json={"note": "Restored note text"},
        headers=headers,
    )

    g = client.get("/api/v1/graph", headers=headers)
    assert g.status_code == 200
    graph_edges = {e["id"]: e for e in g.json()["edges"]}
    assert edge_id in graph_edges
    assert graph_edges[edge_id]["note"] == "Restored note text"


# ── Test 5: PATCH empty string deletes the note (stored as NULL) ───────────────

def test_patch_empty_string_clears_note(session_with_graph, client):
    sid, headers, edges = session_with_graph
    edge_id = edges[0]["id"]

    # First set a note
    client.patch(
        f"/api/v1/edges/{edge_id}/annotate",
        json={"note": "Will be deleted"},
        headers=headers,
    )

    # Now clear it
    resp = client.patch(
        f"/api/v1/edges/{edge_id}/annotate",
        json={"note": ""},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["note"] is None

    # Verify GET /graph also sees NULL
    g = client.get("/api/v1/graph", headers=headers)
    graph_edges = {e["id"]: e for e in g.json()["edges"]}
    assert graph_edges[edge_id]["note"] is None


# ── Test 6: PATCH unknown edge → 404 ──────────────────────────────────────────

def test_patch_unknown_edge_returns_404(session_with_graph, client):
    _, headers, _ = session_with_graph
    resp = client.patch(
        "/api/v1/edges/nonexistent-edge-id/annotate",
        json={"note": "ghost"},
        headers=headers,
    )
    assert resp.status_code == 404


# ── Test 7: PATCH wrong session → 404 ────────────────────────────────────────

def test_patch_cross_session_returns_404(session_with_graph, client):
    _, _, edges = session_with_graph
    edge_id = edges[0]["id"]

    wrong_headers = {
        "X-User-ID":    str(uuid.uuid4()),   # different user (valid UUID)
        "X-Session-ID": str(uuid.uuid4()),   # different session
    }
    resp = client.patch(
        f"/api/v1/edges/{edge_id}/annotate",
        json={"note": "intruder"},
        headers=wrong_headers,
    )
    assert resp.status_code == 404


# ── Cleanup ────────────────────────────────────────────────────────────────────

def pytest_sessionfinish(session, exitstatus):
    """Remove the temp test DB file after the test run."""
    try:
        if os.path.exists(_TEST_DB):
            os.remove(_TEST_DB)
    except OSError:
        pass
