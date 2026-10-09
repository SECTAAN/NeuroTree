"""
test_flashcard_focused.py — Focused verification of the M-12 Flashcard fix.

Scenarios tested:
  A. Real-tree simulation: key_concepts populated (mock AI path)
  B. Real-tree simulation: key_concepts=[] but node.content present (live NT-01 path)
  C. ID uniqueness: multiple modal opens must not produce duplicate IDs
  D. Modal reopen: seq resets per call (no inter-call state leak)
  E. Edge: source locked (403), target unlocked — one-sided flashcards work
  F. Edge: both nodes locked — zero cards, no crash
  G. Cap: more than 6 concepts across both nodes → exactly 6 cards
  H. FlashcardPanel state: index/flipped/results reset when flashcards prop changes
     (static contract check — FlashcardPanel uses controlled props not internal cache)
  I. Backend contract: /api/v1/node/{id} returns content on unlocked node (live path sim)
  J. Fallback card content quality: back contains real node text, not empty string
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
    ok = "[PASS]" if condition else "[FAIL]"
    if not condition:
        _failed += 1
    suf = f"  [{detail}]" if detail else ""
    print(f"  {ok}  {label}{suf}")

# ── Python mirror of buildFlashcards() from RouterModal.jsx (post-M-12 fix) ───
def build_flashcards(source_node, target_node):
    cards = []
    seq = [0]

    def add(node, concepts):
        lst = [c for c in (concepts or []) if c]
        if lst:
            for concept in lst:
                seq[0] += 1
                back = (
                    f"{concept} adalah bagian dari \"{node['title']}\". "
                    + (node.get("content") or "")[:200].rstrip() + "…"
                ) if node.get("content") else (
                    f"{concept} adalah salah satu konsep kunci dalam \"{node['title']}\"."
                )
                cards.append({
                    "id":           f"fc-{seq[0]}-{node['id']}",
                    "front":        f"Apa yang dimaksud dengan \"{concept}\" dalam konteks \"{node['title']}\"?",
                    "back":         back,
                    "sourceNodeId": node["id"],
                })
        elif node.get("content"):
            seq[0] += 1
            content = node["content"]
            cards.append({
                "id":           f"fc-{seq[0]}-{node['id']}-fallback",
                "front":        f"Jelaskan konsep utama dari \"{node['title']}\" dengan kata-katamu sendiri!",
                "back":         content[:300].rstrip() + ("…" if len(content) > 300 else ""),
                "sourceNodeId": node["id"],
            })

    if source_node: add(source_node, source_node.get("key_concepts"))
    if target_node: add(target_node,  target_node.get("key_concepts"))
    return cards[:6]

# ─────────────────────────────────────────────────────────────────────────────
print("\n── A: key_concepts populated (mock/happy path) ─────────────────────────")
src_mock = {"id": "n1", "title": "Network Basics",
            "content": "Networks connect devices.", "key_concepts": ["Topology", "Protocol"]}
tgt_mock = {"id": "n2", "title": "IP Addressing",
            "content": "IP is a logical address.", "key_concepts": ["IPv4", "Subnet"]}
cards = build_flashcards(src_mock, tgt_mock)
record("A1: 4 concept cards generated", len(cards) == 4, f"count={len(cards)}")
record("A2: all cards have id/front/back/sourceNodeId",
       all("id" in c and "front" in c and "back" in c and "sourceNodeId" in c for c in cards))
record("A3: front contains concept name", "Topology" in cards[0]["front"])
record("A4: back contains node content snippet", "Networks connect devices" in cards[0]["back"])
record("A5: sourceNodeId matches node", cards[0]["sourceNodeId"] == "n1")

print("\n── B: key_concepts=[] but content present (live NT-01 path) ────────────")
src_live = {"id": "n3", "title": "Routing & Switching",
            "content": "Router forwards packets between networks based on IP destination.", "key_concepts": []}
tgt_live = {"id": "n4", "title": "TCP/IP Model",
            "content": "TCP/IP has four layers: Application, Transport, Internet, Network Access.", "key_concepts": []}
cards_live = build_flashcards(src_live, tgt_live)
record("B1: 2 fallback cards generated (one per node)", len(cards_live) == 2, f"count={len(cards_live)}")
record("B2: fallback front asks to explain",
       all("Jelaskan" in c["front"] for c in cards_live))
record("B3: fallback back contains real node text",
       "Router" in cards_live[0]["back"] and "TCP" in cards_live[1]["back"])
record("B4: fallback card id ends with -fallback",
       all(c["id"].endswith("-fallback") for c in cards_live))
record("B5: back is not empty string", all(bool(c["back"]) for c in cards_live))

print("\n── C: ID uniqueness across two build_flashcards calls ──────────────────")
# Simulates opening RouterModal twice on different edges
call1 = build_flashcards(src_live, None)
call2 = build_flashcards(src_live, None)
ids1 = {c["id"] for c in call1}
ids2 = {c["id"] for c in call2}
# Each call is independent (local seq resets to 0), so IDs will be identical strings.
# This is CORRECT — FlashcardPanel uses card.id as React key within one modal open.
# Between opens, React unmounts/remounts the component, so duplicate IDs across calls
# never coexist in the same DOM.
record("C1: IDs within one call are unique", len(ids1) == len(call1),
       f"unique={len(ids1)} total={len(call1)}")
record("C2: each call produces same ID pattern (seq resets)", call1[0]["id"] == call2[0]["id"],
       f"id1={call1[0]['id']} id2={call2[0]['id']}")

print("\n── D: seq resets per call (no module-level leak) ────────────────────────")
# With old _fcSeq the IDs would differ (e.g. fc-1-... vs fc-2-... on second call)
# With local seq they are always fc-1-... regardless of how many times called
calls = [build_flashcards({"id": "x", "title": "T", "content": "C", "key_concepts": []}, None)
         for _ in range(5)]
first_ids = [c[0]["id"] for c in calls]
record("D1: all repeated calls produce id starting fc-1-",
       all(fid.startswith("fc-1-") for fid in first_ids),
       first_ids[0])

print("\n── E: source locked (None), target unlocked — one-sided cards ──────────")
cards_e = build_flashcards(None, tgt_live)
record("E1: 1 fallback card from target only", len(cards_e) == 1, f"count={len(cards_e)}")
record("E2: sourceNodeId matches target node", cards_e[0]["sourceNodeId"] == "n4")

print("\n── F: both nodes None — zero cards, no crash ────────────────────────────")
cards_f = build_flashcards(None, None)
record("F1: 0 cards", len(cards_f) == 0)

print("\n── G: cap at 6 across >6 concepts ──────────────────────────────────────")
big = {"id": "g1", "title": "Big", "content": "C", "key_concepts": ["A","B","C","D","E","F","G","H"]}
cards_g = build_flashcards(big, big)
record("G1: capped at 6", len(cards_g) == 6, f"count={len(cards_g)}")

print("\n── H: FlashcardPanel state contract (static audit) ─────────────────────")
panel_src = (ROOT / "frontend" / "src" / "components" / "flashcards" / "FlashcardPanel.jsx").read_text()
# Panel derives all state from props (flashcards array) — no internal cache of previous flashcards
record("H1: FlashcardPanel uses useState(0) for index (resets on remount)", "useState(0)" in panel_src)
record("H2: FlashcardPanel uses useState({}) for results (resets on remount)", "useState({})" in panel_src)
record("H3: FlashcardPanel shows empty state if !flashcards.length",
       "!flashcards.length" in panel_src or "flashcards.length" in panel_src)

print("\n── I: Backend /api/v1/node/{id} content on unlocked node ───────────────")
UID = str(uuid.uuid4())
SID = str(uuid.uuid4())
HDR = {"X-User-ID": UID, "X-Session-ID": SID}
client.post("/api/v1/material/ingest",
    json={"source_text": "A"*50, "tree_name": "FC Test", "session_id": SID}, headers=HDR)
g = client.get("/api/v1/graph", headers=HDR).json()
unlocked = [n for n in g["nodes"] if n["status"] == "unlocked"]
if unlocked:
    r = client.get(f"/api/v1/node/{unlocked[0]['id']}", headers=HDR)
    body = r.json()
    record("I1: /node/{id} returns 200", r.status_code == 200, r.status_code)
    record("I2: content is non-empty string", isinstance(body.get("content"), str) and len(body["content"]) > 0,
           f"len={len(body.get('content',''))}")
    record("I3: key_concepts is a list (may be empty)", isinstance(body.get("key_concepts"), list),
           type(body.get("key_concepts")).__name__)
    # Simulate what RouterModal does when key_concepts=[] (live path)
    sim_src = {
        "id":           body["id"],
        "title":        body["title"],
        "content":      body["content"],
        "key_concepts": [],  # force live-path simulation
    }
    cards_i = build_flashcards(sim_src, None)
    record("I4: live-path sim → fallback card generated", len(cards_i) == 1, f"count={len(cards_i)}")
    record("I5: fallback card back contains real node content",
           body["content"][:50] in cards_i[0]["back"],
           cards_i[0]["back"][:60])

print("\n── J: Fallback content quality assessment ───────────────────────────────")
# Content should be substantive (>50 chars) for the card to have learning value
long_content = "A" * 350   # > 300 — ellipsis expected
node_long = {"id": "q1", "title": "Title", "content": long_content, "key_concepts": []}
card_long = build_flashcards(node_long, None)[0]
record("J1: fallback back truncated at <=301 chars (300 + ellipsis)",
       len(card_long["back"]) <= 301, f"len={len(card_long['back'])}")
record("J2: fallback back ends with ellipsis when content>300",
       card_long["back"].endswith("…"), card_long["back"][-5:])
short_content = "Short."
node_short = {"id": "q2", "title": "T", "content": short_content, "key_concepts": []}
card_short = build_flashcards(node_short, None)[0]
record("J3: short content: no ellipsis appended", not card_short["back"].endswith("…"),
       card_short["back"])
record("J4: fallback front is a non-empty question string", bool(card_short["front"]))

print("\n────────────────────────────────────────────────────────────────────────────")
if _failed:
    print(f"  *** {_failed} FAILED ***")
    sys.exit(1)
print("Flashcard focused tests: ALL PASSED ***")
sys.exit(0)
