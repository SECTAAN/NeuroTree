"""
Master Light API — /api/v1/master-light/*

Endpoints:
  POST /api/v1/master-light/generate  — generate ML assessment question (NT-02 reuse)
  POST /api/v1/master-light/evaluate  — evaluate answer, commit master_light_mastery on Q2

Rules (M-5 spec):
  - Node must have node_type='master_light' AND master_light_unlocked=True.
  - 3-question session: ml_session_scores accumulates Q0/Q1 raw scores.
  - Q2 commits master_light_mastery via calculate_session_mastery().
  - Does NOT touch mastery_score (the normal knowledge-node field).
  - Uses NT-02 (generate) and NT-03 (evaluate) flows — same as normal quiz.
  - Same rate limits as /quiz/* so ML assessment counts toward the global cap.
"""
from fastapi import APIRouter, Depends, status, Request, HTTPException
from sqlalchemy.orm import Session as DbSession

from app.api.dependencies import get_active_session_id
from app.db.database import get_db
from app.models.node import Node
from app.schemas.request_schema import GenerateMasterLightRequest, EvaluateMasterLightRequest
from app.services import langflow_service
from app.services.mastery_service import calculate_session_mastery
from app.core.exceptions import NodeNotFoundException
from app.core.security import limiter
from app.core.config import get_settings

router = APIRouter(tags=["Master Light"])
settings = get_settings()


@router.post("/master-light/generate", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_QUIZ)
async def generate_master_light(
    request: Request,
    body: GenerateMasterLightRequest,
    session_id: str = Depends(get_active_session_id),
    db: DbSession = Depends(get_db),
):
    """
    Generate a Master Light assessment question for the given master_light node.

    Guards:
      - node must exist and belong to the caller's session.
      - node.node_type must be 'master_light'.
      - node.master_light_unlocked must be True.

    Reuses NT-02 (generate_quiz_question) so no new Langflow flow is needed.
    The generated question/expected_answer are stored in ml_last_question /
    ml_last_expected_answer (separate from the normal last_question field).
    """
    node = (
        db.query(Node)
        .filter(Node.id == body.node_id, Node.session_id == session_id)
        .first()
    )
    if not node:
        raise NodeNotFoundException(body.node_id)

    if getattr(node, "node_type", "knowledge") != "master_light":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Node ini bukan Master Light node.",
        )

    if not getattr(node, "master_light_unlocked", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Master Light belum terbuka. Kuasai semua node prasyarat terlebih dahulu.",
        )

    result = await langflow_service.generate_quiz_question(
        node_id=node.id,
        key_concepts=node.key_concepts or [],
        node_content=node.content or "",
        node_title=node.title or "",
    )

    try:
        node.ml_last_question        = result.question or ""
        node.ml_last_expected_answer = result.expected_answer or ""
        db.commit()
        db.refresh(node)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal menyimpan data Master Light. Silakan coba lagi.",
        )

    return {"node_id": node.id, "question": result.question}


@router.post("/master-light/evaluate", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_QUIZ)
async def evaluate_master_light(
    request: Request,
    body: EvaluateMasterLightRequest,
    session_id: str = Depends(get_active_session_id),
    db: DbSession = Depends(get_db),
):
    """
    Evaluate a Master Light assessment answer.

    Session accumulation (same pattern as quiz.py F-7B):
      Q0: reset ml_session_scores, append raw score, is_final=False.
      Q1: append raw score, is_final=False.
      Q2: append raw score, compute master_light_mastery via
          calculate_session_mastery(), commit, is_final=True.

    Returns:
      ai_score              — raw NT-03 score for this question (0–100)
      feedback              — NT-03 feedback text
      master_light_mastery  — committed ML mastery (only meaningful on is_final)
      is_final              — True on Q2
    """
    node = (
        db.query(Node)
        .filter(Node.id == body.node_id, Node.session_id == session_id)
        .first()
    )
    if not node:
        raise NodeNotFoundException(body.node_id)

    if getattr(node, "node_type", "knowledge") != "master_light":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Node ini bukan Master Light node.",
        )

    if not getattr(node, "master_light_unlocked", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Master Light belum terbuka.",
        )

    # ── Fresh session guard ───────────────────────────────────────────────────
    if body.question_index == 0:
        node.ml_session_scores = []

    # ── NT-03 evaluation (reuse same service as normal quiz) ──────────────────
    eval_result = await langflow_service.evaluate_answer(
        node_title=node.title or "",
        key_concepts=node.key_concepts or [],
        user_answer=body.user_answer,
        node_content=node.content or "",
        previous_mastery=getattr(node, "master_light_mastery", 0.0),
        expected_answer=getattr(node, "ml_last_expected_answer", "") or "",
        question=getattr(node, "ml_last_question", "") or "",
    )

    # ── Accumulate score ─────────────────────────────────────────────────────
    current_scores: list = list(getattr(node, "ml_session_scores", None) or [])
    current_scores.append(float(eval_result.score))

    is_final = (body.question_index == 2)

    try:
        if is_final:
            new_ml_mastery = calculate_session_mastery(
                previous_mastery=getattr(node, "master_light_mastery", 0.0),
                session_scores=current_scores,
            )
            node.master_light_mastery = new_ml_mastery
            node.ml_session_scores    = []
            db.commit()
            db.refresh(node)
        else:
            node.ml_session_scores = current_scores
            db.commit()
            db.refresh(node)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal memproses Master Light assessment. Perubahan dibatalkan.",
        )

    return {
        "ai_score":            eval_result.score,
        "feedback":            eval_result.feedback,
        "master_light_mastery": round(getattr(node, "master_light_mastery", 0.0), 2),
        "is_final":            is_final,
        "question_index":      body.question_index,
    }
