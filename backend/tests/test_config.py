import secrets

import pytest
from pydantic import ValidationError

from app.config import DEFAULT_JWT_SECRET, Settings


def _settings(**values):
    # _env_file=None: ignore the developer's .env so only these values count.
    return Settings(_env_file=None, **values)


def test_development_allows_placeholder_secret():
    assert _settings(app_env="development").jwt_secret == DEFAULT_JWT_SECRET


@pytest.mark.parametrize(
    "secret",
    [DEFAULT_JWT_SECRET, "change_me_to_a_long_random_string", "too-short"],
    ids=["built-in default", ".env.example placeholder", "too short"],
)
def test_production_rejects_weak_secret(secret):
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        _settings(app_env="production", jwt_secret=secret)


def test_production_requires_secret_to_be_set(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        _settings(app_env="production")


def test_production_accepts_random_secret():
    secret = secrets.token_urlsafe(48)
    assert _settings(app_env="production", jwt_secret=secret).jwt_secret == secret
