"""
Placeholder router for /api/v1/quiz endpoints.
Full implementation in Milestone 2.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/quiz", tags=["Quiz"])


@router.get("/health")
async def quiz_health():
    return {"status": "Quiz router online. Implementation coming in Milestone 2."}
