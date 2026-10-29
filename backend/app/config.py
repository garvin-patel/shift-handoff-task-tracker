from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    """App settings, read from environment variables or the repo-root .env file."""

    # Look for .env in the current dir (repo root) and its parent (when run from backend/).
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    postgres_user: str = "shift"
    postgres_password: str = "change_me"
    postgres_db: str = "shift_handoff"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    # Optional full override, e.g. postgresql+psycopg://user:pass@host:5432/db
    database_url: str | None = None

    jwt_secret: str = "dev-only-insecure-secret-change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # Comma-separated list of allowed frontend origins.
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def sqlalchemy_url(self) -> URL | str:
        if self.database_url:
            return self.database_url
        return URL.create(
            "postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
