import uuid
from fastapi import Header, HTTPException, status
from sqlalchemy.orm import Session as DbSession

from app.db.database import get_db  # noqa: F401 – re-exported for convenience


def get_current_user_id(x_user_id: str = Header(...)) -> str:
    """
    Extracts and validates the X-User-ID header.
    Raises 400 if the value is not a valid UUID format.
    """
    try:
        uuid.UUID(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header X-User-ID harus berupa UUID yang valid.",
        )
    return x_user_id
