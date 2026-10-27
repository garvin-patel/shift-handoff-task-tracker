from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: SecretStr
    access_token_minutes: int = Field(default=30, ge=1, le=60)
    cors_origins: list[str] = ["http://localhost:5173"]

    @field_validator("jwt_secret")
    @classmethod
    def validate_secret(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if len(raw) < 32 or raw.startswith("REPLACE_"):
            raise ValueError("JWT_SECRET must contain at least 32 random characters")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
