"""Supervisor-only actions: employees get 403 and nothing changes; supervisors are allowed."""


def _task(client, headers, **body):
    r = client.post("/tasks", json={"title": "Room 312 AC broken", **body}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _status(client, headers, task_id, status):
    return client.put(f"/tasks/{task_id}/status", json={"status": status}, headers=headers)


def _events(client, headers, task_id):
    return len(client.get(f"/tasks/{task_id}/events", headers=headers).json())


def test_only_supervisors_start_and_end_shifts(client, make_user):
    _, employee = make_user()
    _, supervisor = make_user(role="supervisor")

    assert client.post("/shifts", json={"name": "Evening"}, headers=employee).status_code == 403
    assert client.get("/shifts/current", headers=employee).json() is None

    shift = client.post("/shifts", json={"name": "Evening"}, headers=supervisor).json()
    assert client.post(f"/shifts/{shift['id']}/handoff", headers=employee).status_code == 403
    assert client.post(f"/shifts/{shift['id']}/end", headers=employee).status_code == 403
    assert client.get("/shifts/current", headers=employee).json()["id"] == shift["id"]

    assert client.post(f"/shifts/{shift['id']}/end", headers=supervisor).status_code == 200


def test_only_supervisors_assign_people(client, make_user):
    tech, _ = make_user(name="Marcus", department="Maintenance")
    _, employee = make_user()
    _, supervisor = make_user(role="supervisor")

    r = client.post("/tasks", json={"title": "x", "assigned_user_id": tech["id"]}, headers=employee)
    assert r.status_code == 403
    assert client.get("/tasks", headers=employee).json() == []

    # Employees can still route a task to a department.
    task = _task(client, employee, assigned_department="Maintenance")
    assert task["assigned_department"] == "Maintenance"
    assert task["assigned_user_id"] is None

    url = f"/tasks/{task['id']}/assignment"
    assert client.put(url, json={"assigned_user_id": tech["id"]}, headers=employee).status_code == 403
    r = client.put(url, json={"assigned_user_id": tech["id"]}, headers=supervisor)
    assert r.status_code == 200
    assert r.json()["assignee"]["name"] == "Marcus"


def test_only_supervisors_reopen_completed_tasks(client, make_user):
    _, employee = make_user()
    _, supervisor = make_user(role="supervisor")
    task = _task(client, employee)

    assert _status(client, employee, task["id"], "in_progress").status_code == 200
    assert _status(client, employee, task["id"], "open").status_code == 200
    assert _status(client, employee, task["id"], "completed").status_code == 200

    before = _events(client, employee, task["id"])
    assert _status(client, employee, task["id"], "open").status_code == 403
    assert _status(client, employee, task["id"], "in_progress").status_code == 403
    assert client.get(f"/tasks/{task['id']}", headers=employee).json()["status"] == "completed"
    assert _events(client, employee, task["id"]) == before

    r = _status(client, supervisor, task["id"], "open")
    assert r.status_code == 200
    assert r.json()["completed_at"] is None


def test_only_supervisors_change_priority(client, make_user):
    _, employee = make_user()
    _, supervisor = make_user(role="supervisor")
    task = _task(client, employee, priority="high")  # picking it on create is fine
    url = f"/tasks/{task['id']}"

    assert client.patch(url, json={"priority": "low"}, headers=employee).status_code == 403
    assert client.patch(url, json={"priority": "high"}, headers=employee).status_code == 200  # no change
    assert client.get(url, headers=employee).json()["priority"] == "high"

    r = client.patch(url, json={"priority": "low"}, headers=supervisor)
    assert r.status_code == 200
    assert r.json()["priority"] == "low"


def test_employees_edit_only_their_own_tasks(client, make_user):
    _, author = make_user(name="James")
    _, coworker = make_user(name="Priya")
    _, supervisor = make_user(role="supervisor")
    task = _task(client, author)
    url = f"/tasks/{task['id']}"

    assert client.patch(url, json={"title": "Changed by Priya"}, headers=coworker).status_code == 403
    assert client.patch(url, json={"title": "Room 312 AC fixed?"}, headers=author).status_code == 200
    r = client.patch(url, json={"description": "Checked by supervisor"}, headers=supervisor)
    assert r.status_code == 200
    assert r.json()["title"] == "Room 312 AC fixed?"


def test_employees_can_still_do_their_work(client, make_user):
    """Comments, status updates on anyone's task, and acknowledging handoffs stay open to employees."""
    _, author = make_user(name="James")
    _, coworker = make_user(name="Priya")
    _, supervisor = make_user(role="supervisor")

    evening = client.post("/shifts", json={"name": "Evening"}, headers=supervisor).json()
    task = _task(client, author)
    r = client.post(f"/tasks/{task['id']}/comments", json={"text": "On it"}, headers=coworker)
    assert r.status_code == 201
    assert _status(client, coworker, task["id"], "in_progress").status_code == 200

    handoff = client.post(f"/shifts/{evening['id']}/end", headers=supervisor).json()
    client.post("/shifts", json={"name": "Morning"}, headers=supervisor)
    r = client.post(f"/handoffs/{handoff['id']}/acknowledge", headers=coworker)
    assert r.status_code == 200
    assert r.json()["acknowledged_by_user"]["name"] == "Priya"
