"""Integration tests use migrations and a separate PostgreSQL database.

Each test uses an outer transaction that rolls back even when application code commits.
"""
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from dotenv import dotenv_values
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.main import app
from backend.app.models import User
from backend.app.security import password_hasher


@pytest.fixture(scope="session")
def engine():
    env = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
    test_url = os.environ.get("TEST_DATABASE_URL") or env.get("TEST_DATABASE_URL")
    app_url = os.environ.get("DATABASE_URL") or env.get("DATABASE_URL")
    if not test_url:
        pytest.fail("TEST_DATABASE_URL is required; tests must use a separate PostgreSQL database")
    parsed = make_url(test_url)
    if parsed.get_backend_name() != "postgresql" or not parsed.database.endswith("_test"):
        pytest.fail("TEST_DATABASE_URL must name a PostgreSQL database ending in _test")
    if app_url:
        production = make_url(app_url)
        if (parsed.host, parsed.port, parsed.database) == (production.host, production.port, production.database):
            pytest.fail("Tests cannot use the application database")
    config = Config("alembic.ini")
    config.attributes["database_url"] = test_url
    command.upgrade(config, "head")
    engine = create_engine(test_url)
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine):
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
            yield session
        transaction.rollback()


@pytest.fixture
def client(db):
    def test_db():
        yield db
    app.dependency_overrides[get_db] = test_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def users(db):
    result = {}
    for role in ("employee", "supervisor"):
        user = User(email=f"test-{role}@gsa.example", display_name=role.title(), role=role,
                    password_hash=password_hasher.hash("test-password-123"))
        db.add(user)
        result[role] = user
    db.commit()
    return result
