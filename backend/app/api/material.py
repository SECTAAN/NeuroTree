"""
Material & Graph API — /api/v1/material/* and /api/v1/graph, /api/v1/node/*

Endpoints:
  POST /api/v1/material/ingest   — ingest document, build graph in DB
  GET  /api/v1/graph             — fetch lightweight graph for React Flow
  GET  /api/v1/node/{node_id}    — fetch full node content (learning mode)
  GET  /api/v1/sessions          — list all sessions belonging to X-User-ID

Multi-session architecture (F-6):
  X-User-ID   = stable browser/user identity — never changes.
  X-Session-ID = active tree/session UUID — set per-tree by the frontend.
  Session.user_id  = the X-User-ID value that owns this session row.
  Session.uuid     = per-tree session ID (was the only identifier before F-6).

  Backward compat: if X-Session-ID is absent, X-User-ID is used as session scope
  (identical to pre-F-6 behaviour for any client that has not yet updated).
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DbSession

from app.api.dependencies import get_current_user_id, get_active_session_id
from app.db.database import get_db
from app.models.session import Session
from app.models.node import Node
from app.models.edge import Edge
from app.schemas.request_schema import IngestRequest
from app.services import langflow_service
from app.core.exceptions import NodeNotFoundException

router = APIRouter(tags=["Material & Graph"])


# ── A. Data Ingestion & Graph Creation ────────────────────────────────────────

@router.post("/material/ingest", status_code=status.HTTP_200_OK)
async def ingest_material(
    body: IngestRequest,
    user_id: str = Depends(get_current_user_id),
    db: DbSession = Depends(get_db),
):
    """
    Receives source text, calls LangFlow (mock in M2), persists nodes + edges,
    and returns the created graph structure.

    Multi-session (F-6):
      - body.session_id: optional UUID provided by the frontend.
          * If provided and already exists in DB → must be owned by this user.
          * If provided and not in DB → create a new Session with that UUID.
          * If absent → generate a new UUID (legacy / first-time path).
      - Session.user_id is always set to the X-User-ID value so GET /sessions
        can filter all trees that belong to this browser/user.
      - A session owned by a DIFFERENT user_id is treated as not found — the
        caller gets a fresh session instead (no 403 leak).
    """
    # ── Determine session UUID ────────────────────────────────────────────────
    requested_sid = (body.session_id or "").strip()
    if requested_sid:
        # Validate it looks like a UUID (frontend always sends crypto.randomUUID())
        try:
            uuid.UUID(requested_sid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="session_id harus berupa UUID yang valid.",
            )
        session_id = requested_sid
    else:
        # Legacy / backward-compat path — generate a new UUID per ingest.
        # This keeps single-session clients working exactly as before.
        session_id = str(uuid.uuid4())

    # 1. Call LangFlow BEFORE opening any DB mutation — keeps the
    #    transaction window as short as possible.
    graph = await langflow_service.ingest_and_build_graph(body.source_text)

    # Node IDs are namespaced by session so multiple sessions don't collide.
    # e.g. "node_01" → "<session_id[:8]>_node_01"
    prefix = session_id.replace("-", "")[:8]

    def scoped(node_id: str) -> str:
        return f"{prefix}_{node_id}"

    try:
        # 2. Ensure session row exists; update tree metadata on ingest.
        #    Never overwrite a session owned by a different user.
        session_row = db.query(Session).filter(Session.uuid == session_id).first()
        if not session_row:
            session_row = Session(
                uuid=session_id,
                user_id=user_id,
                tree_name=body.tree_name.strip(),
                learning_goal=body.learning_goal.strip(),
            )
            db.add(session_row)
        else:
            # Ownership check — silently re-own if user_id is blank (backfill gap)
            if session_row.user_id and session_row.user_id != user_id:
                # Different user owns this session_id — treat as collision.
                # Generate a fresh UUID and create a new session instead.
                session_id = str(uuid.uuid4())
                prefix = session_id.replace("-", "")[:8]
                session_row = Session(
                    uuid=session_id,
                    user_id=user_id,
                    tree_name=body.tree_name.strip(),
                    learning_goal=body.learning_goal.strip(),
                )
                db.add(session_row)
            else:
                # Re-ingest on owned session — update metadata, backfill user_id
                if not session_row.user_id:
                    session_row.user_id = user_id
                if body.tree_name.strip():
                    session_row.tree_name = body.tree_name.strip()
                if body.learning_goal.strip():
                    session_row.learning_goal = body.learning_goal.strip()
        db.flush()

        # 3. Clear existing graph for this session (re-ingest replaces previous)
        db.query(Edge).filter(Edge.session_id == session_id).delete()
        db.query(Node).filter(Node.session_id == session_id).delete()
        db.flush()

        # 4. Persist nodes — first node is unlocked by default (entry point)
        for idx, chunk in enumerate(graph.nodes):
            node = Node(
                id=scoped(chunk.id),
                session_id=session_id,
                title=chunk.title,
                content=chunk.content,
                key_concepts=chunk.key_concepts,
                status="unlocked" if idx == 0 else "locked",
                mastery_score=0.0,
            )
            db.add(node)

        # 5. Persist edges — scope both ends
        for edge_data in graph.edges:
            edge = Edge(
                id=str(uuid.uuid4()),
                session_id=session_id,
                source_id=scoped(edge_data["source_id"]),
                target_id=scoped(edge_data["target_id"]),
                relationship_type=edge_data.get("relationship", "prerequisite"),
            )
            db.add(edge)

        db.commit()

    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal memproses transaksi. Perubahan dibatalkan.",
        )

    return {
        "message": "Graf pengetahuan berhasil dibuat.",
        "session_id": session_id,
        "nodes_created": len(graph.nodes),
        "edges_created": len(graph.edges),
    }


# ── B. Fetch Visual Graph ─────────────────────────────────────────────────────

@router.get("/graph", status_code=status.HTTP_200_OK)
def get_visual_graph(
    session_id: str = Depends(get_active_session_id),
    db: DbSession = Depends(get_db),
):
    """
    Returns lightweight node + edge data for React Flow rendering.
    Full content text is excluded to keep the payload small.

    Scoped by X-Session-ID (falls back to X-User-ID for backward compat).
    """
    nodes = (
        db.query(Node)
        .filter(Node.session_id == session_id)
        .all()
    )
    edges = (
        db.query(Edge)
        .filter(Edge.session_id == session_id)
        .all()
    )

    return {
        "nodes": [
            {
                "id":                    n.id,
                "title":                 n.title,
                "status":                n.status,
                "mastery_score":         n.mastery_score,
                "node_type":             getattr(n, "node_type", "knowledge") or "knowledge",
                "master_light_unlocked": getattr(n, "master_light_unlocked", False) or False,
                "master_light_mastery":  getattr(n, "master_light_mastery", 0.0) or 0.0,
            }
            for n in nodes
        ],
        "edges": [
            {
                "source_id": e.source_id,
                "target_id": e.target_id,
                "relationship": e.relationship_type,
            }
            for e in edges
        ],
    }


# ── C. Fetch Node Content ─────────────────────────────────────────────────────

@router.get("/node/{node_id}", status_code=status.HTTP_200_OK)
def get_node_content(
    node_id: str,
    session_id: str = Depends(get_active_session_id),
    db: DbSession = Depends(get_db),
):
    """
    Returns full node content (title, content text, key_concepts) for
    learning mode when user clicks a lamp node.

    Scoped by X-Session-ID (falls back to X-User-ID for backward compat).
    """
    node = (
        db.query(Node)
        .filter(Node.id == node_id, Node.session_id == session_id)
        .first()
    )
    if not node:
        raise NodeNotFoundException(node_id)

    if node.status == "locked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Node ini masih terkunci. Selesaikan prasyaratnya terlebih dahulu.",
        )

    return {
        "id": node.id,
        "title": node.title,
        "content": node.content,
        "key_concepts": node.key_concepts,
        "mastery_score": node.mastery_score,
        "mastery_level": _mastery_level(node.mastery_score),
    }


def _mastery_level(score: float) -> str:
    from app.services.mastery_service import get_mastery_level
    return get_mastery_level(score)


# ── F. Session Summary (Dashboard History) ───────────────────────────────────

@router.get("/sessions", status_code=status.HTTP_200_OK)
def get_sessions(
    user_id: str = Depends(get_current_user_id),
    db: DbSession = Depends(get_db),
):
    """
    Returns summary of ALL learning sessions owned by this user (X-User-ID).

    Multi-session (F-6): filters by Session.user_id so every independent tree
    created by this browser appears in the Dashboard.

    Backward compat: sessions backfilled with user_id = uuid are matched
    because migrate_add_user_id.py sets user_id = uuid for old rows.
    """
    from datetime import datetime, timezone

    session_rows = (
        db.query(Session)
        .filter(Session.user_id == user_id)
        .order_by(Session.created_at.desc())
        .all()
    )

    if not session_rows:
        return {"sessions": []}

    results = []
    now = datetime.now(timezone.utc)

    for session_row in session_rows:
        nodes = (
            db.query(Node)
            .filter(Node.session_id == session_row.uuid)
            .all()
        )
        if not nodes:
            continue

        total_nodes = len(nodes)
        mastered    = [n for n in nodes if n.mastery_score >= 70.0]
        avg_mastery = round(sum(n.mastery_score for n in nodes) / total_nodes, 1)

        created = session_row.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        delta_days = (now - created).days
        if delta_days == 0:
            last_studied = "Today"
        elif delta_days == 1:
            last_studied = "Yesterday"
        else:
            last_studied = f"{delta_days} days ago"

        results.append({
            "session_id":     session_row.uuid,
            "tree_name":      session_row.tree_name or "My Tree",
            "learning_goal":  session_row.learning_goal,
            "total_nodes":    total_nodes,
            "mastered_nodes": len(mastered),
            "avg_mastery":    avg_mastery,
            "last_studied":   last_studied,
            "created_at":     session_row.created_at.isoformat(),
        })

    return {"sessions": results}


# ── G. Rename Session ─────────────────────────────────────────────────────────

class RenameSessionRequest(BaseModel):
    tree_name: str = Field(..., min_length=1, max_length=255)
    learning_goal: Optional[str] = Field(default=None, max_length=1000)


@router.patch("/sessions/{session_id}", status_code=status.HTTP_200_OK)
def rename_session(
    session_id: str,
    body: RenameSessionRequest,
    user_id: str = Depends(get_current_user_id),
    db: DbSession = Depends(get_db),
):
    """
    Rename (and optionally update the learning goal of) a session owned by
    the requesting user.

    Ownership is verified via X-User-ID == Session.user_id.
    Returns the updated session metadata.
    """
    session_row = db.query(Session).filter(Session.uuid == session_id).first()

    if not session_row or session_row.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session tidak ditemukan atau bukan milik Anda.",
        )

    session_row.tree_name = body.tree_name.strip()
    if body.learning_goal is not None:
        session_row.learning_goal = body.learning_goal.strip()

    try:
        db.commit()
        db.refresh(session_row)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal memperbarui session.",
        )

    return {
        "session_id":    session_row.uuid,
        "tree_name":     session_row.tree_name,
        "learning_goal": session_row.learning_goal,
    }


# ── H. Delete Session ─────────────────────────────────────────────────────────

@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
def delete_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: DbSession = Depends(get_db),
):
    """
    Delete a session (tree) owned by the requesting user.

    Ownership is verified via X-User-ID == Session.user_id.
    Cascade on Session → Node → Edge handles all child rows automatically.
    Returns a success confirmation.
    """
    session_row = db.query(Session).filter(Session.uuid == session_id).first()

    if not session_row or session_row.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session tidak ditemukan atau bukan milik Anda.",
        )

    try:
        db.delete(session_row)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal menghapus session.",
        )

    return {"deleted": True, "session_id": session_id}
