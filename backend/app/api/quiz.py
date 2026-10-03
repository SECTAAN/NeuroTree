"""
Quiz API — /api/v1/quiz/*

Endpoints:
  POST /api/v1/quiz/generate   — generate a fresh quiz question for a node
  POST /api/v1/quiz/evaluate   — evaluate user answer, update mastery, check unlocks
  GET  /api/v1/quiz/recommend  — adaptive learning: top-3 recommended next nodes
"""
from fastapi import APIRouter, Depends, status, Request, HTTPException
from sqlalchemy.orm import Session as DbSession

from app.api.dependencies import get_current_user_id
from app.db.database import get_db
from app.models.node import Node
from app.schemas.request_schema import GenerateQuizRequest, EvaluateAnswerRequest
from app.services import langflow_service
from app.services.mastery_service import (
    get_mastery_level,
    check_and_unlock_dependents,
)
from app.core.exceptions import NodeNotFoundException
from app.core.security import limiter
from app.core.config import get_settings

router = APIRouter(tags=["Quiz"])
settings = get_settings()


# ── D. Generate Quiz ──────────────────────────────────────────────────────────

@router.post("/quiz/generate", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_QUIZ)
async def generate_quiz(
    request: Request,                 # required by slowapi — must be first param
    body: GenerateQuizRequest,
    session_id: str = Depends(get_current_user_id),
    db: DbSession = Depends(get_db),
):
    """
    Calls LangFlow NT-02 (or mock) to produce a fresh, randomised question for
    the given node.  The expected_answer from NT-02 is stored server-side in
    node.last_expected_answer and never returned to the frontend.
    Node must belong to the caller's session.
    """
    node = (
        db.query(Node)
        .filter(Node.id == body.node_id, Node.session_id == session_id)
        .first()
    )
    if not node:
        raise NodeNotFoundException(body.node_id)

    result = await langflow_service.generate_quiz_question(
        node_id=node.id,
        key_concepts=node.key_concepts or [],
        node_content=node.content or "",
        node_title=node.title or "",
    )

    # Persist expected_answer and question server-side so the evaluate endpoint
    # can use them without the frontend ever seeing them.
    try:
        node.last_expected_answer = result.expected_answer or ""
        node.last_question = result.question or ""
        db.commit()
        db.refresh(node)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal menyimpan data kuis. Silakan coba lagi.",
        )

    return {"node_id": node.id, "question": result.question}


# ── E. Evaluate Answer & Update Mastery ──────────────────────────────────────

@router.post("/quiz/evaluate", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_QUIZ)
async def evaluate_answer(
    request: Request,                 # required by slowapi — must be first param
    body: EvaluateAnswerRequest,
    session_id: str = Depends(get_current_user_id),
    db: DbSession = Depends(get_db),
):
    """
    Core mastery engine endpoint:
      1. Calls LangFlow NT-03 (or mock) to score the answer.
         LIVE path: NT-03 receives previous_mastery and returns mastery_score
                    directly — stored as-is (Option A, no progressive wrapper).
         MOCK path: score already has progressive accumulation applied.
      2. Persists new mastery score to DB.
      3. Checks whether dependent nodes should be unlocked (threshold = 70).
      4. Returns full evaluation result.
    """
    node = (
        db.query(Node)
        .filter(Node.id == body.node_id, Node.session_id == session_id)
        .first()
    )
    if not node:
        raise NodeNotFoundException(body.node_id)

    # 1. AI evaluation — pass full context to NT-03
    eval_result = await langflow_service.evaluate_answer(
        node_title=node.title or "",
        key_concepts=node.key_concepts or [],
        user_answer=body.user_answer,
        node_content=node.content or "",
        previous_mastery=node.mastery_score,
        expected_answer=node.last_expected_answer or "",
        question=node.last_question or "",
    )

    try:
        # 2. Store NT-03's mastery_score directly (LIVE) or mock accumulated score
        node.mastery_score = eval_result.score
        db.flush()

        # 3. Unlock dependent nodes if threshold met
        newly_unlocked = check_and_unlock_dependents(node=node, db=db)

        db.commit()
        db.refresh(node)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal memproses transaksi. Perubahan dibatalkan.",
        )

    return {
        "ai_score": eval_result.score,
        "feedback": eval_result.feedback,
        "new_mastery_score": round(node.mastery_score, 2),
        "mastery_level": get_mastery_level(node.mastery_score),
        "unlocked_new_nodes": newly_unlocked,
    }


# ── Adaptive Learning: Recommendations ───────────────────────────────────────

@router.get("/quiz/recommend", status_code=status.HTTP_200_OK)
async def get_recommendations(
    session_id: str = Depends(get_current_user_id),
    db: DbSession = Depends(get_db),
):
    """
    Adaptive Learning Engine (Phase 7 + NT-04):

    LIVE path (USE_MOCK_AI=False):
        Builds a full mastery-state snapshot and sends it to NT-04 which
        returns the single most important next learning action plus a
        progress summary.

    MOCK path (USE_MOCK_AI=True):
        Falls back to the deterministic out-degree algorithm in mastery_service
        and wraps the result in the same NT-04 envelope shape.
    """
    from app.models.edge import Edge as EdgeModel
    from app.services.mastery_service import UNLOCK_THRESHOLD

    nodes = (
        db.query(Node)
        .filter(Node.session_id == session_id)
        .all()
    )
    edges = (
        db.query(EdgeModel)
        .filter(EdgeModel.session_id == session_id)
        .all()
    )

    mastered   = [n for n in nodes if n.mastery_score >= UNLOCK_THRESHOLD]
    unlocked   = [n for n in nodes if n.status == "unlocked" and n.mastery_score < UNLOCK_THRESHOLD]
    locked     = [n for n in nodes if n.status == "locked"]

    def _node_dict(n: Node) -> dict:
        return {"id": n.id, "title": n.title, "mastery_score": round(n.mastery_score, 2)}

    edge_list = [{"source": e.source_id, "target": e.target_id} for e in edges]

    result = await langflow_service.get_adaptive_recommendation(
        mastered_nodes=[_node_dict(n) for n in mastered],
        unlocked_nodes=[_node_dict(n) for n in unlocked],
        locked_nodes=[_node_dict(n) for n in locked],
        edges=edge_list,
    )

    return {
        "action":                  result.action,
        "target_chunk_id":         result.target_chunk_id,
        "target_chunk_title":      result.target_chunk_title,
        "reason":                  result.reason,
        "priority":                result.priority,
        "suggested_review_chunks": result.suggested_review_chunks,
        "progress_summary": {
            "total_chunks":         result.progress_summary.total_chunks,
            "mastered_chunks":      result.progress_summary.mastered_chunks,
            "completion_percentage": result.progress_summary.completion_percentage,
        },
    }
