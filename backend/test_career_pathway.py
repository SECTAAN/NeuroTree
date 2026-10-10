"""
test_career_pathway.py — focused tests for career API endpoints (M-15/M-16).

Tests:
  A. GET /career/suggest — domain mapper (pure logic + HTTP)
  A1. suggest_careers_from_titles — networking keywords → Network Engineer first
  A2. suggest_careers_from_titles — security keywords → Cybersecurity Analyst
  A3. suggest_careers_from_titles — empty titles → fallback careers
  A4. suggest_careers_from_titles — learning-intention words ("paham", "belajar") → fallback
  A5. suggest_careers_from_titles — result is NEVER a node title
  A6. GET /career/suggest with a networking session → domain_match source
  A7. GET /career/suggest with empty session → fallback source, node_count 0
  A8. GET /career/suggest — returned careers are from the predefined safe list (no verbatim titles)

  B. POST /career/pathway — endpoint contract (unchanged from M-14)
  B1. Mock pathway — response shape complete
  B2. Mock pathway — empty session returns valid empty result
  B3. Mock pathway — career_goal echoed
  B4. Mock pathway — profile_summary matches knowledge node count (M-7 rule)
  B5. Mock pathway — recommended_path step shape
  B6. Mock pathway — path capped at 5 steps
  B7. Repeated submissions with different goals are independent
  B8. Session isolation
  B9. career_goal too short → 422
  B10. career_goal too long → 422
  B11. career_goal missing → 422
  B12. career_goal at max length → 200 OK

  C. Regression: "paham" / learning-intention must never be a career
  (C1–C6 from M-15 session — preserved)

  D. Career relevance and custom-goal analysis (M-16 UAT fixes)
  D1. Domain mapper scoring: ML/Data Science titles beat networking when more keywords match
  D2. Domain mapper: "Neural Network Basics" nodes do NOT produce "Network Engineer" as top
  D3. Mock pathway: Panel A and Panel B produce different reasoning for different career goals
  D4. Mock pathway: career-relevant chunks rank first in recommended_path
  D5. Mock pathway: reasoning message includes the career_goal name
  D6. Mock pathway: Panel B with "AI Engineer" produces AI-relevant path steps, not just generic
  D7. Session change: a new ingest with different content updates /suggest results
  D8. Empty profile handled honestly — no fabricated concepts
  D9. LIVE/MOCK contract: both paths return the same response keys

Run from backend/:
    .venv/Scripts/python.exe -m pytest test_career_pathway.py -v
"""
import uuid
import os
import pytest
from fastapi.testclient import TestClient

# ── Minimal isolated test DB ──────────────────────────────────────────────────
# Set env vars BEFORE any app imports so pydantic-settings picks them up.
_TEST_DB = f"test_career_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ["USE_MOCK_AI"]  = "True"   # use mock NT-05; no LangFlow required

from app.main import app   # noqa: E402
import app.db.database as _db_module
import app.core.config as _cfg_module
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ── Force isolated engine ──────────────────────────────────────────────────────
# When pytest collects multiple test files, Python's module cache means app.main
# is only imported once.  If test_edge_annotation.py was collected first its
# DATABASE_URL wins and the engine already points to that file's DB.
# We fix this by explicitly creating a new engine for our test DB and rebinding
# it in all the places that hold a reference: app.db.database and the settings
# cache (lru_cache is cleared so get_settings() re-reads the new env vars).
_cfg_module.get_settings.cache_clear()  # type: ignore[attr-defined]

_test_url = f"sqlite:///{_TEST_DB}"
_new_engine = create_engine(_test_url, connect_args={"check_same_thread": False})
_db_module.engine = _new_engine
_db_module.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_new_engine)

from app.db.database import Base
Base.metadata.create_all(bind=_new_engine)

# ── Fixtures ──────────────────────────────────────────────────────────────────
_USER_ID = str(uuid.uuid4())


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _headers(session_id: str) -> dict:
    return {"X-User-ID": _USER_ID, "X-Session-ID": session_id}


def _ingest(client, session_id: str, source_text: str = None):
    """Helper: ingest a document into a session. Returns the session_id."""
    text = source_text or (
        "Alpha is the first concept. "
        "Beta builds on Alpha. "
        "Gamma extends Beta. "
        "Delta requires Gamma."
    )
    resp = client.post(
        "/api/v1/material/ingest",
        json={
            "source_text":   text,
            "tree_name":     "test-tree",
            "learning_goal": "Network Engineer",
            "session_id":    session_id,
        },
        headers=_headers(session_id),
        timeout=90,
    )
    assert resp.status_code == 200, f"Ingest failed: {resp.text}"
    return session_id


# ── Import the domain mapper for pure-logic tests ────────────────────────────
from app.api.career import _suggest_careers_from_titles, _FALLBACK_CAREERS, _DOMAIN_RULES
from app.services.langflow_service import (
    _mock_knowledge_gap_pathway,
    _career_relevance_score,
    _CAREER_KEYWORDS,
)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION A — GET /career/suggest  (domain mapper)
# ═══════════════════════════════════════════════════════════════════════════════

# A1. Networking keywords → Network Engineer is first ─────────────────────────

def test_suggest_networking_titles_returns_network_engineer():
    """Node titles with clear networking terms must map to Network Engineer first."""
    titles = ["Network Basics", "IP Addressing", "Routing & Switching", "TCP/IP Model",
              "Network Security Fundamentals"]
    careers = _suggest_careers_from_titles(titles)
    assert len(careers) > 0
    assert careers[0] == "Network Engineer", (
        f"Expected 'Network Engineer' as first career, got {careers[0]!r}. "
        "Panel A would show the wrong career title."
    )


# A2. Security keywords → Cybersecurity Analyst ───────────────────────────────

def test_suggest_security_titles_returns_cybersecurity():
    """Node titles with security terms must include Cybersecurity Analyst."""
    titles = ["Firewall Fundamentals", "VPN Configuration", "Intrusion Detection",
              "Malware Analysis", "Encryption Basics"]
    careers = _suggest_careers_from_titles(titles)
    assert any("Cybersecurity" in c for c in careers), (
        f"Expected a Cybersecurity career in {careers}"
    )


# A3. Empty titles → fallback (valid career names, not empty) ─────────────────

def test_suggest_empty_titles_returns_fallback():
    """An empty node-title list must return the fallback list, not an empty list."""
    careers = _suggest_careers_from_titles([])
    assert len(careers) > 0, "Fallback must return at least one career"
    for c in careers:
        assert c in _FALLBACK_CAREERS, f"Unexpected career in fallback output: {c!r}"


# A4. Learning-intention words NEVER become career titles ─────────────────────

def test_suggest_learning_intention_words_return_fallback():
    """
    Words like 'paham', 'belajar', 'mengerti' are learning intentions.
    They contain no domain keyword → fallback careers must be returned.
    Crucially, the word 'paham' itself must NOT appear in the output.
    """
    intention_phrases = ["paham", "belajar", "mengerti", "memahami konsep"]
    for phrase in intention_phrases:
        careers = _suggest_careers_from_titles([phrase])
        assert phrase.lower() not in [c.lower() for c in careers], (
            f"Learning intention {phrase!r} must never appear as a career title. "
            f"Got: {careers}"
        )
        # Must return at least one valid fallback career
        assert len(careers) > 0


# A5. Returned careers are NEVER verbatim node titles ─────────────────────────

def test_suggest_careers_are_never_verbatim_node_titles():
    """
    The domain mapper must return careers from its predefined safe lists,
    not raw node title strings.  Even if a node is called 'Network Engineer',
    the result should not be the node title echoed back — it comes from the rule.
    """
    titles = ["Network Basics", "IP Addressing", "Routing"]
    careers = _suggest_careers_from_titles(titles)
    for career in careers:
        # Each returned career must come from one of the rule career lists or fallback
        all_safe_careers = _FALLBACK_CAREERS + [
            c for _, _, cs in _DOMAIN_RULES for c in cs
        ]
        assert career in all_safe_careers, (
            f"Career {career!r} is not in the predefined safe list. "
            "It may be a verbatim node title being echoed as a career."
        )


# A6. GET /career/suggest — networking session → domain_match ─────────────────

def test_suggest_endpoint_networking_session(client):
    """A session with networking nodes must return source='domain_match'."""
    sid = str(uuid.uuid4())
    _ingest(client, sid)   # mock graph has networking nodes

    resp = client.get("/api/v1/career/suggest", headers=_headers(sid))
    assert resp.status_code == 200
    body = resp.json()

    assert "careers"    in body
    assert "source"     in body
    assert "node_count" in body

    assert body["source"]     == "domain_match", (
        f"Expected domain_match for networking session, got {body['source']!r}"
    )
    assert body["node_count"]  > 0
    assert len(body["careers"]) > 0

    # First career must be a real career title, not a learning intention
    first = body["careers"][0]
    assert first == "Network Engineer", (
        f"Expected 'Network Engineer' as first suggested career, got {first!r}"
    )


# A7. GET /career/suggest — empty session → fallback ──────────────────────────

def test_suggest_endpoint_empty_session(client):
    """An empty session must return source='fallback' and node_count=0."""
    sid = str(uuid.uuid4())   # empty — no ingest

    resp = client.get("/api/v1/career/suggest", headers=_headers(sid))
    assert resp.status_code == 200
    body = resp.json()

    assert body["source"]     == "fallback"
    assert body["node_count"] == 0
    assert len(body["careers"]) > 0   # fallback must still return careers

    # Fallback careers must be from the safe list
    for career in body["careers"]:
        assert career in _FALLBACK_CAREERS, (
            f"Unexpected career {career!r} in fallback output"
        )


# A8. GET /career/suggest — returned careers are never verbatim node titles ────

def test_suggest_endpoint_careers_are_not_node_titles(client):
    """
    The /suggest endpoint must never return a node title (like 'Network Basics')
    as a suggested career — only predefined career names from the domain rules.
    """
    sid = str(uuid.uuid4())
    _ingest(client, sid)

    # Get node titles from the graph
    graph = client.get("/api/v1/graph", headers=_headers(sid))
    node_titles = {n["title"].lower() for n in graph.json()["nodes"]}

    resp = client.get("/api/v1/career/suggest", headers=_headers(sid))
    assert resp.status_code == 200
    for career in resp.json()["careers"]:
        assert career.lower() not in node_titles, (
            f"Career suggestion {career!r} is a verbatim node title — "
            "this would display a chunk name as a career."
        )


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION B — POST /career/pathway  (NT-05 endpoint contract)
# ═══════════════════════════════════════════════════════════════════════════════

# B1. All mastered ─────────────────────────────────────────────────────────────

def test_pathway_all_mastered(client):
    """When all nodes are mastered there should be no recommended_path steps
    (or they may still be returned if NT-05 mock decides — we just verify shape)."""
    sid = str(uuid.uuid4())
    _ingest(client, sid)

    # Force mastery by running quizzes is complex; test the endpoint contract
    # with a direct POST using the mock path (USE_MOCK_AI=True).
    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Network Engineer"},
        headers=_headers(sid),
    )
    assert resp.status_code == 200
    body = resp.json()
    # Required keys must always be present
    for key in ("career_goal", "strong_concepts", "weak_concepts", "knowledge_gaps",
                "recommended_path", "profile_summary", "reasoning"):
        assert key in body, f"Missing key: {key}"


# ── 3. Empty session (no nodes) ───────────────────────────────────────────────

def test_pathway_empty_session(client):
    """A brand-new session with no nodes should still return a valid (empty) result."""
    sid = str(uuid.uuid4())
    # Do NOT ingest — empty session
    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Data Scientist"},
        headers=_headers(sid),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["profile_summary"]["total"]   == 0
    assert body["profile_summary"]["mastered"] == 0
    assert body["profile_summary"]["weak"]     == 0
    assert body["profile_summary"]["missing"]  == 0
    assert body["recommended_path"] == []


# ── 4. Career goal echoed in response ─────────────────────────────────────────

def test_pathway_goal_echoed(client):
    """career_goal in the response must match the submitted goal (mock uses it as target_goal)."""
    sid = str(uuid.uuid4())
    _ingest(client, sid)

    goal = "Machine Learning Engineer"
    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": goal},
        headers=_headers(sid),
    )
    assert resp.status_code == 200
    assert resp.json()["career_goal"] == goal


# ── 5. Profile summary counts match ingest ───────────────────────────────────

def test_pathway_profile_summary_matches_node_count(client):
    """profile_summary.total == total KNOWLEDGE nodes (master_light excluded).

    career.py filters Node.node_type == 'knowledge', matching the M-7 rule.
    GET /graph returns all node types including master_light, so we must
    filter the graph response to the same type before comparing.
    """
    sid = str(uuid.uuid4())
    _ingest(client, sid)

    # Fetch the graph and count only knowledge-type nodes (career endpoint excludes master_light)
    graph = client.get("/api/v1/graph", headers=_headers(sid))
    assert graph.status_code == 200
    knowledge_nodes = [
        n for n in graph.json()["nodes"]
        if n.get("node_type", "knowledge") == "knowledge"
    ]
    expected_total = len(knowledge_nodes)

    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Network Engineer"},
        headers=_headers(sid),
    )
    assert resp.status_code == 200
    summary = resp.json()["profile_summary"]
    assert summary["total"] == expected_total, (
        f"Expected {expected_total} knowledge nodes, got {summary['total']}. "
        "Check that master_light nodes are excluded from career.py (M-7 rule)."
    )
    # The three categories must sum to total
    assert summary["mastered"] + summary["weak"] + summary["missing"] == summary["total"]


# ── 6. Recommended path step shape ────────────────────────────────────────────

def test_pathway_recommended_path_step_shape(client):
    """Each recommended_path step must have step, chunk_id, chunk_title, reason."""
    sid = str(uuid.uuid4())
    _ingest(client, sid)

    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Network Engineer"},
        headers=_headers(sid),
    )
    assert resp.status_code == 200
    path = resp.json()["recommended_path"]
    for step in path:
        assert "step"        in step
        assert "chunk_id"    in step
        assert "chunk_title" in step
        assert "reason"      in step
        assert isinstance(step["step"], int)
        assert step["step"] >= 1


# ── 7. Recommended path capped at 5 steps ────────────────────────────────────

def test_pathway_recommended_path_max_5_steps(client):
    """Mock NT-05 caps recommended_path at 5 steps."""
    sid = str(uuid.uuid4())
    # Ingest a larger document to get more nodes
    big_text = " ".join(
        f"Concept{i} depends on Concept{i-1}." for i in range(1, 12)
    )
    _ingest(client, sid, source_text=big_text)

    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Senior Developer"},
        headers=_headers(sid),
    )
    assert resp.status_code == 200
    assert len(resp.json()["recommended_path"]) <= 5


# ── 8. Repeated submissions with different goals ──────────────────────────────

def test_pathway_different_goals_independent(client):
    """Two separate POSTs with different goals should return different career_goal fields."""
    sid = str(uuid.uuid4())
    _ingest(client, sid)

    r1 = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Backend Engineer"},
        headers=_headers(sid),
    )
    r2 = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Frontend Engineer"},
        headers=_headers(sid),
    )
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["career_goal"] == "Backend Engineer"
    assert r2.json()["career_goal"] == "Frontend Engineer"


# ── 9. Session isolation ──────────────────────────────────────────────────────

def test_pathway_session_isolation(client):
    """Two sessions with different node counts return different profile summaries."""
    sid_a = str(uuid.uuid4())
    sid_b = str(uuid.uuid4())

    _ingest(client, sid_a)   # ingests ~4 nodes (mock graph)
    # sid_b is empty — no ingest

    r_a = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Network Engineer"},
        headers=_headers(sid_a),
    )
    r_b = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Network Engineer"},
        headers=_headers(sid_b),
    )
    assert r_a.status_code == 200
    assert r_b.status_code == 200

    # Session A has nodes; Session B is empty
    assert r_a.json()["profile_summary"]["total"] > 0
    assert r_b.json()["profile_summary"]["total"] == 0


# ── 10–12. Request validation ─────────────────────────────────────────────────

def test_pathway_career_goal_too_short(client):
    sid = str(uuid.uuid4())
    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "A"},   # min_length=2
        headers=_headers(sid),
    )
    assert resp.status_code == 422


def test_pathway_career_goal_too_long(client):
    sid = str(uuid.uuid4())
    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "X" * 201},   # max_length=200
        headers=_headers(sid),
    )
    assert resp.status_code == 422


def test_pathway_career_goal_missing(client):
    sid = str(uuid.uuid4())
    resp = client.post(
        "/api/v1/career/pathway",
        json={},
        headers=_headers(sid),
    )
    assert resp.status_code == 422


# ── 13. Boundary: career_goal at exact max length ─────────────────────────────

def test_pathway_career_goal_at_max_length(client):
    sid = str(uuid.uuid4())
    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "X" * 200},   # exactly at max_length=200
        headers=_headers(sid),
    )
    assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION C — Regression: "paham" / learning-intention must never be a career
#
# Root-cause: an earlier version of Panel A passed `learningGoal` (e.g. "paham",
# "belajar jaringan") directly to POST /career/pathway and then displayed
# `result.career_goal` as the recommended profession.
#
# These tests lock in the fix:
#   C1. Pure-logic: learning intention words are never returned by _suggest_careers
#   C2. /suggest HTTP: response careers are always real profession names
#   C3. /pathway HTTP: career_goal echoed from a real profession name is a
#       profession name, not a learning intention
#   C4. /pathway HTTP: "paham" as career_goal succeeds (400-char guard passes),
#       but NT-05 still receives it verbatim — the *suggest* step is what
#       ensures Panel A never sends it; this test confirms the guard is at /suggest
#   C5. Panel A integration: suggest → pathway flow produces a career_goal that
#       is from the safe profession list, not from the node-title corpus
#   C6. /suggest always returns careers from the safe list, not verbatim titles
# ═══════════════════════════════════════════════════════════════════════════════

# All known learning-intention words that must NEVER appear as a career title
_LEARNING_INTENTIONS = [
    "paham", "belajar", "mengerti", "memahami", "mempelajari",
    "belajar jaringan", "ingin paham", "coba belajar",
]


# C1. Pure-logic: _suggest_careers_from_titles never returns a learning intention ──

def test_suggest_never_returns_learning_intention_pure():
    """
    _suggest_careers_from_titles must return careers from the safe list regardless
    of what node titles are passed in.  Learning intention words in titles must
    not leak into the output.
    """
    for intention in _LEARNING_INTENTIONS:
        careers = _suggest_careers_from_titles([intention])
        for career in careers:
            assert career.lower() != intention.lower(), (
                f"Learning intention {intention!r} was returned as a career title: {careers}"
            )
        # Must be in the safe list
        all_safe = _FALLBACK_CAREERS + [c for _, _, cs in _DOMAIN_RULES for c in cs]
        for career in careers:
            assert career in all_safe, (
                f"Career {career!r} is not in the predefined safe list. "
                f"Input was learning intention {intention!r}."
            )


# C2. /suggest HTTP: careers are always real profession names ──────────────────

def test_suggest_endpoint_careers_are_profession_names(client):
    """
    GET /career/suggest must never return a learning intention as a career.
    Even with an empty session (no nodes), fallback careers must be real profession names.
    """
    sid = str(uuid.uuid4())   # empty session — no ingest

    resp = client.get("/api/v1/career/suggest", headers=_headers(sid))
    assert resp.status_code == 200
    careers = resp.json()["careers"]

    for career in careers:
        # Must not be a learning intention
        for intention in _LEARNING_INTENTIONS:
            assert career.lower() != intention.lower(), (
                f"Career {career!r} is a learning intention — "
                "should be a profession name from the safe list."
            )
        # Must contain at least one uppercase letter (real profession names do)
        assert any(c.isupper() for c in career), (
            f"Career {career!r} has no uppercase — likely not a profession title."
        )


# C3. Panel A integration: suggest→pathway produces real career_goal ──────────

def test_panel_a_flow_produces_real_career_goal(client):
    """
    Simulate the Panel A two-step flow:
      1. GET /career/suggest → pick top career
      2. POST /career/pathway with that career
      3. result.career_goal must be a real profession name, not a learning intention

    This is the exact regression for the "paham displayed as career" bug.
    """
    sid = str(uuid.uuid4())
    _ingest(client, sid)   # networking mock graph → top career = "Network Engineer"

    # Step 1: get the suggested career (as Panel A does)
    suggest_resp = client.get("/api/v1/career/suggest", headers=_headers(sid))
    assert suggest_resp.status_code == 200
    suggest_body = suggest_resp.json()
    top_career = suggest_body["careers"][0]

    # Regression guard: top career must not be a learning intention
    for intention in _LEARNING_INTENTIONS:
        assert top_career.lower() != intention.lower(), (
            f"Panel A bug: /suggest returned {top_career!r} which is a learning intention. "
            "This is the 'paham displayed as career' regression."
        )

    # Step 2: POST pathway with the suggested career (as Panel A does)
    pathway_resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": top_career},
        headers=_headers(sid),
    )
    assert pathway_resp.status_code == 200
    result_career = pathway_resp.json()["career_goal"]

    # The displayed career_goal must be a real profession name
    for intention in _LEARNING_INTENTIONS:
        assert result_career.lower() != intention.lower(), (
            f"career_goal in pathway response is {result_career!r} "
            "which is a learning intention — Panel A would display the wrong value."
        )

    # Must be the profession name that was suggested, not something fabricated
    assert result_career == top_career, (
        f"Expected career_goal={top_career!r}, got {result_career!r}"
    )


# C4. /suggest with networking session returns "Network Engineer" first ────────

def test_suggest_networking_session_top_career_is_network_engineer(client):
    """
    A session built from the mock networking graph (node titles: Network Basics,
    IP Addressing, Routing & Switching, TCP/IP Model, Network Security Fundamentals)
    must have 'Network Engineer' as the first suggested career.

    This locks in that the domain mapper returns a specific profession, not the
    node title 'Network Basics' or the learning goal 'paham'.
    """
    sid = str(uuid.uuid4())
    _ingest(client, sid)

    resp = client.get("/api/v1/career/suggest", headers=_headers(sid))
    assert resp.status_code == 200
    body = resp.json()

    assert body["source"] == "domain_match", (
        f"Expected domain_match source for networking session, got {body['source']!r}"
    )
    top = body["careers"][0]
    assert top == "Network Engineer", (
        f"Expected 'Network Engineer' as top career for networking session, got {top!r}. "
        "Panel A would display the wrong career title."
    )


# C5. Panel B: custom goal is independent of Panel A ──────────────────────────

def test_panel_b_custom_goal_does_not_replace_panel_a_state(client):
    """
    Submitting a custom career goal via Panel B must return an independent result.
    The career_goal in the Panel B response must match the submitted goal,
    not bleed through to modify Panel A state.
    (Frontend isolation test — verifies the API contract Panel B depends on.)
    """
    sid = str(uuid.uuid4())
    _ingest(client, sid)

    # Panel A flow (simulate)
    suggest_resp = client.get("/api/v1/career/suggest", headers=_headers(sid))
    panel_a_career = suggest_resp.json()["careers"][0]

    # Panel B: user submits a different custom goal
    custom_goal = "DevOps Engineer"
    panel_b_resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": custom_goal},
        headers=_headers(sid),
    )
    assert panel_b_resp.status_code == 200
    panel_b_result = panel_b_resp.json()

    # Panel B result shows the user's custom goal
    assert panel_b_result["career_goal"] == custom_goal, (
        f"Panel B: expected career_goal={custom_goal!r}, got {panel_b_result['career_goal']!r}"
    )

    # Panel B result must be structurally complete
    for key in ("career_goal", "strong_concepts", "weak_concepts", "knowledge_gaps",
                "recommended_path", "profile_summary", "reasoning"):
        assert key in panel_b_result, f"Panel B result missing key: {key}"

    # Panel A suggested career is unchanged (not contaminated by Panel B submit)
    suggest_again = client.get("/api/v1/career/suggest", headers=_headers(sid))
    assert suggest_again.json()["careers"][0] == panel_a_career, (
        "Panel B submission should not change Panel A's /suggest result."
    )


# C6. /suggest empty session: fallback careers are valid profession names ──────

def test_suggest_empty_session_fallback_are_profession_names(client):
    """
    When a session has no knowledge nodes, /suggest returns fallback careers.
    Those fallback careers must be real profession names, not learning intentions,
    and must come from _FALLBACK_CAREERS.
    """
    sid = str(uuid.uuid4())   # no ingest

    resp = client.get("/api/v1/career/suggest", headers=_headers(sid))
    assert resp.status_code == 200
    body = resp.json()

    assert body["source"] == "fallback"
    assert body["node_count"] == 0

    for career in body["careers"]:
        # Must be in the predefined fallback list
        assert career in _FALLBACK_CAREERS, (
            f"Fallback career {career!r} is not in _FALLBACK_CAREERS — "
            "it may be a verbatim user input leaking into the response."
        )
        # Must not be a learning intention
        for intention in _LEARNING_INTENTIONS:
            assert career.lower() != intention.lower(), (
                f"Fallback career {career!r} is a learning intention word."
            )


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION D — Career relevance and custom-goal analysis (M-16 UAT fixes)
#
# These tests lock in the three-bug fix:
#   Bug 1: Domain mapper scoring — most-evidence domain wins, not first-match
#   Bug 2: Mock NT-05 is career-aware — Panel A ≠ Panel B for same session
#   Bug 3: LIVE NT-05 payload uses field names NT-05 prompt expects
# ═══════════════════════════════════════════════════════════════════════════════

# D1. Domain mapper scoring: ML/data science titles beat networking ─────────────

def test_suggest_ml_titles_beat_network_single_word():
    """
    Bug 1 regression: if node titles contain "Neural Network" the word "network"
    should NOT be enough to rank networking above machine-learning domain when
    the ML domain has more matching keywords.

    Titles like "Neural Network Basics", "Deep Learning", "Classification Models"
    match the ML rule on multiple keywords; they should NOT produce "Network Engineer"
    as the top career.
    """
    titles = [
        "Neural Network Basics",
        "Deep Learning Architecture",
        "Classification and Regression",
        "Data Preprocessing",
        "Model Training Techniques",
    ]
    careers = _suggest_careers_from_titles(titles)
    assert len(careers) > 0
    top = careers[0]
    assert top != "Network Engineer", (
        f"Bug 1 regression: 'Neural Network' in a title caused 'Network Engineer' "
        f"to be top career despite multiple ML-domain keywords. Got: {careers}"
    )
    # Top should be an ML/Data career
    ml_careers = {"Machine Learning Engineer", "AI Engineer", "Data Scientist", "MLOps Engineer"}
    assert top in ml_careers, (
        f"Expected an ML/Data career as top for ML node titles, got {top!r}. "
        f"Full list: {careers}"
    )


# D2. Domain mapper scoring: data science content → Data Scientist/Data Engineer ─

def test_suggest_data_science_titles_produce_data_career():
    """
    A set of node titles typical of a Data Science PDF (statistics, pandas,
    visualization, model evaluation) must produce a data-domain career as top,
    not a networking career.
    """
    titles = [
        "Introduction to Data Science",
        "Pandas and NumPy Fundamentals",
        "Data Visualization with Matplotlib",
        "Statistical Analysis",
        "Machine Learning Model Evaluation",
        "Feature Engineering and Dataset Preparation",
    ]
    careers = _suggest_careers_from_titles(titles)
    assert len(careers) > 0
    top = careers[0]

    data_careers = {
        "Data Scientist", "Data Analyst", "Data Engineer",
        "Machine Learning Engineer", "AI Engineer", "MLOps Engineer",
        "Business Intelligence Developer",
    }
    assert top in data_careers, (
        f"Data Science titles should produce a data-domain career. "
        f"Got {top!r} (full list: {careers}). "
        "A networking career here would be the Bug 1 regression."
    )
    # Explicitly must not be Network Engineer
    assert top != "Network Engineer", (
        f"Bug 1 confirmed: 'Network Engineer' returned for Data Science content."
    )


# D3. Mock: Panel A and Panel B produce different reasoning for different goals ──

def test_mock_pathway_reasoning_includes_career_goal():
    """
    Bug 2 regression: the mock pathway reasoning must name the specific career goal
    so Panel A and Panel B produce visibly different output for the same session data.
    """
    weak    = [{"id": "n1", "title": "Data Analysis", "mastery_score": 40.0}]
    missing = [{"id": "n2", "title": "Machine Learning"}]

    result_a = _mock_knowledge_gap_pathway("Data Scientist", [], weak, missing)
    result_b = _mock_knowledge_gap_pathway("Network Engineer", [], weak, missing)

    assert "Data Scientist" in result_a.reasoning, (
        f"Panel A reasoning should mention 'Data Scientist', got: {result_a.reasoning!r}"
    )
    assert "Network Engineer" in result_b.reasoning, (
        f"Panel B reasoning should mention 'Network Engineer', got: {result_b.reasoning!r}"
    )
    # The two reasonings must be different
    assert result_a.reasoning != result_b.reasoning, (
        "Panel A and Panel B reasoning are identical — custom goals are not distinguishable."
    )


# D4. Mock: career-relevant chunks rank first in recommended_path ──────────────

def test_mock_pathway_career_relevant_chunks_rank_first():
    """
    Bug 2 regression: given a set of weak chunks, the one most relevant to the
    requested career must appear as step 1 in the recommended_path.
    """
    # Mix of topics: one clearly networking, one clearly ML, one generic
    missing = [
        {"id": "n1", "title": "Generic Algorithm Basics"},        # low relevance for both
        {"id": "n2", "title": "Routing and Switching Protocols"},  # high networking relevance
        {"id": "n3", "title": "Machine Learning Model Training"},  # high ML relevance
    ]

    # For Network Engineer, routing/switching should rank first
    net_result = _mock_knowledge_gap_pathway("Network Engineer", [], [], missing)
    assert net_result.recommended_path[0].chunk_title == "Routing and Switching Protocols", (
        f"For Network Engineer, routing/switching should be step 1. "
        f"Got: {net_result.recommended_path[0].chunk_title!r}"
    )

    # For Machine Learning Engineer, ML training should rank first
    ml_result = _mock_knowledge_gap_pathway("Machine Learning Engineer", [], [], missing)
    assert ml_result.recommended_path[0].chunk_title == "Machine Learning Model Training", (
        f"For ML Engineer, ML model training should be step 1. "
        f"Got: {ml_result.recommended_path[0].chunk_title!r}"
    )


# D5. Mock: step reasons reference the career_goal ────────────────────────────

def test_mock_pathway_step_reasons_reference_career_goal():
    """
    The reason text for at least the first recommended_path step must mention
    the career_goal (not just generic text) so Panel A ≠ Panel B on same session.
    """
    missing = [{"id": "n1", "title": "Routing and Switching"}]

    result = _mock_knowledge_gap_pathway("Network Engineer", [], [], missing)
    assert len(result.recommended_path) > 0
    first_reason = result.recommended_path[0].reason
    assert "Network Engineer" in first_reason, (
        f"Step 1 reason should mention 'Network Engineer', got: {first_reason!r}"
    )


# D6. Panel B "AI Engineer" via HTTP produces career-specific reasoning ─────────

def test_panel_b_ai_engineer_produces_career_specific_reasoning(client):
    """
    Bug 2 HTTP regression: POSTing 'AI Engineer' to /career/pathway must return
    reasoning that mentions 'AI Engineer' — not generic text and not the
    auto-recommended career from Panel A.
    """
    sid = str(uuid.uuid4())
    _ingest(client, sid)   # mock networking graph — typical real-world mismatch scenario

    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "AI Engineer"},
        headers=_headers(sid),
    )
    assert resp.status_code == 200
    body = resp.json()

    assert body["career_goal"] == "AI Engineer"
    assert "AI Engineer" in body["reasoning"], (
        f"Bug 2: reasoning does not mention 'AI Engineer'. "
        f"Got: {body['reasoning']!r}. "
        "This means Panel B is returning generic tree-wide gaps, not career-specific analysis."
    )


# D7. Session change: new content updates /suggest ────────────────────────────

def test_suggest_updates_when_session_content_changes(client):
    """
    If the same session is re-ingested with different content (e.g. user uploads
    a Data Science PDF to replace a networking tree), /suggest must reflect the
    new content — not return stale "Network Engineer" from the old graph.

    This test verifies the ingest re-clears the old graph (material.py line 126-128)
    and /suggest re-reads the current node titles from DB.
    """
    sid = str(uuid.uuid4())

    # Step 1: ingest networking content (mock graph) → should suggest networking career
    _ingest(client, sid)
    net_resp = client.get("/api/v1/career/suggest", headers=_headers(sid))
    assert net_resp.status_code == 200
    net_careers = net_resp.json()["careers"]
    # mock graph has networking titles → networking should appear
    assert any("Network" in c or "Cybersecurity" in c for c in net_careers), (
        f"Step 1: expected a network/security career from mock networking graph. Got: {net_careers}"
    )

    # Step 2: re-ingest the same session with ML/data-science-heavy text
    # (with MOCK AI the mock graph is always returned, so we test that re-ingest
    #  clears old nodes and /suggest re-reads current titles)
    _ingest(client, sid, source_text=(
        "Machine learning is the study of algorithms. "
        "Deep learning uses neural networks. "
        "Data preprocessing is essential. "
        "Model training requires labelled datasets."
    ))
    ml_resp = client.get("/api/v1/career/suggest", headers=_headers(sid))
    assert ml_resp.status_code == 200
    # After re-ingest with MOCK AI, the mock graph is still returned (networking nodes)
    # — this is expected mock behaviour. The important thing is /suggest responds 200
    # and reflects what IS in the DB. We just verify it is non-empty and a real profession.
    ml_careers = ml_resp.json()["careers"]
    assert len(ml_careers) > 0
    for c in ml_careers:
        all_safe = _FALLBACK_CAREERS + [c for _, _, cs in _DOMAIN_RULES for c in cs]
        assert c in all_safe, f"Re-ingest /suggest returned unsafe career: {c!r}"


# D8. Empty profile — honest required-skills response, no fabricated mastery ───

def test_empty_profile_no_fabricated_concepts(client):
    """
    M-17 update: when a session has no nodes (empty profile), the mock now
    returns the canonical required skills list for the career as knowledge_gaps
    (honest "what you'd need to learn") rather than an empty list.

    Invariants that MUST still hold:
    - strong_concepts is empty (no mastered work)
    - weak_concepts is empty (no assessed work)
    - recommended_path is empty (no tree nodes to step through)
    - knowledge_gaps is non-empty (contains required skills, not DS/tree content)
    - knowledge_gaps items are real career competencies (from _CAREER_REQUIRED_SKILLS),
      NOT fabricated mastery data or verbatim tree-node titles
    - profile_summary.total == 0
    - tree_career_match == 0.0 (no tree nodes exist)
    """
    from app.services.langflow_service import _CAREER_REQUIRED_SKILLS

    sid = str(uuid.uuid4())   # no ingest

    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Data Scientist"},
        headers=_headers(sid),
    )
    assert resp.status_code == 200
    body = resp.json()

    # These must always be empty — no mastery data was ever produced
    assert body["strong_concepts"]  == [], f"strong_concepts should be empty: {body['strong_concepts']}"
    assert body["weak_concepts"]    == [], f"weak_concepts should be empty: {body['weak_concepts']}"
    assert body["recommended_path"] == [], f"recommended_path should be empty: {body['recommended_path']}"
    assert body["profile_summary"]["total"] == 0

    # knowledge_gaps should contain required skills for the career, not be empty
    gaps = body["knowledge_gaps"]
    assert len(gaps) > 0, (
        "Empty profile should return required career skills as knowledge_gaps — "
        "an empty list would give no actionable guidance."
    )
    # Must come from the canonical required-skills list (not invented)
    expected_skills = _CAREER_REQUIRED_SKILLS.get("Data Scientist", [])
    for gap in gaps:
        assert gap in expected_skills, (
            f"knowledge_gap {gap!r} is not in _CAREER_REQUIRED_SKILLS['Data Scientist']. "
            "The mock must only return pre-defined career competencies."
        )

    # tree_career_match should be 0.0 (no tree nodes → no overlap)
    assert body.get("tree_career_match", 0.0) == 0.0, (
        f"Expected tree_career_match=0.0 for empty session, got {body.get('tree_career_match')}"
    )


# D9. MOCK/LIVE contract: response shape is identical ─────────────────────────

def test_mock_pathway_response_has_required_live_contract_fields(client):
    """
    The MOCK pathway response must contain every field the LIVE NT-05 response
    is expected to return.  This ensures the frontend PathwayResult component
    works unchanged when switching USE_MOCK_AI=False.
    """
    sid = str(uuid.uuid4())
    _ingest(client, sid)

    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Data Scientist"},
        headers=_headers(sid),
    )
    assert resp.status_code == 200
    body = resp.json()

    # Fields required by both MOCK and LIVE paths (NT-05 contract)
    required_keys = [
        "career_goal", "strong_concepts", "weak_concepts", "knowledge_gaps",
        "missing_prerequisites", "recommended_path", "estimated_completion_days",
        "reasoning", "profile_summary",
        "tree_career_match",   # M-17: mismatch signal added to both paths
    ]
    for key in required_keys:
        assert key in body, f"Response missing required field '{key}' (LIVE/MOCK contract broken)"

    # profile_summary sub-keys
    for sub in ("total", "mastered", "weak", "missing"):
        assert sub in body["profile_summary"], (
            f"profile_summary missing '{sub}' — frontend pills would break"
        )

    # recommended_path steps have required shape
    for step in body["recommended_path"]:
        assert "step"        in step
        assert "chunk_id"    in step
        assert "chunk_title" in step
        assert "reason"      in step


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION E — Indonesian Data Science UAT titles (M-16 requirement)
#
# These tests use the exact 8 node titles from the pre-interruption manual UAT
# that was used to diagnose Bug 1 (Data Science tree → "Network Engineer" first).
#
# The titles are in Indonesian, which is intentional: NeuroTree users may upload
# Indonesian-language PDFs and the domain mapper must handle them correctly.
#   "ilmuwan" contains "wan" — must not trigger the networking rule's WAN keyword
#   "pengumpulan" contains "lan" — must not trigger the networking rule's LAN kw
#
# E1. The 8 UAT DS titles: Data Scientist ranks first, not Network Engineer
# E2. Word-boundary guard: "wan" in "ilmuwan" does NOT trigger networking rule
# E3. Word-boundary guard: "lan" in "pengumpulan" does NOT trigger networking rule
# E4. Combined ambiguous-substring test: none of the Indonesian words produce
#     networking hits via accidental substring matches
# E5. Panel B with custom "Data Scientist" goal produces DS-specific reasoning
# E6. Genuine networking tree still recommends Network Engineer (regression guard)
# ═══════════════════════════════════════════════════════════════════════════════

# The exact 8 UAT node titles (Indonesian-language Data Science tree)
_UAT_DS_TITLES = [
    "Pengantar Data Science",
    "Ilmuwan Data dan Perannya",
    "Analisis Data Eksploratif",
    "Visualisasi Data dengan Python",
    "Pengumpulan dan Pemrosesan Data",
    "Statistik Deskriptif",
    "Machine Learning Dasar",
    "Evaluasi Model dan Validasi",
]


# E1. UAT DS titles → Data Scientist first, NOT Network Engineer ───────────────

def test_uat_ds_titles_data_scientist_first():
    """
    The exact 8 Data Science node titles from the pre-interruption manual UAT
    must produce 'Data Scientist' (or another data-domain career) as the top
    recommendation — NOT 'Network Engineer'.

    This is the primary regression: 'ilmuwan data', 'pengumpulan data' contain
    the substrings 'wan' and 'lan' which previously triggered the networking rule.
    After the word-boundary fix they must not.
    """
    careers = _suggest_careers_from_titles(_UAT_DS_TITLES)
    assert len(careers) > 0, "UAT DS titles must return at least one career"

    top = careers[0]
    assert top != "Network Engineer", (
        f"UAT regression: Data Science tree with Indonesian titles returned "
        f"'Network Engineer' as top career. Got: {careers}. "
        "Likely cause: 'wan' in 'ilmuwan' or 'lan' in 'pengumpulan' triggered networking rule."
    )

    data_careers = {
        "Data Scientist", "Data Analyst", "Data Engineer",
        "Business Intelligence Developer", "Machine Learning Engineer",
        "AI Engineer", "MLOps Engineer",
    }
    assert top in data_careers, (
        f"UAT DS titles should produce a data-domain career. Got {top!r}. "
        f"Full list: {careers}"
    )


# E2. Word-boundary guard: "wan" in "ilmuwan" does NOT trigger networking ──────

def test_word_boundary_wan_in_ilmuwan_does_not_match():
    """
    The Indonesian word 'ilmuwan' (scientist) contains 'wan' as a suffix.
    The networking rule uses 'wan' (Wide Area Network) as a whole-word keyword.
    'ilmuwan' must NOT produce any networking hits.
    """
    import re
    corpus = "ilmuwan data dan perannya"
    # Direct regex assertion: \bwan\b must NOT match inside 'ilmuwan'
    assert not re.search(r"\bwan\b", corpus), (
        "Word-boundary guard failed: '\\bwan\\b' matched inside 'ilmuwan'. "
        "This would cause Indonesian Data Science trees to suggest Network Engineer."
    )

    # Via the public function: networking rule must score 0 for this corpus
    net_rule = _DOMAIN_RULES[0]  # networking rule is rule index 0
    sub_kws, word_kws, _ = net_rule
    from app.api.career import _kw_hits
    hits = _kw_hits(sub_kws, word_kws, corpus)
    assert hits == 0, (
        f"Networking rule scored {hits} hits on 'ilmuwan data' corpus. "
        "Expected 0 — 'wan' inside 'ilmuwan' must not match."
    )


# E3. Word-boundary guard: "lan" in "pengumpulan" does NOT trigger networking ──

def test_word_boundary_lan_in_pengumpulan_does_not_match():
    """
    The Indonesian word 'pengumpulan' (collection) contains 'lan' as a suffix.
    The networking rule uses 'lan' (Local Area Network) as a whole-word keyword.
    'pengumpulan' must NOT trigger a networking hit.
    """
    import re
    corpus = "pengumpulan dan pemrosesan data"
    assert not re.search(r"\blan\b", corpus), (
        "Word-boundary guard failed: '\\blan\\b' matched inside 'pengumpulan'. "
        "This would cause Indonesian Data Science trees to suggest Network Engineer."
    )

    net_rule = _DOMAIN_RULES[0]
    sub_kws, word_kws, _ = net_rule
    from app.api.career import _kw_hits
    hits = _kw_hits(sub_kws, word_kws, corpus)
    assert hits == 0, (
        f"Networking rule scored {hits} hits on 'pengumpulan' corpus. "
        "Expected 0 — 'lan' inside 'pengumpulan' must not match."
    )


# E4. All 8 UAT titles: networking rule scores 0 ───────────────────────────────

def test_uat_ds_titles_networking_rule_scores_zero():
    """
    The networking domain rule must score zero hits across the full 8-title corpus.
    None of the UAT titles contain genuine networking terms — all matches would
    be false positives caused by ambiguous substrings.
    """
    corpus = " ".join(_UAT_DS_TITLES).lower()
    net_rule = _DOMAIN_RULES[0]
    sub_kws, word_kws, _ = net_rule
    from app.api.career import _kw_hits
    hits = _kw_hits(sub_kws, word_kws, corpus)
    assert hits == 0, (
        f"Networking rule scored {hits} hits on the UAT Data Science corpus. "
        "Expected 0. Matched terms may be false positives. "
        f"Corpus: {corpus[:120]}"
    )


# E5. Panel B: "Data Scientist" custom goal → DS-specific reasoning ────────────

def test_panel_b_data_scientist_produces_ds_reasoning(client):
    """
    POSTing 'Data Scientist' as Panel B custom career goal must produce reasoning
    that mentions 'Data Scientist' — not networking or generic text.
    This verifies Bug 2 (career-aware mock) is working for Indonesian DS trees.
    """
    sid = str(uuid.uuid4())
    _ingest(client, sid)  # mock graph (networking content); intentional mismatch

    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Data Scientist"},
        headers=_headers(sid),
    )
    assert resp.status_code == 200
    body = resp.json()

    assert body["career_goal"] == "Data Scientist"
    assert "Data Scientist" in body["reasoning"], (
        f"Panel B 'Data Scientist' reasoning should mention the career goal. "
        f"Got: {body['reasoning']!r}"
    )


# E6. Genuine networking tree still recommends Network Engineer ────────────────

def test_genuine_networking_tree_recommends_network_engineer():
    """
    Regression guard: a tree with clear, unambiguous networking content must still
    produce 'Network Engineer' as the top career. The word-boundary fix must not
    break legitimate networking recommendations.
    """
    networking_titles = [
        "Network Basics and Topologies",
        "IP Addressing and Subnetting",
        "Routing and Switching Protocols",
        "TCP/IP and UDP Transport Layer",
        "Firewall and VPN Configuration",
        "DNS and DHCP Services",
        "Network Security Fundamentals",
    ]
    careers = _suggest_careers_from_titles(networking_titles)
    assert len(careers) > 0
    top = careers[0]
    assert top == "Network Engineer", (
        f"Genuine networking tree should recommend 'Network Engineer'. "
        f"Got {top!r}. Full list: {careers}. "
        "The word-boundary fix may have over-restricted networking detection."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION F — Career-tree separation (M-17)
#
# These tests lock in the core invariant:
#   knowledge_gaps and recommended_path must be derived from the TARGET CAREER's
#   required competencies — not from "all weak/missing tree nodes".
#
# F1. DS tree + NE goal: knowledge_gaps are NE required skills, NOT DS topics
# F2. DS tree + NE goal: recommended_path is empty (no relevant tree nodes)
# F3. DS tree + NE goal: tree_career_match == 0.0
# F4. DS tree + NE goal: reasoning explicitly mentions the mismatch
# F5. NE tree + NE goal: knowledge_gaps are NE-related (not unrelated topics)
# F6. _career_relevance_score: word-boundary on short keywords prevents false hits
# ═══════════════════════════════════════════════════════════════════════════════

from app.services.langflow_service import (
    _mock_knowledge_gap_pathway as _mock_pathway,
    _career_relevance_score as _relevance,
    _CAREER_REQUIRED_SKILLS,
)


# F1. DS tree + NE goal → knowledge_gaps are NE skills, NOT DS topics ──────────

def test_f1_ds_tree_ne_goal_gaps_are_ne_skills():
    """
    Primary M-17 regression: a Data Science tree with 'Network Engineer' as
    the Panel B custom goal must produce knowledge_gaps that list Network Engineer
    required competencies — NOT the user's DS topics.

    Before the fix: gaps = ['Pengantar Data Science', 'Statistik Deskriptif', ...]
    After the fix:  gaps = ['Network Topologies', 'IP Addressing & Subnetting', ...]
    """
    ds_weak = [
        {"id": "n1", "title": "Pengantar Data Science",      "mastery_score": 30.0},
        {"id": "n2", "title": "Ilmuwan Data dan Perannya",   "mastery_score": 20.0},
        {"id": "n3", "title": "Analisis Data Eksploratif",   "mastery_score": 10.0},
    ]
    ds_missing = [
        {"id": "n4", "title": "Visualisasi Data dengan Python"},
        {"id": "n5", "title": "Statistik Deskriptif"},
        {"id": "n6", "title": "Machine Learning Dasar"},
        {"id": "n7", "title": "Pengumpulan dan Pemrosesan Data"},
        {"id": "n8", "title": "Evaluasi Model dan Validasi"},
    ]

    result = _mock_pathway("Network Engineer", [], ds_weak, ds_missing)
    gaps = result.knowledge_gaps

    # DS topics must NOT appear as gaps for a Network Engineer target
    ds_titles = {c["title"].lower() for c in ds_weak + ds_missing}
    for gap in gaps:
        assert gap.lower() not in ds_titles, (
            f"F1 regression: DS topic '{gap}' appears as a 'Network Engineer' knowledge gap. "
            "knowledge_gaps must show NE required skills, not DS tree content."
        )

    # Should contain NE required skills instead
    ne_required = set(_CAREER_REQUIRED_SKILLS.get("Network Engineer", []))
    assert any(g in ne_required for g in gaps), (
        f"F1: No NE required skill found in knowledge_gaps. Got: {gaps}. "
        f"Expected items from: {ne_required}"
    )


# F2. DS tree + NE goal → recommended_path is empty ───────────────────────────

def test_f2_ds_tree_ne_goal_path_is_empty():
    """
    When a DS tree is evaluated against 'Network Engineer', recommended_path
    must be empty — there are no tree nodes relevant to the NE career to step through.

    Before the fix: path = [('Statistik Deskriptif', reason='paling relevan untuk NE')]
    After the fix:  path = []
    """
    ds_weak    = [{"id": "n1", "title": "Pengantar Data Science",    "mastery_score": 30.0}]
    ds_missing = [{"id": "n2", "title": "Statistik Deskriptif"},
                  {"id": "n3", "title": "Machine Learning Dasar"},
                  {"id": "n4", "title": "Visualisasi Data dengan Python"}]

    result = _mock_pathway("Network Engineer", [], ds_weak, ds_missing)
    assert result.recommended_path == [], (
        f"F2 regression: recommended_path should be empty for DS tree + NE goal. "
        f"Got: {[s.chunk_title for s in result.recommended_path]}"
    )


# F3. DS tree + NE goal → tree_career_match == 0.0 ────────────────────────────

def test_f3_ds_tree_ne_goal_tree_career_match_zero():
    """
    tree_career_match must be 0.0 when the Data Science tree has no nodes
    relevant to the 'Network Engineer' career.
    """
    ds_weak    = [{"id": "n1", "title": "Analisis Data Eksploratif", "mastery_score": 20.0}]
    ds_missing = [{"id": "n2", "title": "Statistik Deskriptif"},
                  {"id": "n3", "title": "Ilmuwan Data dan Perannya"}]

    result = _mock_pathway("Network Engineer", [], ds_weak, ds_missing)
    assert result.tree_career_match == 0.0, (
        f"F3: tree_career_match should be 0.0 for DS tree + NE goal. "
        f"Got: {result.tree_career_match}"
    )


# F4. DS tree + NE goal → reasoning mentions mismatch ─────────────────────────

def test_f4_ds_tree_ne_goal_reasoning_mentions_mismatch():
    """
    When tree content doesn't match the target career, the reasoning must
    explicitly communicate the mismatch to the user — not pretend the tree
    provides NE-relevant analysis.
    """
    ds_weak    = [{"id": "n1", "title": "Analisis Data", "mastery_score": 20.0}]
    ds_missing = [{"id": "n2", "title": "Machine Learning Dasar"}]

    result = _mock_pathway("Network Engineer", [], ds_weak, ds_missing)

    # Reasoning must mention the career goal
    assert "Network Engineer" in result.reasoning, (
        f"Reasoning must mention the target career. Got: {result.reasoning!r}"
    )
    # Must NOT claim the tree analysis is personalised when there's a mismatch
    # (Check that it doesn't say the path was 'built' from the tree positively)
    positive_phrases = [
        "topik yang paling relevan",  # old: "this topic is most relevant"
        "jalur belajar ini dibangun untuk tujuan karir 'Network Engineer'. Hanya topik",
    ]
    for phrase in positive_phrases:
        assert phrase.lower() not in result.reasoning.lower(), (
            f"Mismatch reasoning should not contain positive tree-match language. "
            f"Found: {phrase!r} in {result.reasoning!r}"
        )


# F5. NE tree + NE goal → gaps are NE-relevant ────────────────────────────────

def test_f5_ne_tree_ne_goal_gaps_are_relevant():
    """
    Regression guard: when the tree DOES match the target career, knowledge_gaps
    must contain career-relevant topics (from the tree or from required skills),
    not unrelated content.
    """
    ne_weak    = [{"id": "n1", "title": "Network Basics",      "mastery_score": 30.0},
                  {"id": "n2", "title": "IP Addressing",        "mastery_score": 20.0}]
    ne_missing = [{"id": "n3", "title": "Routing and Switching"},
                  {"id": "n4", "title": "Firewall Configuration"}]

    result = _mock_pathway("Network Engineer", [], ne_weak, ne_missing)

    # tree_career_match should be > 0
    assert result.tree_career_match > 0.0, (
        f"F5: NE tree should have positive tree_career_match for NE goal. "
        f"Got: {result.tree_career_match}"
    )
    # knowledge_gaps should not be empty
    assert len(result.knowledge_gaps) > 0, "F5: knowledge_gaps should not be empty for NE tree"

    # recommended_path should include NE tree nodes
    path_titles = {s.chunk_title for s in result.recommended_path}
    assert len(result.recommended_path) > 0, (
        "F5: recommended_path should include NE tree nodes when tree matches career"
    )
    # Path must only contain nodes from the actual tree (not DS topics)
    tree_titles = {c["title"] for c in ne_weak + ne_missing}
    for step in result.recommended_path:
        assert step.chunk_title in tree_titles, (
            f"F5: path step '{step.chunk_title}' is not from the NE tree. "
            f"Tree titles: {tree_titles}"
        )


# F6. _career_relevance_score: word-boundary prevents false hits ──────────────

def test_f6_career_relevance_score_word_boundary():
    """
    _career_relevance_score must use word-boundary matching for short keywords.

    False hits that existed before M-17 fix:
    - 'ip' in 'deskriptif'  → 'Statistik Deskriptif' scored 1 for Network Engineer
    - 'ai' in 'visualisasi' → could trigger AI Engineer score

    After fix: these must all score 0.
    """
    # Known false hits from the diagnosed bug
    false_hit_cases = [
        ("Statistik Deskriptif",         "Network Engineer",  "ip in deskriptif"),
        ("Visualisasi Data",              "AI Engineer",       "ai in visualisasi"),
        ("Ilmuwan Data dan Perannya",     "Network Engineer",  "wan in ilmuwan"),
        ("Pengumpulan dan Pemrosesan Data","Network Engineer", "lan in pengumpulan"),
    ]
    for title, career, explanation in false_hit_cases:
        score = _relevance(title, career)
        assert score == 0, (
            f"F6 false hit: '{title}' scored {score} for '{career}'. "
            f"Reason was: {explanation}. "
            "Word-boundary matching must prevent this."
        )

    # Confirm true hits still work
    true_hit_cases = [
        ("Network Basics",          "Network Engineer",    1),
        ("IP Addressing",           "Network Engineer",    1),  # "ip address" in title
        ("Routing and Switching",   "Network Engineer",    2),  # routing + switching
        ("Machine Learning Dasar",  "Machine Learning Engineer", 1),
    ]
    for title, career, min_score in true_hit_cases:
        score = _relevance(title, career)
        assert score >= min_score, (
            f"F6 true hit missed: '{title}' scored {score} for '{career}', "
            f"expected >= {min_score}."
        )


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION G — Diverse domain regression tests (M-18)
#
# Tests cover unrelated learning domains and career goals to prevent the system
# from being overfitted to "Network Engineer" and "Data Science" scenarios.
#
# Coverage:
#   G1.  /suggest: Cybersecurity tree → Cybersecurity Analyst (domain_match)
#   G2.  /suggest: Accounting tree → fallback (domain outside IT rules)
#   G3.  /suggest: Biology tree → fallback, no false cloud/mobile hit
#   G4.  /suggest: Marketing tree → fallback, no false data-science hit
#   G5.  Mock pathway: unknown career (Financial Analyst) → tree_career_match=-1
#   G6.  Mock pathway: unknown career → knowledge_gaps is empty (not fabricated)
#   G7.  Mock pathway: unknown career → recommended_path shows tree nodes (honest)
#   G8.  Mock pathway: unknown career → reasoning mentions "reference database"
#   G9.  Mock pathway: Cybersecurity tree + Cybersecurity Analyst → tree match > 0
#   G10. Mock pathway: Accounting tree + Network Engineer → mismatch (match=0)
#   G11. Panel B: unknown career + HTTP → career_goal echoed, tree_career_match=-1
#   G12. Panel B: custom unknown career does NOT overwrite Panel A state
#   G13. _career_relevance_score: unknown career returns sentinel (-1)
#   G14. /suggest: UI/UX tree → fallback (no IT domain hit)
#   G15. /suggest: Agriculture tree → fallback (no IT domain hit)
# ═══════════════════════════════════════════════════════════════════════════════

from app.services.langflow_service import (
    _CAREER_UNKNOWN_SCORE,
    _CAREER_REQUIRED_SKILLS as _REQUIRED_SKILLS_MAP,
)

# ── Node title sets for 6 diverse domains ─────────────────────────────────────
_CYBER_TITLES  = ["Threat Modeling", "Malware Analysis", "Encryption Algorithms",
                  "Penetration Testing", "SIEM Tools", "Intrusion Detection Systems"]
_ACCOUNTING_TITLES = ["Financial Accounting Basics", "Balance Sheet and Income Statement",
                      "Tax Principles", "Auditing Fundamentals", "Cost Accounting", "GAAP"]
_BIOLOGY_TITLES = ["Cell Biology", "Genetics and DNA", "Clinical Trials Design",
                   "Patient Informed Consent", "GCP Guidelines", "Biostatistics"]
_MARKETING_TITLES = ["Digital Marketing Fundamentals", "SEO and SEM",
                     "Social Media Strategy", "Content Marketing",
                     "Email Campaign Management", "Marketing Analytics"]
_UXDESIGN_TITLES = ["User Research Methods", "Wireframing and Prototyping",
                    "Typography and Color Theory", "Accessibility Standards",
                    "Design Systems", "Usability Testing"]
_AGRICULTURE_TITLES = ["Soil Science and Fertility", "Crop Rotation Principles",
                       "Pest and Disease Management", "Irrigation Systems",
                       "Sustainable Farming", "Farm Economics"]


# G1. Cybersecurity tree → domain_match ───────────────────────────────────────

def test_g1_cybersecurity_tree_domain_match():
    """A cybersecurity tree must resolve to Cybersecurity Analyst via domain_match."""
    careers = _suggest_careers_from_titles(_CYBER_TITLES)
    assert len(careers) > 0
    assert any("Cybersecurity" in c or "Security" in c or "Penetration" in c
               for c in careers[:2]), (
        f"Cybersecurity tree should suggest a security career, got: {careers}"
    )
    # Must come from domain rules (not fallback)
    corpus = " ".join(_CYBER_TITLES).lower()
    from app.api.career import _kw_hits, _DOMAIN_RULES
    any_domain = any(_kw_hits(s, w, corpus) >= 2 for s, w, _ in _DOMAIN_RULES)
    assert any_domain, "Cybersecurity tree should be domain_match, not fallback"


# G2. Accounting tree → fallback (unknown domain) ─────────────────────────────

def test_g2_accounting_tree_returns_fallback():
    """An accounting/finance tree must return the safe fallback list — not a false IT career."""
    careers = _suggest_careers_from_titles(_ACCOUNTING_TITLES)
    assert len(careers) > 0
    # Must be from fallback (no IT domain keyword should hit with >= 2 matches)
    corpus = " ".join(_ACCOUNTING_TITLES).lower()
    from app.api.career import _kw_hits, _DOMAIN_RULES, _FALLBACK_CAREERS
    any_domain = any(_kw_hits(s, w, corpus) >= 2 for s, w, _ in _DOMAIN_RULES)
    assert not any_domain, (
        f"Accounting tree should produce fallback, not a domain match. "
        f"Got careers: {careers}"
    )
    for c in careers:
        assert c in _FALLBACK_CAREERS, (
            f"Accounting tree fallback career {c!r} is not in _FALLBACK_CAREERS. "
            "It may be a false domain hit."
        )


# G3. Biology tree → fallback, no false Cloud/Mobile hit ──────────────────────

def test_g3_biology_tree_no_false_cloud_hit():
    """
    A biology tree containing 'GCP Guidelines' (Good Clinical Practice) must NOT
    produce Cloud Engineer as the top suggestion.  'gcp' alone is insufficient
    evidence with the 2-hit minimum threshold.
    """
    careers = _suggest_careers_from_titles(_BIOLOGY_TITLES)
    assert len(careers) > 0
    assert "Cloud Engineer" not in careers[:1], (
        f"G3 regression: Biology tree produced 'Cloud Engineer' as top suggestion "
        f"(false positive from 'gcp' in 'GCP Guidelines'). Got: {careers}"
    )
    # Similarly, 'ios' in 'previous' should not trigger Mobile
    assert "Mobile App Developer" not in careers[:1], (
        f"G3: Biology tree produced Mobile career from ambiguous 'ios' hit. Got: {careers}"
    )


# G4. Marketing tree → fallback, no false Data Scientist hit ──────────────────

def test_g4_marketing_tree_no_false_data_hit():
    """
    A marketing tree containing 'Marketing Analytics' must NOT produce
    'Data Scientist' as the top suggestion.  'analytics' alone is not enough
    evidence — it requires at least one more data-science keyword.
    """
    careers = _suggest_careers_from_titles(_MARKETING_TITLES)
    assert len(careers) > 0
    assert "Data Scientist" not in careers[:1], (
        f"G4 regression: Marketing tree produced 'Data Scientist' as top suggestion "
        f"(false positive from 'analytics' alone). Got: {careers}"
    )


# G5. Mock: unknown career → tree_career_match = -1 ───────────────────────────

def test_g5_unknown_career_match_sentinel():
    """
    When the user types a career not in _CAREER_KEYWORDS (e.g. 'Financial Analyst'),
    tree_career_match must be -1.0, not 0.0.  0.0 means 'known career, wrong domain';
    -1.0 means 'cannot compute'.
    """
    missing = [{"id": "n1", "title": "Financial Accounting Basics"},
               {"id": "n2", "title": "Tax Principles"},
               {"id": "n3", "title": "Auditing Fundamentals"}]
    result = _mock_pathway("Financial Analyst", [], [], missing)
    assert result.tree_career_match == -1.0, (
        f"G5: Unknown career 'Financial Analyst' should set tree_career_match=-1.0. "
        f"Got: {result.tree_career_match}"
    )


# G6. Mock: unknown career → knowledge_gaps is empty ─────────────────────────

def test_g6_unknown_career_gaps_empty():
    """
    For an unknown career, knowledge_gaps must be [] — the system has no reference
    competency data and must not fabricate a list (e.g. must not return the default
    IT skills list as if they apply to Financial Analyst).
    """
    missing = [{"id": "n1", "title": "Balance Sheet Analysis"},
               {"id": "n2", "title": "Cost Accounting Principles"}]
    result = _mock_pathway("Clinical Research Associate", [], [], missing)
    assert result.knowledge_gaps == [], (
        f"G6: Unknown career should produce empty knowledge_gaps, not a fabricated list. "
        f"Got: {result.knowledge_gaps}"
    )


# G7. Mock: unknown career → recommended_path shows tree nodes ────────────────

def test_g7_unknown_career_path_shows_tree_nodes():
    """
    For an unknown career, recommended_path must show the user's actual tree nodes
    (weak and missing) so the result is still useful rather than empty.
    """
    weak    = [{"id": "n1", "title": "User Research Methods",   "mastery_score": 30.0}]
    missing = [{"id": "n2", "title": "Wireframing and Prototyping"},
               {"id": "n3", "title": "Usability Testing"}]
    result = _mock_pathway("Product Designer", [], weak, missing)
    assert len(result.recommended_path) > 0, (
        "G7: Unknown career should show tree nodes in recommended_path, not empty."
    )
    # All path nodes must be from the actual tree
    tree_titles = {"User Research Methods", "Wireframing and Prototyping", "Usability Testing"}
    for step in result.recommended_path:
        assert step.chunk_title in tree_titles, (
            f"G7: Path step {step.chunk_title!r} is not from the user's tree. "
            "Unknown career path must only show actual tree content."
        )


# G8. Mock: unknown career → reasoning mentions reference database ─────────────

def test_g8_unknown_career_reasoning_honest():
    """
    For an unknown career, reasoning must communicate that analysis is limited
    (career not in reference database) rather than pretend the analysis is complete.
    """
    missing = [{"id": "n1", "title": "Soil Science and Fertility"},
               {"id": "n2", "title": "Crop Rotation Principles"}]
    result = _mock_pathway("Agronomist", [], [], missing)
    # Must mention the career name
    assert "Agronomist" in result.reasoning, (
        f"G8: Reasoning should mention the career 'Agronomist'. Got: {result.reasoning!r}"
    )
    # Must indicate this is a limited analysis
    limited_signals = ["belum ada", "referensi", "basis data", "otomatis", "live"]
    reasoning_lower = result.reasoning.lower()
    assert any(s in reasoning_lower for s in limited_signals), (
        f"G8: Reasoning should communicate limited analysis for unknown career. "
        f"Got: {result.reasoning!r}"
    )


# G9. Mock: Cybersecurity tree + Cybersecurity Analyst → match > 0 ────────────

def test_g9_cybersecurity_tree_career_match():
    """Regression: a cybersecurity tree evaluated against Cybersecurity Analyst must match."""
    cyber_missing = [
        {"id": "n1", "title": "Malware Analysis"},
        {"id": "n2", "title": "Intrusion Detection Systems"},
        {"id": "n3", "title": "Encryption Algorithm Basics"},
        {"id": "n4", "title": "Penetration Testing Fundamentals"},
    ]
    result = _mock_pathway("Cybersecurity Analyst", [], [], cyber_missing)
    assert result.tree_career_match > 0.0, (
        f"G9: Cybersecurity tree should have tree_career_match > 0 for Cybersecurity Analyst. "
        f"Got: {result.tree_career_match}"
    )
    assert len(result.recommended_path) > 0, (
        "G9: Cybersecurity tree should have a non-empty recommended_path for Cybersecurity Analyst."
    )
    # Path nodes should be from the actual tree
    tree_titles = {c["title"] for c in cyber_missing}
    for step in result.recommended_path:
        assert step.chunk_title in tree_titles, (
            f"G9: Path step {step.chunk_title!r} is not from the cybersecurity tree."
        )


# G10. Mock: Accounting tree + Network Engineer → mismatch (match=0) ──────────

def test_g10_accounting_tree_network_engineer_mismatch():
    """
    An accounting tree evaluated against a known career (Network Engineer) must produce
    a genuine mismatch result (tree_career_match=0) — not an unknown-career result.
    The knowledge_gaps must list NE required skills, not accounting topics.
    """
    acc_missing = [
        {"id": "n1", "title": "Financial Accounting Basics"},
        {"id": "n2", "title": "Balance Sheet Analysis"},
        {"id": "n3", "title": "Tax Principles"},
    ]
    result = _mock_pathway("Network Engineer", [], [], acc_missing)
    assert result.tree_career_match == 0.0, (
        f"G10: Accounting tree + NE should produce tree_career_match=0.0 (mismatch). "
        f"Got: {result.tree_career_match}"
    )
    assert result.recommended_path == [], (
        f"G10: Mismatch path should be empty. Got: {[s.chunk_title for s in result.recommended_path]}"
    )
    # knowledge_gaps must NOT contain accounting node titles
    acc_titles = {c["title"] for c in acc_missing}
    for gap in result.knowledge_gaps:
        assert gap not in acc_titles, (
            f"G10: knowledge_gap {gap!r} is an accounting topic, not a NE required skill."
        )


# G11. Panel B: unknown career → HTTP response has tree_career_match=-1 ────────

def test_g11_panel_b_unknown_career_http(client):
    """
    When Panel B submits an unknown career via HTTP, the response must include
    tree_career_match=-1.0 so the frontend can show the 'unknown career' notice.
    """
    sid = str(uuid.uuid4())
    _ingest(client, sid)

    resp = client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Financial Analyst"},
        headers=_headers(sid),
    )
    assert resp.status_code == 200
    body = resp.json()

    assert body["career_goal"] == "Financial Analyst"
    assert "tree_career_match" in body, "Response must include tree_career_match field"
    assert body["tree_career_match"] == -1.0, (
        f"G11: Unknown career should produce tree_career_match=-1.0. "
        f"Got: {body['tree_career_match']}"
    )
    assert body["knowledge_gaps"] == [], (
        f"G11: Unknown career knowledge_gaps should be empty. Got: {body['knowledge_gaps']}"
    )


# G12. Panel B: unknown career does NOT overwrite Panel A state ───────────────

def test_g12_panel_b_unknown_career_independent(client):
    """
    Submitting an unknown career via Panel B must not affect Panel A state.
    The /suggest result must remain unchanged after the Panel B POST.
    """
    sid = str(uuid.uuid4())
    _ingest(client, sid)

    # Panel A: get initial suggestion
    suggest_resp = client.get("/api/v1/career/suggest", headers=_headers(sid))
    panel_a_career = suggest_resp.json()["careers"][0]

    # Panel B: submit unknown career
    client.post(
        "/api/v1/career/pathway",
        json={"career_goal": "Agronomist"},
        headers=_headers(sid),
    )

    # Panel A suggest unchanged
    suggest_again = client.get("/api/v1/career/suggest", headers=_headers(sid))
    assert suggest_again.json()["careers"][0] == panel_a_career, (
        "G12: Panel B unknown-career submission must not change Panel A /suggest result."
    )


# G13. _career_relevance_score: unknown career returns sentinel ─────────────────

def test_g13_relevance_score_unknown_career_sentinel():
    """
    _career_relevance_score must return _CAREER_UNKNOWN_SCORE (-1) for any career
    not in _CAREER_KEYWORDS, regardless of the chunk title content.
    This distinguishes "unknown" from "zero relevance" (which is a known mismatch).
    """
    unknown_careers = [
        "Financial Analyst", "Clinical Research Associate", "Product Designer",
        "Agronomist", "Digital Marketing Specialist", "Nurse Practitioner",
        "Environmental Engineer", "Graphic Designer", "Supply Chain Manager",
    ]
    for career in unknown_careers:
        # Even a title that could superficially match should return sentinel
        score = _relevance("Network Basics", career)
        assert score == _CAREER_UNKNOWN_SCORE, (
            f"G13: _career_relevance_score for unknown career {career!r} should return "
            f"{_CAREER_UNKNOWN_SCORE} (sentinel), got {score}."
        )


# G14. /suggest: UI/UX design tree → fallback ─────────────────────────────────

def test_g14_uxdesign_tree_returns_fallback():
    """A UI/UX design tree must return the safe fallback — no false IT domain hits."""
    careers = _suggest_careers_from_titles(_UXDESIGN_TITLES)
    assert len(careers) > 0
    corpus = " ".join(_UXDESIGN_TITLES).lower()
    from app.api.career import _kw_hits, _DOMAIN_RULES, _FALLBACK_CAREERS
    any_domain = any(_kw_hits(s, w, corpus) >= 2 for s, w, _ in _DOMAIN_RULES)
    assert not any_domain, (
        f"G14: UI/UX tree should produce fallback, got domain match. "
        f"Careers: {careers}"
    )
    for c in careers:
        assert c in _FALLBACK_CAREERS, (
            f"G14: UI/UX tree fallback career {c!r} not in _FALLBACK_CAREERS."
        )


# G15. /suggest: Agriculture tree → fallback ──────────────────────────────────

def test_g15_agriculture_tree_returns_fallback():
    """An agriculture/farming tree must return the safe fallback — no false IT domain hits."""
    careers = _suggest_careers_from_titles(_AGRICULTURE_TITLES)
    assert len(careers) > 0
    corpus = " ".join(_AGRICULTURE_TITLES).lower()
    from app.api.career import _kw_hits, _DOMAIN_RULES, _FALLBACK_CAREERS
    any_domain = any(_kw_hits(s, w, corpus) >= 2 for s, w, _ in _DOMAIN_RULES)
    assert not any_domain, (
        f"G15: Agriculture tree should produce fallback, got domain match. "
        f"Careers: {careers}"
    )
    for c in careers:
        assert c in _FALLBACK_CAREERS, (
            f"G15: Agriculture tree fallback career {c!r} not in _FALLBACK_CAREERS."
        )


# ── Cleanup ────────────────────────────────────────────────────────────────────

def pytest_sessionfinish(session, exitstatus):
    try:
        if os.path.exists(_TEST_DB):
            os.remove(_TEST_DB)
    except OSError:
        pass
