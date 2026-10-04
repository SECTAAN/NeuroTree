import uuid
from datetime import datetime
from typing import List, TYPE_CHECKING
from sqlalchemy import String, DateTime, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.node import Node
    from app.models.edge import Edge


class Session(Base):
    __tablename__ = "sessions"

    uuid: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    # Multi-session: stable browser/user identity (X-User-ID).
    # Backfilled to uuid for rows created before this column existed.
    user_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        default="",
        server_default="",
        index=True,
    )
    # F-2: tree identity set during material ingest
    tree_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="",
        server_default="",
    )
    learning_goal: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        server_default="",
    )

    # Relationships
    nodes: Mapped[List["Node"]] = relationship(
        "Node", back_populates="session", cascade="all, delete-orphan"
    )
    edges: Mapped[List["Edge"]] = relationship(
        "Edge", back_populates="session", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Session uuid={self.uuid}>"
