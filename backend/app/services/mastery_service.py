"""
Mastery Service — Progressive Mastery Engine (Phase 7, Blueprint).

Logika inti:
  new_mastery = min(100, previous_mastery + (ai_score * PROGRESSION_WEIGHT))

Mastery levels (untuk UI lampu):
  LOCKED  :   0.0  (node belum bisa diakses)
  LOW     :   0.1 –  39.9  (lampu remang-remang)
  MEDIUM  :  40.0 –  69.9  (lampu menyala sedang)
  BRIGHT  :  70.0 –  99.9  (lampu terang, node berikutnya UNLOCKED)
  FULL    : 100.0  (lampu penuh 🌟)

Unlock threshold: mastery >= 70.0 membuka node yang bergantung pada node ini.
Aligned with LangFlow NT_03 (Mastery Evaluator) and NT_04 (Adaptive Learning Agent).
"""
from __future__ import annotations

from sqlalchemy.orm import Session as DbSession

from app.models.node import Node
from app.models.edge import Edge

# ── Constants ─────────────────────────────────────────────────────────────────
PROGRESSION_WEIGHT: float = 0.4   # legacy single-question weight (kept for test backward compat)
# F-7B.1: session-specific weight, deliberately lower than a single-question weight.
# Tuned so that 3 perfect sessions (100,100,100) × 3 reach ≥ 70:
#   session 1: 0   + 100 × 0.25 = 25
#   session 2: 25  + 100 × 0.25 = 50
#   session 3: 50  + 100 × 0.25 = 75  → BRIGHT ✓
# One perfect session yields 25 (LOW), two yield 50 (MEDIUM) — lamp never jumps
# straight to BRIGHT from a single quiz session.
SESSION_PROGRESSION_WEIGHT: float = 0.25
UNLOCK_THRESHOLD: float = 70.0    # mastery >= 70 → node target di-unlock (aligned with LangFlow NT_03/NT_04)
MASTERY_MAX: float = 100.0


# ── Mastery Level ─────────────────────────────────────────────────────────────

def get_mastery_level(mastery_score: float) -> str:
    """Converts a numeric mastery score into a UI-facing level string."""
    if mastery_score <= 0.0:
        return "LOCKED"
    if mastery_score < 40.0:
        return "LOW"
    if mastery_score < 70.0:
        return "MEDIUM"
    if mastery_score < 100.0:
        return "BRIGHT"
    return "FULL"


def calculate_progressive_mastery(previous_mastery: float, ai_score: int) -> float:
    """
    Legacy single-question mastery calculation (Phase 7 pseudocode).
    Superseded by calculate_session_mastery() for the 3-question session flow.
    Retained for test backward compatibility.

    gained_brightness = ai_score * 0.4
    new_mastery       = min(100, previous_mastery + gained_brightness)
    """
    gained = ai_score * PROGRESSION_WEIGHT
    return min(MASTERY_MAX, previous_mastery + gained)


def calculate_session_mastery(
    previous_mastery: float,
    session_scores: list[float],
) -> float:
    """
    F-7B.1: Derive the new mastery score from a completed 3-question quiz session.

    Algorithm:
      1. Average the raw NT-03 scores collected during the session.
      2. Apply SESSION_PROGRESSION_WEIGHT (0.25) to the average.
      3. Accumulate onto previous_mastery, capped at MASTERY_MAX.

    Uses SESSION_PROGRESSION_WEIGHT (0.25), NOT PROGRESSION_WEIGHT (0.4), so that
    a single perfect session raises mastery by at most 25 points:
      session 1 (100,100,100): 0  → 25   (LOW)
      session 2 (100,100,100): 25 → 50   (MEDIUM)
      session 3 (100,100,100): 50 → 75   (BRIGHT ✓)

    This keeps calculate_progressive_mastery() and PROGRESSION_WEIGHT unchanged
    for any other callers.

    Args:
        previous_mastery: Node.mastery_score before this session started.
        session_scores:   List of raw float scores from NT-03, one per question.
                          Must be non-empty; typically length 3.

    Returns:
        New mastery_score (float, 0.0 – 100.0).
    """
    if not session_scores:
        # Safety guard: no scores → no change
        return previous_mastery

    avg_score = sum(session_scores) / len(session_scores)
    gained    = avg_score * SESSION_PROGRESSION_WEIGHT
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

    Master Light nodes (node_type='master_light') are excluded from normal
    prerequisite/unlock logic — they are handled by check_master_light_unlock().

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

        # M-6: skip master_light nodes — they use their own unlock logic
        if getattr(target, "node_type", "knowledge") == "master_light":
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


def check_master_light_unlock(session_id: str, db: DbSession) -> list[str]:
    """
    M-6: Check whether the Master Light node(s) in the session should be unlocked.

    Unlock condition: ALL node_type='knowledge' nodes in the session have
    mastery_score >= UNLOCK_THRESHOLD (70).

    When the condition is met:
      - Sets master_light_unlocked = True on every master_light node.
      - Does NOT touch mastery_score or status (those remain unchanged).

    Master Light nodes are deliberately excluded from the knowledge-node check
    so that an incomplete ML assessment never blocks the unlock condition.

    Returns a list of master_light node IDs that were newly unlocked.
    """
    # Fetch all knowledge nodes in this session
    knowledge_nodes: list[Node] = (
        db.query(Node)
        .filter(
            Node.session_id == session_id,
            Node.node_type == "knowledge",
        )
        .all()
    )

    # If there are no knowledge nodes yet (edge case), do nothing
    if not knowledge_nodes:
        return []

    # Unlock condition: every knowledge node is mastered
    all_mastered = all(n.mastery_score >= UNLOCK_THRESHOLD for n in knowledge_nodes)
    if not all_mastered:
        return []

    # Find master_light nodes that are not yet unlocked
    ml_nodes: list[Node] = (
        db.query(Node)
        .filter(
            Node.session_id == session_id,
            Node.node_type == "master_light",
            Node.master_light_unlocked == False,  # noqa: E712
        )
        .all()
    )

    newly_unlocked: list[str] = []
    for ml_node in ml_nodes:
        ml_node.master_light_unlocked = True
        newly_unlocked.append(ml_node.id)

    if newly_unlocked:
        db.flush()

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
    # M-6: exclude master_light nodes — they are not part of normal learning flow
    unlocked_nodes: list[Node] = (
        db.query(Node)
        .filter(
            Node.session_id == session_id,
            Node.status == "unlocked",
            Node.mastery_score < MASTERY_MAX,
            Node.node_type == "knowledge",
        )
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
