"""
Pydantic schemas for LangFlow flow responses.

NT-01 raw output schema  — matches the actual JSON returned by NT-01.
Internal graph schema    — used by the rest of the backend (nodes + edges).
NT-02 / NT-03 schemas    — quiz generation and evaluation (Phase C).
"""
from typing import Any
from pydantic import BaseModel, Field


# ── NT-01 raw output ──────────────────────────────────────────────────────────
# Exact field names as returned by the NT-01 LangFlow flow.

class NT01Chunk(BaseModel):
    """One knowledge chunk as returned by NT-01."""
    chunk_id: str
    title: str
    description: str                 # NT-01 uses 'description', maps to Node.content
    difficulty: int = 1
    prerequisites: list[str] = Field(default_factory=list)  # list of chunk_id strings


class NT01Relationship(BaseModel):
    """One prerequisite relationship as returned by NT-01."""
    source_chunk_id: str
    target_chunk_id: str
    relationship_type: str = "prerequisite"


class NT01Output(BaseModel):
    """Full NT-01 response envelope."""
    topic: str
    summary: str
    chunks: list[NT01Chunk]
    relationships: list[NT01Relationship]


# ── Internal graph representation (used throughout the backend) ───────────────
# material.py, mastery_service.py, and the DB layer all consume this shape.

class LangFlowNodeChunk(BaseModel):
    """Single knowledge chunk in internal representation."""
    id: str
    title: str
    content: str        # populated from NT01Chunk.description
    key_concepts: list[str] = Field(default_factory=list)


class LangFlowGraphOutput(BaseModel):
    """Full graph structure consumed by material.ingest_material()."""
    nodes: list[LangFlowNodeChunk]
    edges: list[dict[str, Any]]


# ── NT-02 / NT-03 (Phase C — schemas kept minimal until Phase C is wired) ─────

class LangFlowQuizOutput(BaseModel):
    """Quiz question produced by NT-02."""
    question: str


class LangFlowEvalOutput(BaseModel):
    """Evaluation result produced by NT-03 (Option A: mastery_score is final)."""
    score: int       # NT-03 mastery_score (0-100), stored directly as Node.mastery_score
    feedback: str
