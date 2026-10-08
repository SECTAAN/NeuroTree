from typing import List, TYPE_CHECKING, Any
from sqlalchemy import String, Text, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.session import Session
    from app.models.edge import Edge


class Node(Base):
    """
    Represents a single knowledge chunk (light bulb) in the circuit.
    mastery_score: 0.0 – 100.0 (battery level)
    status: 'locked' | 'unlocked'
    last_expected_answer: most recent NT-02 expected_answer for this node,
        stored server-side so NT-03 can use it during evaluation without
        ever exposing it to the frontend.
    """
    __tablename__ = "nodes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sessions.uuid", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_concepts: Mapped[Any] = mapped_column(JSON, nullable=True, default=list)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="locked")
    mastery_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    last_expected_answer: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    # F-5: stores the NT-02 question text so NT-03 can evaluate against the actual question
    last_question: Mapped[str | None] = mapped_column(Text, nullable=True, default=None, server_default="")
    # F-7A: in-progress scores for the current 3-question quiz session.
    quiz_session_scores: Mapped[Any] = mapped_column(
        JSON, nullable=True, default=list, server_default="[]"
    )
    # M-5: node_type distinguishes regular knowledge nodes from the final Master Light node.
    # 'knowledge' (default) | 'master_light'
    node_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default="knowledge", server_default="knowledge"
    )
    # M-5: master_light_unlocked — True when all prerequisite knowledge nodes
    # are mastered (mastery_score >= 70). Set by check_and_unlock_dependents.
    master_light_unlocked: Mapped[bool] = mapped_column(
        nullable=False, default=False, server_default="0"
    )
    # M-5: master_light_mastery — committed ML assessment score (0–100).
    # Only written after the Q2 evaluation of the Master Light 3-question session.
    master_light_mastery: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0"
    )
    # M-5: in-progress ML assessment scores (same accumulator pattern as quiz_session_scores).
    ml_session_scores: Mapped[Any] = mapped_column(
        JSON, nullable=True, default=list, server_default="[]"
    )
    # M-5: last ML assessment question text (stored server-side like last_question).
    ml_last_question: Mapped[str | None] = mapped_column(Text, nullable=True, default=None, server_default="")
    # M-5: last ML expected answer (stored server-side).
    ml_last_expected_answer: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    # Relationships
    session: Mapped["Session"] = relationship(
        "Session", back_populates="nodes"
    )
    outgoing_edges: Mapped[List["Edge"]] = relationship(
        "Edge",
        foreign_keys="[Edge.source_id]",
        back_populates="source_node",
        cascade="all, delete-orphan",
    )
    incoming_edges: Mapped[List["Edge"]] = relationship(
        "Edge",
        foreign_keys="[Edge.target_id]",
        back_populates="target_node",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Node id={self.id} title={self.title!r} mastery={self.mastery_score}>"
