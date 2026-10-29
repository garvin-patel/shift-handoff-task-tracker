def test_register_login_and_me(client, make_user):
    user, headers = make_user(name="Maria", department="Front Desk")
    assert user["role"] == "employee"

    r = client.get("/users/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Maria"


def test_duplicate_email_rejected(client):
    body = {"name": "A", "email": "a@example.com", "password": "password123"}
    assert client.post("/auth/register", json=body).status_code == 201
    assert client.post("/auth/register", json={**body, "email": "A@example.com"}).status_code == 409


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
    _, headers = make_user()
    body = {"name": "B", "email": "b@example.com", "password": "password123", "role": "supervisor"}
    assert client.post("/users", json=body, headers=headers).status_code == 403
