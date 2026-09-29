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
    calculate_progressive_mastery,
    get_mastery_level,
    check_and_unlock_dependents,
    get_next_learning_recommendations,
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
    Calls LangFlow Flow C (mock) to produce a fresh, randomised question for the
    given node.  Node must be unlocked and belong to the caller's session.
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
      1. Calls LangFlow Flow D (mock) to score the answer.
      2. Calculates new progressive mastery score.
      3. Updates node in DB.
      4. Checks whether dependent nodes should be unlocked.
      5. Returns full evaluation result.
    """
    node = (
        db.query(Node)
        .filter(Node.id == body.node_id, Node.session_id == session_id)
        .first()
    )
    if not node:
        raise NodeNotFoundException(body.node_id)

    # 1. AI evaluation (mock in M2) — called before DB mutation so the
    #    transaction window stays as short as possible.
    eval_result = await langflow_service.evaluate_answer(
        node_title=node.title,
        key_concepts=node.key_concepts or [],
        user_answer=body.user_answer,
    )

    # 2. Progressive mastery calculation (Phase 7 algorithm)
    new_mastery = calculate_progressive_mastery(
        previous_mastery=node.mastery_score,
        ai_score=eval_result.score,
    )

    try:
        # 3. Persist updated mastery
        node.mastery_score = new_mastery
        db.flush()

        # 4. Unlock dependent nodes if threshold met
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
def get_recommendations(
    session_id: str = Depends(get_current_user_id),
    db: DbSession = Depends(get_db),
):
    """
    Adaptive Learning Engine (Phase 7.2): returns top-3 next recommended nodes
    ranked by out-degree (foundational importance).
    """
    recommendations = get_next_learning_recommendations(
        session_id=session_id,
        db=db,
    )
    return {"recommendations": recommendations}
