import uuid
from typing import Optional
from fastapi import Header, HTTPException, status

from app.db.database import get_db  # noqa: F401 – re-exported for convenience


def get_current_user_id(x_user_id: str = Header(...)) -> str:
    """
    Extracts and validates the X-User-ID header (stable browser/user identity).
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


def get_active_session_id(
    x_session_id: Optional[str] = Header(default=None),
    x_user_id: str = Header(...),
) -> str:
    """
    Returns the active tree/session ID for scoping graph, node, and quiz queries.

    Multi-session path (X-Session-ID header present):
      Uses X-Session-ID as the session scope.
      Validates it is a UUID; raises 400 otherwise.

    Backward-compat path (X-Session-ID absent):
      Falls back to X-User-ID so existing single-session flows keep working.
    """
    raw = x_session_id if x_session_id else x_user_id
    try:
        uuid.UUID(raw)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header X-Session-ID harus berupa UUID yang valid.",
        )
    return raw
