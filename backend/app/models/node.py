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
    # Stores a JSON list of raw NT-03 scores accumulated during one session.
    # Reset to [] at the start of each new session (question_index == 0).
    # Never read by frontend — backend-only accumulator.
    quiz_session_scores: Mapped[Any] = mapped_column(
        JSON, nullable=True, default=list, server_default="[]"
    )

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
