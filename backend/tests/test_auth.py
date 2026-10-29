from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings
from app.security import verify_password


def test_login_and_me(client, make_user):
    user, headers = make_user(name="Maria", department="Front Desk")
    assert user["role"] == "employee"

    r = client.get("/users/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Maria"


def test_duplicate_email_rejected(client, make_user):
    _, supervisor = make_user(role="supervisor")
    body = {"name": "A", "email": "a@example.com", "password": "password123"}
    assert client.post("/users", json=body, headers=supervisor).status_code == 201
    assert client.post("/users", json={**body, "email": "A@example.com"}, headers=supervisor).status_code == 409


def test_wrong_password(client, make_user):
    user, _ = make_user()
    r = client.post("/auth/login", json={"email": user["email"], "password": "wrong-password"})
    assert r.status_code == 401


def test_form_token_endpoint(client, make_user):
    user, _ = make_user()
    r = client.post("/auth/token", data={"username": user["email"], "password": "password123"})
    assert r.status_code == 200
    assert r.json()["token_type"] == "bearer"


def test_requires_auth(client):
    assert client.get("/tasks").status_code == 401
    assert client.get("/tasks", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_only_supervisors_create_users(client, make_user):
    _, employee = make_user()
    _, supervisor = make_user(role="supervisor")
    body = {"name": "B", "email": "b@example.com", "password": "password123", "role": "supervisor"}
    assert client.post("/users", json=body, headers=employee).status_code == 403

    r = client.post("/users", json=body, headers=supervisor)
    assert r.status_code == 201
    assert r.json()["role"] == "supervisor"


def test_self_registration_is_off(client):
    body = {"name": "C", "email": "c@example.com", "password": "password123"}
    assert client.post("/auth/register", json=body).status_code == 404
    assert client.post("/auth/login", json={"email": "c@example.com", "password": "password123"}).status_code == 401


def _token(user_id, *, expires_in, secret=None):
    payload = {"sub": str(user_id), "exp": datetime.now(timezone.utc) + expires_in}
    return jwt.encode(payload, secret or settings.jwt_secret, algorithm=settings.jwt_algorithm)


def test_expired_token_rejected(client, make_user):
    user, _ = make_user()
    valid = _token(user["id"], expires_in=timedelta(minutes=5))
    expired = _token(user["id"], expires_in=timedelta(minutes=-1))
    assert client.get("/users/me", headers={"Authorization": f"Bearer {valid}"}).status_code == 200
    assert client.get("/users/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_token_signed_with_other_secret_rejected(client, make_user):
    user, _ = make_user()
    forged = _token(user["id"], expires_in=timedelta(minutes=5), secret="someone-elses-secret-" + "x" * 32)
    assert client.get("/users/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_seed_placeholder_hash_never_matches():
    # A placeholder like this (used by the database constraint tests) must never let anyone in.
    assert verify_password("fake_hash_demo_only", "fake_hash_demo_only") is False
    assert verify_password("password123", "fake_hash_demo_only") is False
