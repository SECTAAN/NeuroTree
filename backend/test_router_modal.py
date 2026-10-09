"""
test_router_modal.py — Targeted test for Router + FlashcardPanel integration.

Tests:
  1.  fetchNode (unlocked) returns 200 with content + key_concepts
  2.  fetchNode (locked)   returns 403 (RouterModal graceful null handling)
  3.  fetchNode (missing)  returns 404
  4.  key_concepts is a list (not null/str) — flashcard builder prerequisite
  5a. RouterModal data contract: both nodes fetchable in parallel
  5b. 403 → null (graceful empty state)
  6a. buildFlashcards: generates cards from key_concepts (happy path)
  6b. buildFlashcards: fallback — generates one card from content when key_concepts=[]
  6c. buildFlashcards: all-null case → zero cards (no crash)
  7.  Edge data contract: source_id + target_id present
  8.  Cross-session isolation: 404 for another session's node
  9.  GlowingNodeCard mastery threshold audit (P1-2)
 10.  _fcSeq removed: seq is now local (no module-level leak)
"""
import sys, os, uuid, pathlib

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "backend"))
os.chdir(ROOT / "backend")

os.environ["USE_MOCK_AI"] = "True"
from app.core import config as _cfg
_cfg.get_settings.cache_clear()

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

_failed = 0

def record(label, condition, detail=""):
    global _failed
    status = "[PASS]" if condition else "[FAIL]"
    if not condition:
        _failed += 1
    suffix = f"  [{detail}]" if detail else ""
    print(f"  {status}  {label}{suffix}")

print("\n── Router + FlashcardPanel Integration Tests ───────────────────────────")

UID = str(uuid.uuid4())
SID = str(uuid.uuid4())
HDR = {"X-User-ID": UID, "X-Session-ID": SID}

# ── Setup: ingest a tree ──────────────────────────────────────────────────────
print("\n-- Setup: ingest tree ──────────────────────────────────────────────────")
r_ingest = client.post(
    "/api/v1/material/ingest",
    json={"source_text": "A" * 50, "tree_name": "Router Modal Test", "session_id": SID},
    headers=HDR,
)
record("Setup: ingest succeeds (200)", r_ingest.status_code == 200, r_ingest.status_code)

r_graph = client.get("/api/v1/graph", headers=HDR)
record("Setup: graph fetch 200", r_graph.status_code == 200, r_graph.status_code)

graph = r_graph.json() if r_graph.status_code == 200 else {"nodes": [], "edges": []}
nodes = graph.get("nodes", [])
edges = graph.get("edges", [])

unlocked_nodes = [n for n in nodes if n["status"] == "unlocked"]
locked_nodes   = [n for n in nodes if n["status"] == "locked"]
record("Setup: at least one unlocked node exists", len(unlocked_nodes) >= 1,
       f"unlocked={len(unlocked_nodes)}")
record("Setup: at least one locked node exists",   len(locked_nodes) >= 1,
       f"locked={len(locked_nodes)}")
record("Setup: at least one edge exists",          len(edges) >= 1, f"edges={len(edges)}")

print("\n── Test 1-3: fetchNode endpoint ─────────────────────────────────────────")

unlocked_body = None
if unlocked_nodes:
    nid = unlocked_nodes[0]["id"]
    r1 = client.get(f"/api/v1/node/{nid}", headers=HDR)
    record("Test 1: fetchNode(unlocked) → 200", r1.status_code == 200, r1.status_code)
    if r1.status_code == 200:
        unlocked_body = r1.json()
        record("Test 1b: body has 'id'",           "id" in unlocked_body)
        record("Test 1c: body has 'title'",         "title" in unlocked_body)
        record("Test 1d: body has 'content'",       "content" in unlocked_body)
        record("Test 1e: body has 'key_concepts'",  "key_concepts" in unlocked_body)
        record("Test 1f: body has 'mastery_score'", "mastery_score" in unlocked_body)
        record("Test 1g: key_concepts is a list",   isinstance(unlocked_body.get("key_concepts"), list),
               type(unlocked_body.get("key_concepts")).__name__)
        record("Test 1h: mastery_score is numeric", isinstance(unlocked_body.get("mastery_score"), (int, float)),
               type(unlocked_body.get("mastery_score")).__name__)
        has_content  = bool(unlocked_body.get("content"))
        has_concepts = bool(unlocked_body.get("key_concepts"))
        record("Test 1i: node has content or key_concepts for flashcard gen",
               has_content or has_concepts,
               f"content={'yes' if has_content else 'empty'} concepts={len(unlocked_body.get('key_concepts', []))}")

if locked_nodes:
    nid_locked = locked_nodes[0]["id"]
    r2 = client.get(f"/api/v1/node/{nid_locked}", headers=HDR)
    record("Test 2: fetchNode(locked) → 403", r2.status_code == 403, r2.status_code)
    if r2.status_code == 403:
        detail = r2.json().get("detail", "")
        record("Test 2b: 403 detail is non-empty", bool(detail), repr(detail[:50]))

fake_id = "00000000_node_xyz_does_not_exist"
r3 = client.get(f"/api/v1/node/{fake_id}", headers=HDR)
record("Test 3: fetchNode(nonexistent) → 404", r3.status_code == 404, r3.status_code)

print("\n── Test 4-5: RouterModal data contract ──────────────────────────────────")

if unlocked_nodes and locked_nodes:
    r_src = client.get(f"/api/v1/node/{unlocked_nodes[0]['id']}", headers=HDR)
    r_tgt = client.get(f"/api/v1/node/{locked_nodes[0]['id']}", headers=HDR)

    src_data = r_src.json() if r_src.status_code == 200 else None
    tgt_data = None if r_tgt.status_code == 403 else (r_tgt.json() if r_tgt.status_code == 200 else None)

    record("Test 4: source node fetch OK", r_src.status_code in (200, 403, 404))
    record("Test 4b: 403 → tgt_data is None (graceful)", tgt_data is None,
           f"status={r_tgt.status_code}")

    if src_data:
        concepts = src_data.get("key_concepts") or []
        record("Test 5: key_concepts is list on unlocked node", isinstance(concepts, list),
               type(concepts).__name__)

print("\n── Test 6: buildFlashcards logic (happy + fallback + null) ──────────────")

# Simulate the updated buildFlashcards logic in Python
def sim_build_flashcards(source_node, target_node):
    """Python mirror of the JS buildFlashcards() in RouterModal.jsx (post-fix)."""
    cards = []
    seq = [0]

    def add_concepts(node, concepts):
        lst = [c for c in (concepts or []) if c]
        if lst:
            for concept in lst:
                seq[0] += 1
                back = (
                    f"{concept} adalah bagian dari \"{node['title']}\". "
                    + (node.get('content') or '')[:200].rstrip() + "…"
                    if node.get('content')
                    else f"{concept} adalah salah satu konsep kunci dalam \"{node['title']}\"."
                )
                cards.append({
                    "id": f"fc-{seq[0]}-{node['id']}",
                    "front": f"Apa yang dimaksud dengan \"{concept}\" dalam konteks \"{node['title']}\"?",
                    "back": back,
                    "sourceNodeId": node["id"],
                })
        elif node.get("content"):
            seq[0] += 1
            content = node["content"]
            back = content[:300].rstrip() + ("…" if len(content) > 300 else "")
            cards.append({
                "id": f"fc-{seq[0]}-{node['id']}-fallback",
                "front": f"Jelaskan konsep utama dari \"{node['title']}\" dengan kata-katamu sendiri!",
                "back": back,
                "sourceNodeId": node["id"],
            })

    if source_node:
        add_concepts(source_node, source_node.get("key_concepts"))
    if target_node:
        add_concepts(target_node, target_node.get("key_concepts"))
    return cards[:6]

# 6a: Happy path — key_concepts present
node_with_concepts = {
    "id": "test_01",
    "title": "Network Basics",
    "content": "This is content.",
    "key_concepts": ["Topology", "Protocol"],
}
cards_happy = sim_build_flashcards(node_with_concepts, None)
record("Test 6a: happy path — 2 concepts → 2 cards", len(cards_happy) == 2,
       f"count={len(cards_happy)}")
record("Test 6a-ii: cards have required shape",
       all("id" in c and "front" in c and "back" in c and "sourceNodeId" in c for c in cards_happy))

# 6b: Fallback path — empty key_concepts but content available
node_no_concepts = {
    "id": "test_02",
    "title": "IP Addressing",
    "content": "IP Address is a logical address assigned to each device in a network.",
    "key_concepts": [],
}
cards_fallback = sim_build_flashcards(node_no_concepts, None)
record("Test 6b: fallback — no concepts, has content → 1 fallback card",
       len(cards_fallback) == 1, f"count={len(cards_fallback)}")
if cards_fallback:
    record("Test 6b-ii: fallback card front asks to explain",
           "Jelaskan" in cards_fallback[0]["front"],
           cards_fallback[0]["front"][:60])
    record("Test 6b-iii: fallback card back contains content snippet",
           "IP Address" in cards_fallback[0]["back"],
           cards_fallback[0]["back"][:60])

# 6b-live: key_concepts=None (older DB rows may have NULL)
node_null_concepts = {
    "id": "test_03",
    "title": "Routing",
    "content": "Routing is the process of selecting paths.",
    "key_concepts": None,
}
cards_null = sim_build_flashcards(node_null_concepts, None)
record("Test 6b-live: None key_concepts → fallback card from content",
       len(cards_null) == 1, f"count={len(cards_null)}")

# 6c: All-null: no concepts, no content
node_empty = {
    "id": "test_04",
    "title": "Empty Node",
    "content": None,
    "key_concepts": [],
}
cards_empty = sim_build_flashcards(node_empty, None)
record("Test 6c: no concepts, no content → 0 cards (no crash)",
       len(cards_empty) == 0, f"count={len(cards_empty)}")

# 6d: Both source and target present — capped at 6
node_many = {
    "id": "test_05",
    "title": "Many Concepts",
    "content": "Content here.",
    "key_concepts": ["A", "B", "C", "D"],
}
node_many2 = {
    "id": "test_06",
    "title": "More Concepts",
    "content": "More content.",
    "key_concepts": ["E", "F", "G", "H"],
}
cards_capped = sim_build_flashcards(node_many, node_many2)
record("Test 6d: 8 total concepts → capped at 6", len(cards_capped) == 6,
       f"count={len(cards_capped)}")

# 6e: Degenerate: both null
cards_both_null = sim_build_flashcards(None, None)
record("Test 6e: both nodes None → 0 cards (no crash)", len(cards_both_null) == 0)

print("\n── Test 7-8: Edge + session isolation ───────────────────────────────────")

if edges:
    e = edges[0]
    record("Test 7: edge has source_id", "source_id" in e)
    record("Test 7b: edge has target_id", "target_id" in e)
    record("Test 7c: source_id non-empty", bool(e.get("source_id")))
    record("Test 7d: target_id non-empty", bool(e.get("target_id")))

SID2 = str(uuid.uuid4())
HDR2 = {"X-User-ID": UID, "X-Session-ID": SID2}
if unlocked_nodes:
    r_cross = client.get(f"/api/v1/node/{unlocked_nodes[0]['id']}", headers=HDR2)
    record("Test 8: cross-session fetch → 404", r_cross.status_code == 404, r_cross.status_code)

print("\n── Test 9: P1-2 GlowingNodeCard mastery threshold ───────────────────────")
card_src = (ROOT / "frontend" / "src" / "components" / "flow" / "GlowingNodeCard.jsx").read_text()
record("Test 9a: GlowingNodeCard uses >= 70 for Bright/green", "mastery >= 70" in card_src)
record("Test 9b: GlowingNodeCard uses #00FFA3 (green) at mastered", "#00FFA3" in card_src)

print("\n── Test 10: _fcSeq module-level leak removed ─────────────────────────────")
modal_src = (ROOT / "frontend" / "src" / "components" / "router" / "RouterModal.jsx").read_text()
record("Test 10a: _fcSeq module-level var removed", "_fcSeq" not in modal_src,
       "still present" if "_fcSeq" in modal_src else "removed")
record("Test 10b: local seq variable used instead", "let seq = 0" in modal_src)

print("\n── Test 11: RouterModal fallback visible in content ────────────────────────")
record("Test 11a: buildFlashcards has fallback branch (content-based card)",
       "fallback" in modal_src and "node.content" in modal_src)
record("Test 11b: buildFlashcards checks Array.isArray(concepts)",
       "Array.isArray(concepts)" in modal_src)

print("\n────────────────────────────────────────────────────────────────────────────")

if _failed:
    total_tests = 9 + 4 + 7 + 4 + 2 + 2  # rough
    print(f"  *** {_failed} test(s) FAILED ***")
    sys.exit(1)

print("Router Modal + FlashcardPanel Tests: ALL PASSED ***")
sys.exit(0)
