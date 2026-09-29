"""
Material & Graph API — /api/v1/material/* and /api/v1/graph, /api/v1/node/*

Endpoints:
  POST /api/v1/material/ingest   — ingest document, build graph in DB
  GET  /api/v1/graph             — fetch lightweight graph for React Flow
  GET  /api/v1/node/{node_id}    — fetch full node content (learning mode)
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DbSession

from app.api.dependencies import get_current_user_id
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
    session_id: str = Depends(get_current_user_id),
    db: DbSession = Depends(get_db),
):
    """
    Receives source text, calls LangFlow (mock in M2), persists nodes + edges,
    and returns the created graph structure.
    """
    # 1. Call LangFlow (mock) BEFORE opening any DB mutation — keeps the
    #    transaction window as short as possible.
    graph = await langflow_service.ingest_and_build_graph(body.source_text)

    # Node IDs are namespaced by session so multiple sessions don't collide.
    # e.g. "node_01" → "<session_id[:8]>_node_01"
    prefix = session_id.replace("-", "")[:8]

    def scoped(node_id: str) -> str:
        return f"{prefix}_{node_id}"

    try:
        # 2. Ensure session row exists
        session_row = db.query(Session).filter(Session.uuid == session_id).first()
        if not session_row:
            session_row = Session(uuid=session_id)
            db.add(session_row)
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
    session_id: str = Depends(get_current_user_id),
    db: DbSession = Depends(get_db),
):
    """
    Returns lightweight node + edge data for React Flow rendering.
    Full content text is excluded to keep the payload small.
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
                "id": n.id,
                "title": n.title,
                "status": n.status,
                "mastery_score": n.mastery_score,
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
    session_id: str = Depends(get_current_user_id),
    db: DbSession = Depends(get_db),
):
    """
    Returns full node content (title, content text, key_concepts) for
    learning mode when user clicks a lamp node.
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
