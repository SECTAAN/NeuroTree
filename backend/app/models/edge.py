import uuid
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.session import Session
    from app.models.node import Node


class Edge(Base):
    """
    Represents a prerequisite cable connecting two Nodes.
    source_id must be mastered before target_id can be unlocked.

    Annotation columns (Stage 1 — UAT fix):
      note            — Wi-Fi note icon text; NULL when no note exists.
      router_enabled  — True when the ▣ router marker is active on this edge.
    """
    __tablename__ = "edges"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sessions.uuid", ondelete="CASCADE"), nullable=False
    )
    source_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False
    )
    target_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False
    )
    relationship_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="prerequisite"
    )
    # Edge annotations — Stage 1
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    router_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    session: Mapped["Session"] = relationship(
        "Session", back_populates="edges"
    )
    source_node: Mapped["Node"] = relationship(
        "Node",
        foreign_keys="[Edge.source_id]",
        back_populates="outgoing_edges",
    )
    target_node: Mapped["Node"] = relationship(
        "Node",
        foreign_keys="[Edge.target_id]",
        back_populates="incoming_edges",
    )

    def __repr__(self) -> str:
        return f"<Edge {self.source_id} -> {self.target_id} ({self.relationship_type})>"
