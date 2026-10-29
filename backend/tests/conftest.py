"""Test setup.

By default tests run against an in-memory SQLite database built from the ORM models.
Set TEST_DATABASE_URL to run them against a real (throwaway!) Postgres database instead;
its public schema is dropped and rebuilt from database/01_schema.sql for every test:

    TEST_DATABASE_URL=postgresql+psycopg://shift:change_me@localhost:5432/shift_handoff_test pytest
"""

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.main import app
from app.models import Base

SCHEMA_SQL = Path(__file__).resolve().parents[2] / "database" / "01_schema.sql"
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


def _sqlite_engine():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def _enable_fks(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    return engine


def _postgres_engine():
    engine = create_engine(TEST_DATABASE_URL)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        conn.exec_driver_sql(SCHEMA_SQL.read_text())
    return engine


@pytest.fixture
def client():
    engine = _postgres_engine() if TEST_DATABASE_URL else _sqlite_engine()
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        with TestSession() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def make_user(client):
    """Register a user and return (user_json, auth_headers)."""
    counter = iter(range(1, 10_000))

    def _make(name="Test User", department="Front Desk", password="password123"):
        email = f"user{next(counter)}@example.com"
        r = client.post(
            "/auth/register",
            json={"name": name, "email": email, "password": password, "department": department},
        )
        assert r.status_code == 201, r.text
        r = client.post("/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, r.text
        return r.json()["user"], {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _make
