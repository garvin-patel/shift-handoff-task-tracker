from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.exc import OperationalError

from backend.app.config import get_settings
from backend.app.models import User
from backend.app.security import AUDIENCE, ISSUER, create_access_token


def headers(user):
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def test_login_and_current_user(client, users):
    response = client.post("/api/v1/auth/login", json={
        "email": " TEST-EMPLOYEE@GSA.EXAMPLE ", "password": "test-password-123"})
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer" and body["expires_in"] == 1800
    assert response.headers["cache-control"] == "no-store"
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["id"] == str(users["employee"].id)
    assert me.json()["role"] == "employee"
    assert "password_hash" not in me.json()


@pytest.mark.parametrize("email,password", [
    ("test-employee@gsa.example", "wrong"), ("unknown@gsa.example", "test-password-123")])
def test_bad_login_has_same_error(client, users, email, password):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or missing authentication"}


@pytest.mark.parametrize("authorization", [None, "Bearer invalid", "Basic abc"])
def test_missing_or_bad_token(client, authorization):
    response = client.get("/api/v1/auth/me", headers={"Authorization": authorization} if authorization else {})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("role,status", [("employee", 403), ("supervisor", 200)])
def test_role_enforcement(client, users, role, status):
    assert client.get("/api/v1/demo/supervisor", headers=headers(users[role])).status_code == status


@pytest.mark.parametrize("change", ["expired", "wrong_signature", "wrong_audience", "missing_exp", "bad_sub"])
def test_invalid_jwt_claims(client, users, change):
    now = datetime.now(timezone.utc)
    payload = {"sub": str(users["employee"].id), "iat": now, "exp": now + timedelta(minutes=5),
               "iss": ISSUER, "aud": AUDIENCE}
    key = get_settings().jwt_secret.get_secret_value()
    if change == "expired":
        payload["exp"] = now - timedelta(seconds=5)
    elif change == "wrong_signature":
        key = "another-secret-that-is-long-enough-for-hs256"
    elif change == "wrong_audience":
        payload["aud"] = "other-app"
    elif change == "missing_exp":
        del payload["exp"]
    else:
        payload["sub"] = "not-a-uuid"
    token = jwt.encode(payload, key, algorithm="HS256")
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_inactive_user_cannot_login_or_reuse_token(client, db, users):
    auth = headers(users["employee"])
    users["employee"].is_active = False
    db.commit()
    assert client.get("/api/v1/auth/me", headers=auth).status_code == 401
    assert client.post("/api/v1/auth/login", json={
        "email": "test-employee@gsa.example", "password": "test-password-123"}).status_code == 401


def test_role_change_applies_to_existing_token(client, db, users):
    auth = headers(users["supervisor"])
    users["supervisor"].role = "employee"
    db.commit()
    assert client.get("/api/v1/demo/supervisor", headers=auth).status_code == 403


def test_deleted_user_token_denied(client):
    token = create_access_token(uuid4())
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


@pytest.mark.parametrize("email,role", [
    ("test-employee@gsa.example", "employee"),
    ("new@gsa.example", "admin"),
    ("UPPER@gsa.example", "employee"),
])
def test_database_rejects_invalid_users(db, users, email, role):
    db.add(User(email=email, display_name="Invalid", role=role, password_hash="unused"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_password_is_hashed(db, users):
    saved = db.scalar(select(User).where(User.id == users["employee"].id))
    assert saved.password_hash.startswith("$argon2id$")
    assert saved.password_hash != "test-password-123"


def test_health_checks(client):
    assert client.get("/health/live").json() == {"status": "ok"}
    assert client.get("/health/ready").json() == {"status": "ready"}


def test_readiness_reports_database_failure(client, monkeypatch, db):
    def unavailable(*args, **kwargs):
        raise OperationalError("SELECT", {}, Exception("database offline"))
    monkeypatch.setattr(db, "execute", unavailable)
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable or migrations missing"}
