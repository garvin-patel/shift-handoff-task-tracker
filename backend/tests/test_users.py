def _login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_supervisor_adds_staff_with_usual_shift(client, make_user):
    _, supervisor = make_user(role="supervisor")
    body = {
        "name": "Nora Diaz", "email": "nora.diaz@example.com", "password": "temp-pass-123",
        "department": "Housekeeping", "role": "employee", "usual_shift": "Night",
    }
    r = client.post("/users", json=body, headers=supervisor)
    assert r.status_code == 201, r.text
    assert r.json()["usual_shift"] == "Night"
    assert r.json()["role"] == "employee"

    # The new person signs in with their work email and the temporary password.
    r = _login(client, "nora.diaz@example.com", "temp-pass-123")
    assert r.status_code == 200
    assert r.json()["user"]["usual_shift"] == "Night"


def test_unknown_usual_shift_rejected(client, make_user):
    _, supervisor = make_user(role="supervisor")
    body = {"name": "X", "email": "x@example.com", "password": "temp-pass-123", "usual_shift": "Afternoon"}
    assert client.post("/users", json=body, headers=supervisor).status_code == 422


def test_change_own_password(client, make_user):
    user, headers = make_user(password="temp-pass-123")
    url = "/users/me/password"

    r = client.post(url, json={"current_password": "wrong-pass", "new_password": "brand-new-pass"}, headers=headers)
    assert r.status_code == 400
    assert client.post(url, json={"current_password": "temp-pass-123", "new_password": "short"}, headers=headers).status_code == 422

    r = client.post(url, json={"current_password": "temp-pass-123", "new_password": "brand-new-pass"}, headers=headers)
    assert r.status_code == 204
    assert _login(client, user["email"], "temp-pass-123").status_code == 401
    assert _login(client, user["email"], "brand-new-pass").status_code == 200


def test_change_password_requires_login(client):
    r = client.post("/users/me/password", json={"current_password": "a", "new_password": "brand-new-pass"})
    assert r.status_code == 401
