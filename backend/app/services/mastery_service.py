"""
Mastery Service — Progressive Mastery Engine (Phase 7, Blueprint).

Logika inti:
  new_mastery = min(100, previous_mastery + (ai_score * PROGRESSION_WEIGHT))

Mastery levels (untuk UI lampu):
  LOCKED  :   0.0  (node belum bisa diakses)
  LOW     :   0.1 –  39.9  (lampu remang-remang)
  MEDIUM  :  40.0 –  64.9  (lampu menyala sedang)
  BRIGHT  :  65.0 –  99.9  (lampu terang, node berikutnya UNLOCKED)
  FULL    : 100.0  (lampu penuh 🌟)

Unlock threshold: mastery >= 65.0 membuka node yang bergantung pada node ini.
"""
from __future__ import annotations

from sqlalchemy.orm import Session as DbSession

from app.models.node import Node
from app.models.edge import Edge

# ── Constants ─────────────────────────────────────────────────────────────────
PROGRESSION_WEIGHT: float = 0.4   # setiap kuis menyumbang maks 40% brightness
UNLOCK_THRESHOLD: float = 65.0    # mastery >= 65 → node target di-unlock
MASTERY_MAX: float = 100.0


# ── Mastery Level ─────────────────────────────────────────────────────────────

def get_mastery_level(mastery_score: float) -> str:
    """Converts a numeric mastery score into a UI-facing level string."""
    if mastery_score <= 0.0:
        return "LOCKED"
    if mastery_score < 40.0:
        return "LOW"
    if mastery_score < 65.0:
        return "MEDIUM"
    if mastery_score < 100.0:
        return "BRIGHT"
    return "FULL"


# ── Core Calculation ──────────────────────────────────────────────────────────

def calculate_progressive_mastery(previous_mastery: float, ai_score: int) -> float:
    """
    Phase 7 pseudocode implementation.

    gained_brightness = ai_score * 0.4
    new_mastery       = min(100, previous_mastery + gained_brightness)
    """
    gained = ai_score * PROGRESSION_WEIGHT
    return min(MASTERY_MAX, previous_mastery + gained)


# ── Unlock Check ──────────────────────────────────────────────────────────────

def check_and_unlock_dependents(
    node: Node,
    db: DbSession,
) -> list[str]:
    """
    After a node's mastery is updated, check every edge where this node is the
    source.  If the source node now meets UNLOCK_THRESHOLD, set the target node
    status to 'unlocked' (provided all of *its* prerequisites are also met).

    Returns a list of node IDs that were newly unlocked.
    """
    if node.mastery_score < UNLOCK_THRESHOLD:
        return []

    newly_unlocked: list[str] = []

    # Find all edges that originate from this node
    outgoing: list[Edge] = (
        db.query(Edge)
        .filter(Edge.source_id == node.id, Edge.session_id == node.session_id)
        .all()
    )

    for edge in outgoing:
        target: Node | None = (
            db.query(Node)
            .filter(Node.id == edge.target_id, Node.session_id == node.session_id)
            .first()
        )
        if target is None or target.status == "unlocked":
            continue

        # Check ALL prerequisites of target_node are satisfied
        incoming_edges: list[Edge] = (
            db.query(Edge)
            .filter(Edge.target_id == target.id, Edge.session_id == node.session_id)
            .all()
        )
        all_prerequisites_met = all(
            _prereq_mastered(e.source_id, node.session_id, db)
            for e in incoming_edges
        )

        if all_prerequisites_met:
            target.status = "unlocked"
            newly_unlocked.append(target.id)

    db.flush()  # write changes before caller commits
    return newly_unlocked


def _prereq_mastered(source_id: str, session_id: str, db: DbSession) -> bool:
    """Returns True if the given source node has reached the unlock threshold."""
    source: Node | None = (
        db.query(Node)
        .filter(Node.id == source_id, Node.session_id == session_id)
        .first()
    )
    return source is not None and source.mastery_score >= UNLOCK_THRESHOLD


# ── Adaptive Learning Engine (Phase 7.2) ─────────────────────────────────────

def get_next_learning_recommendations(
    session_id: str,
    db: DbSession,
    top_n: int = 3,
) -> list[dict]:
    """
    Out-degree prioritisation algorithm (Phase 7, Blueprint).

    1. Find all unlocked nodes with mastery < 100.
    2. Score each by the number of outgoing edges (foundational importance).
    3. Return the top_n highest-priority nodes.
    """
    unlocked_nodes: list[Node] = (
        db.query(Node)
        .filter(Node.session_id == session_id, Node.status == "unlocked", Node.mastery_score < MASTERY_MAX)
        .all()
    )

    scored: list[dict] = []
    for node in unlocked_nodes:
        out_degree = (
            db.query(Edge)
            .filter(Edge.source_id == node.id, Edge.session_id == session_id)
            .count()
        )
        scored.append({
            "id": node.id,
            "title": node.title,
            "mastery_score": node.mastery_score,
            "mastery_level": get_mastery_level(node.mastery_score),
            "priority": out_degree,
        })

    scored.sort(key=lambda x: x["priority"], reverse=True)
    return scored[:top_n]
