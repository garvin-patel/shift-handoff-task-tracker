from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

DEFAULT_JWT_SECRET = "dev-only-insecure-secret-change-me-in-env"
# Secrets that are public (in this repo), so they must never be used outside development.
PLACEHOLDER_JWT_SECRETS = {DEFAULT_JWT_SECRET, "change_me_to_a_long_random_string"}
MIN_JWT_SECRET_LENGTH = 32


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

    # "development" allows a placeholder JWT secret; any other value (e.g. "production") requires a real one.
    app_env: str = "development"

    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # Comma-separated list of allowed frontend origins.
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    @model_validator(mode="after")
    def _require_real_jwt_secret(self) -> "Settings":
        """Refuse to start outside development with a guessable JWT secret.

        Anyone who knows the secret can sign their own login tokens.
        """
        if self.app_env != "development" and (
            self.jwt_secret in PLACEHOLDER_JWT_SECRETS or len(self.jwt_secret) < MIN_JWT_SECRET_LENGTH
        ):
            raise ValueError(
                f"JWT_SECRET must be a random string of at least {MIN_JWT_SECRET_LENGTH} characters "
                f"when APP_ENV is {self.app_env!r}. Generate one with: "
                'python3 -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return self

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
