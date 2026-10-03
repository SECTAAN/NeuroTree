"""
Pydantic schemas for LangFlow flow responses.

NT-01 raw output schema  — matches the actual JSON returned by NT-01.
Internal graph schema    — used by the rest of the backend (nodes + edges).
NT-02 / NT-03 schemas    — quiz generation and evaluation (Phase C).
NT-04 schema             — adaptive learning recommendation (Phase D).
NT-05 schema             — knowledge gap & personalized learning pathway (Phase E).
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


# ── NT-02 raw output ──────────────────────────────────────────────────────────

class NT02Output(BaseModel):
    """Full NT-02 response — active recall question for one chunk."""
    chunk_id: str
    question: str
    expected_answer: str
    key_concepts: list[str] = Field(default_factory=list)
    difficulty: int = 1
    question_type: str = "conceptual"


# ── NT-03 raw output ──────────────────────────────────────────────────────────

class NT03Output(BaseModel):
    """Full NT-03 response — mastery evaluation for one answer."""
    chunk_id: str
    correctness: float           # 0–100
    concept_coverage: float      # 0–100
    understanding: float         # 0–100
    mastery_score: float         # 0–100  ← stored directly as Node.mastery_score (Option A)
    missing_concepts: list[str] = Field(default_factory=list)
    feedback: str
    next_action: str             # "unlock" | "review"


# ── Internal quiz/eval representations ───────────────────────────────────────

class LangFlowQuizOutput(BaseModel):
    """
    Quiz question returned by generate_quiz_question().

    expected_answer is stored server-side (Node.last_expected_answer) and
    never forwarded to the frontend — it is consumed only by NT-03.
    """
    question: str
    expected_answer: str = ""
    key_concepts: list[str] = Field(default_factory=list)


class LangFlowEvalOutput(BaseModel):
    """
    Evaluation result returned by evaluate_answer().

    Option A: NT-03's mastery_score is the final mastery value.
    It is stored directly in Node.mastery_score — NOT passed through
    calculate_progressive_mastery().
    """
    score: float            # NT-03 mastery_score stored to DB
    feedback: str
    missing_concepts: list[str] = Field(default_factory=list)
    next_action: str = "review"  # "unlock" | "review"


# ── NT-04 raw output ──────────────────────────────────────────────────────────

class NT04ProgressSummary(BaseModel):
    """Nested progress summary from NT-04."""
    total_chunks: int = 0
    mastered_chunks: int = 0
    completion_percentage: float = 0.0


class NT04Output(BaseModel):
    """
    Full NT-04 response — adaptive recommendation for the next learning action.

    action values: "unlock" | "review" | "next_chunk" | "fill_gap"
    priority values: "high" | "medium" | "low"
    """
    action: str
    target_chunk_id: str = ""
    target_chunk_title: str = ""
    reason: str = ""
    priority: str = "medium"
    suggested_review_chunks: list[str] = Field(default_factory=list)
    progress_summary: NT04ProgressSummary = Field(default_factory=NT04ProgressSummary)


# ── NT-05 raw output ──────────────────────────────────────────────────────────

class NT05PathStep(BaseModel):
    """One step in the NT-05 recommended learning path."""
    step: int
    chunk_id: str
    chunk_title: str
    reason: str = ""


class NT05Output(BaseModel):
    """
    Full NT-05 response — knowledge gap analysis and personalized learning pathway.

    NT-05 receives: career_goal, mastered_chunks, weak_chunks, missing_chunks
    NT-05 returns:  strong_concepts, weak_concepts, knowledge_gaps,
                    missing_prerequisites, recommended_path, reasoning,
                    estimated_completion_days
    """
    target_goal: str = ""
    strong_concepts: list[str] = Field(default_factory=list)
    weak_concepts: list[str] = Field(default_factory=list)
    knowledge_gaps: list[str] = Field(default_factory=list)
    missing_prerequisites: list[str] = Field(default_factory=list)
    recommended_path: list[NT05PathStep] = Field(default_factory=list)
    estimated_completion_days: int = 0
    reasoning: str = ""
