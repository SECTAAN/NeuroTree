"""
Placeholder router for /api/v1/material endpoints.
Full implementation in Milestone 2.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/material", tags=["Material"])


@router.get("/health")
async def material_health():
    return {"status": "Material router online. Implementation coming in Milestone 2."}
