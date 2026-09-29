"""
Pydantic schemas for LangFlow webhook responses.
Used in Milestone 5 when real LangFlow calls replace mock data.
These schemas define the expected JSON shape returned by each Flow.
"""
from typing import Any
from pydantic import BaseModel


class LangFlowNodeChunk(BaseModel):
    """Single knowledge chunk produced by Flow A (ingestion/chunking)."""
    id: str
    title: str
    content: str
    key_concepts: list[str]


class LangFlowGraphOutput(BaseModel):
    """Full graph structure produced by Flow B (graph extraction)."""
    nodes: list[LangFlowNodeChunk]
    edges: list[dict[str, Any]]


class LangFlowQuizOutput(BaseModel):
    """Single quiz question produced by Flow C."""
    question: str


class LangFlowEvalOutput(BaseModel):
    """Evaluation result produced by Flow D."""
    score: int       # 0-100
    feedback: str
