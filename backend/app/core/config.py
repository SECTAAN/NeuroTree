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
    RATE_LIMIT_QUIZ: str = "5/minute"
    RATE_LIMIT_INGEST: str = "3/minute"

    # LangFlow (used in Milestone 5)
    LANGFLOW_BASE_URL: str = "http://localhost:7860"
    LANGFLOW_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
