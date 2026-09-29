from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import FastAPI

from app.core.config import get_settings


def configure_cors(app: FastAPI) -> None:
    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _get_user_id_or_ip(request) -> str:
    user_id = request.headers.get("X-User-ID")
    if user_id:
        return user_id
    return get_remote_address(request)


limiter = Limiter(key_func=_get_user_id_or_ip)
