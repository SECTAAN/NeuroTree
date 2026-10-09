import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.security import configure_cors, limiter
from app.core.exceptions import (
    NeuroTreeException,
    neurotree_exception_handler,
    validation_exception_handler,
    internal_server_error_handler,
)
from app.db.database import engine, Base
from app.models import Session, Node, Edge  # noqa: F401 – registers models with Base
from app.api import material, quiz, career, extract, master_light

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all database tables on startup if they don't exist yet."""
    logger.info("⚡ NeuroTree booting up — initialising database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables ready.")
    yield
    logger.info("🔌 NeuroTree shutting down.")


settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "NeuroTree Backend — AI Adaptive Learning Platform. "
        "Transforms static documents into interactive knowledge-graph circuits."
    ),
    lifespan=lifespan,
)

# ── Security ──────────────────────────────────────────────────────────────────
configure_cors(app)
app.state.limiter = limiter

# ── Exception Handlers ────────────────────────────────────────────────────────
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(NeuroTreeException, neurotree_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, internal_server_error_handler)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(material.router, prefix="/api/v1")
app.include_router(quiz.router, prefix="/api/v1")
app.include_router(career.router, prefix="/api/v1")
app.include_router(extract.router,       prefix="/api/v1")
app.include_router(master_light.router,  prefix="/api/v1")


# ── Health Checks ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {
        "project": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "⚡ Sirkuit aktif.",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
