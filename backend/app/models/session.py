import uuid
from datetime import datetime
from typing import List, TYPE_CHECKING
from sqlalchemy import String, DateTime
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

    # Relationships
    nodes: Mapped[List["Node"]] = relationship(
        "Node", back_populates="session", cascade="all, delete-orphan"
    )
    edges: Mapped[List["Edge"]] = relationship(
        "Edge", back_populates="session", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Session uuid={self.uuid}>"
