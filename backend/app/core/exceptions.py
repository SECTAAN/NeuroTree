from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger(__name__)


class NeuroTreeException(Exception):
    """Base exception for NeuroTree-specific errors."""
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NodeNotFoundException(NeuroTreeException):
    def __init__(self, node_id: str):
        super().__init__(
            message=f"Node '{node_id}' tidak ditemukan dalam sirkuit.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class SessionNotFoundException(NeuroTreeException):
    def __init__(self, session_id: str):
        super().__init__(
            message=f"Sesi '{session_id}' tidak ditemukan.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


async def neurotree_exception_handler(request: Request, exc: NeuroTreeException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Input tidak valid. Periksa kembali data yang Anda kirim."},
    )


async def internal_server_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Internal Server Error on %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Sirkuit AI sedang mengalami gangguan sementara."},
    )
