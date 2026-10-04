from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "NeuroTree API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./neurotree.db"

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",
    ]

    # Rate Limiting
    # F-7B: raised from 5 to 20/minute — a 3-question session costs 3 evaluate
    # calls + 3 generate calls (= 6 total); 20/minute gives comfortable headroom
    # for two concurrent sessions without hitting the limit.
    RATE_LIMIT_QUIZ: str = "20/minute"
    RATE_LIMIT_INGEST: str = "3/minute"

    # ── LangFlow ──────────────────────────────────────────────────────────────
    LANGFLOW_BASE_URL: str = "http://localhost:7860"
    LANGFLOW_API_KEY: str = ""

    # Flow IDs — copy from your LangFlow workspace and set in .env
    LANGFLOW_FLOW_NT01: str = "fb98c393-ef54-4ccd-b768-e6539ef0fe6b"
    LANGFLOW_FLOW_NT02: str = "92abecf5-f542-47ec-a287-08023c6c855e"
    LANGFLOW_FLOW_NT03: str = "6d3c531f-6ba6-4249-b160-a6ba787e9033"
    LANGFLOW_FLOW_NT04: str = "c559e197-7845-495f-9c21-0ebbefe9f58e"
    LANGFLOW_FLOW_NT05: str = "cdc32939-0703-4d0c-948d-ae28b3878bed"

    # Mock mode — set True to bypass LangFlow and return pre-built mock data.
    # Useful during demos if LangFlow is unreachable (Phase 11 anti-failure guard).
    USE_MOCK_AI: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
