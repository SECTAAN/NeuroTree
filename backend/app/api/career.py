"""
Career API — /api/v1/career/*

Endpoints:
  POST /api/v1/career/pathway  — NT-05: knowledge gap analysis + personalized
                                  learning pathway toward a career goal

Session scoping (F-6): uses X-Session-ID (falls back to X-User-ID).
"""
from fastapi import APIRouter, Depends, status, Request, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DbSession

from app.api.dependencies import get_active_session_id
from app.db.database import get_db
from app.models.node import Node
from app.services import langflow_service
from app.services.mastery_service import UNLOCK_THRESHOLD, MASTERY_MAX
from app.core.security import limiter
from app.core.config import get_settings

router = APIRouter(tags=["Career"])
settings = get_settings()

# ── Request schema ────────────────────────────────────────────────────────────
# Defined inline here to keep it co-located with the single endpoint that uses it.

class CareerPathwayRequest(BaseModel):
    career_goal: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="The career role or goal the user is aiming for. e.g. 'Network Engineer'",
    )


# ── POST /career/pathway ───────────────────────────────────────────────────────

@router.post("/career/pathway", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_QUIZ)   # reuse quiz limiter (conservative)
async def get_career_pathway(
    request: Request,                        # required by slowapi
    body: CareerPathwayRequest,
    session_id: str = Depends(get_active_session_id),
    db: DbSession = Depends(get_db),
):
    """
    NT-05: Knowledge Gap & Personalized Learning Pathway.

    Builds the user's current mastery profile from DB, then calls LangFlow NT-05
    which analyses the gap between the current knowledge state and the target
    career goal and returns a prioritised step-by-step learning pathway.

    LIVE path (USE_MOCK_AI=False):
        Calls NT-05 with the full profile JSON. NT-05 returns:
          - strong_concepts, weak_concepts, knowledge_gaps
          - missing_prerequisites, recommended_path, reasoning,
            estimated_completion_days

    MOCK path (USE_MOCK_AI=True):
        Returns a deterministic pathway prioritising weak chunks first,
        then missing (locked/unstarted) chunks.

    Node classification:
        mastered  — status == 'unlocked' AND mastery_score >= UNLOCK_THRESHOLD
        weak      — status == 'unlocked' AND 0 < mastery_score < UNLOCK_THRESHOLD
        missing   — status == 'locked' OR mastery_score == 0
    """
    # M-7: exclude master_light nodes — they have a separate mastery track
    nodes = (
        db.query(Node)
        .filter(Node.session_id == session_id, Node.node_type == "knowledge")
        .all()
    )

    mastered_chunks = []
    weak_chunks     = []
    missing_chunks  = []

    for n in nodes:
        entry = {"id": n.id, "title": n.title, "mastery_score": round(n.mastery_score, 2)}
        if n.mastery_score >= UNLOCK_THRESHOLD:
            mastered_chunks.append(entry)
        elif n.mastery_score > 0:
            weak_chunks.append(entry)
        else:
            missing_chunks.append({"id": n.id, "title": n.title})

    result = await langflow_service.get_knowledge_gap_pathway(
        career_goal=body.career_goal,
        mastered_chunks=mastered_chunks,
        weak_chunks=weak_chunks,
        missing_chunks=missing_chunks,
    )

    return {
        "career_goal":           result.target_goal or body.career_goal,
        "strong_concepts":       result.strong_concepts,
        "weak_concepts":         result.weak_concepts,
        "knowledge_gaps":        result.knowledge_gaps,
        "missing_prerequisites": result.missing_prerequisites,
        "recommended_path": [
            {
                "step":        step.step,
                "chunk_id":    step.chunk_id,
                "chunk_title": step.chunk_title,
                "reason":      step.reason,
            }
            for step in result.recommended_path
        ],
        "estimated_completion_days": result.estimated_completion_days,
        "reasoning":             result.reasoning,
        "profile_summary": {
            "mastered": len(mastered_chunks),
            "weak":     len(weak_chunks),
            "missing":  len(missing_chunks),
            "total":    len(nodes),
        },
    }
