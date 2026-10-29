def _create(client, headers, **body):
    r = client.post("/tasks", json={"title": "Room 312 AC broken", **body}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _actions(client, headers, task_id):
    return [e["action"] for e in client.get(f"/tasks/{task_id}/events", headers=headers).json()]


def test_create_task_defaults_and_events(client, make_user):
    me, headers = make_user()
    tech, _ = make_user(name="Marcus", department="Maintenance")

    task = _create(client, headers, priority="high", assigned_user_id=tech["id"])
    assert task["status"] == "open"
    assert task["priority"] == "high"
    assert task["created_by"] == me["id"]
    assert task["assignee"]["id"] == tech["id"]
    # Department follows the assignee when not given.
    assert task["assigned_department"] == "Maintenance"
    assert task["created_in_shift"] is None  # no active shift

    events = client.get(f"/tasks/{task['id']}/events", headers=headers).json()
    assert [(e["action"], e["new_value"]) for e in events] == [("created", "open"), ("assigned", str(tech["id"]))]


def test_create_task_stamps_active_shift(client, make_user):
    _, headers = make_user()
    shift = client.post("/shifts", json={"name": "Morning"}, headers=headers).json()
    assert _create(client, headers)["created_in_shift"] == shift["id"]


def test_create_task_validation(client, make_user):
    _, headers = make_user()
    assert client.post("/tasks", json={"title": ""}, headers=headers).status_code == 422
    assert client.post("/tasks", json={"title": "x", "priority": "urgent"}, headers=headers).status_code == 422
    r = client.post("/tasks", json={"title": "x", "assigned_user_id": 999}, headers=headers)
    assert r.status_code == 400


def test_update_task_logs_changes(client, make_user):
    _, headers = make_user()
    task = _create(client, headers)

    r = client.patch(f"/tasks/{task['id']}", json={"priority": "high", "description": "Warm air"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["priority"] == "high"
    assert r.json()["description"] == "Warm air"
    assert _actions(client, headers, task["id"]) == ["created", "description_changed", "priority_changed"]

    # No-op update logs nothing.
    client.patch(f"/tasks/{task['id']}", json={"priority": "high"}, headers=headers)
    assert len(_actions(client, headers, task["id"])) == 3

    assert client.patch(f"/tasks/{task['id']}", json={"title": None}, headers=headers).status_code == 400
    assert client.patch("/tasks/999", json={"title": "x"}, headers=headers).status_code == 404


def test_assign_reassign_unassign(client, make_user):
    _, headers = make_user()
    a, _ = make_user(name="A", department="Housekeeping")
    b, _ = make_user(name="B", department="Maintenance")
    task = _create(client, headers)

    r = client.put(f"/tasks/{task['id']}/assignment", json={"assigned_user_id": a["id"]}, headers=headers)
    assert r.json()["assigned_user_id"] == a["id"]
    assert r.json()["assigned_department"] == "Housekeeping"

    r = client.put(f"/tasks/{task['id']}/assignment", json={"assigned_user_id": b["id"]}, headers=headers)
    assert r.json()["assigned_department"] == "Maintenance"

    r = client.put(f"/tasks/{task['id']}/assignment", json={"assigned_user_id": None}, headers=headers)
    assert r.json()["assigned_user_id"] is None
    assert r.json()["assigned_department"] == "Maintenance"  # stays in that department's queue

    events = client.get(f"/tasks/{task['id']}/events", headers=headers).json()
    assigned = [(e["old_value"], e["new_value"]) for e in events if e["action"] == "assigned"]
    assert assigned == [(None, str(a["id"])), (str(a["id"]), str(b["id"])), (str(b["id"]), None)]


def test_status_changes(client, make_user):
    _, headers = make_user()
    task = _create(client, headers)
    url = f"/tasks/{task['id']}/status"

    r = client.put(url, json={"status": "in_progress"}, headers=headers)
    assert r.json()["status"] == "in_progress"
    assert r.json()["completed_at"] is None

    r = client.put(url, json={"status": "completed", "comment": "Replaced capacitor"}, headers=headers)
    assert r.json()["status"] == "completed"
    assert r.json()["completed_at"] is not None

    r = client.put(url, json={"status": "open"}, headers=headers)  # reopen
    assert r.json()["completed_at"] is None

    assert client.put(url, json={"status": "done"}, headers=headers).status_code == 422
    assert _actions(client, headers, task["id"]) == [
        "created", "status_changed", "status_changed", "comment", "status_changed",
    ]


def test_comments_and_detail(client, make_user):
    _, headers = make_user()
    task = _create(client, headers)
    r = client.post(f"/tasks/{task['id']}/comments", json={"text": "Part delayed"}, headers=headers)
    assert r.status_code == 201
    assert r.json()["new_value"] == "Part delayed"

    detail = client.get(f"/tasks/{task['id']}", headers=headers).json()
    assert [e["action"] for e in detail["events"]] == ["created", "comment"]
    assert detail["handoff_ids"] == []


def test_list_filters(client, make_user):
    me, headers = make_user()
    other, _ = make_user(department="Maintenance")
    low = _create(client, headers, title="Pool light", priority="low")
    high = _create(client, headers, title="Elevator noise", priority="high", assigned_user_id=other["id"])
    mine = _create(client, headers, title="VIP amenity", assigned_user_id=me["id"])
    client.put(f"/tasks/{low['id']}/status", json={"status": "completed"}, headers=headers)

    def ids(**params):
        r = client.get("/tasks", params=params, headers=headers)
        assert r.status_code == 200, r.text
        return [t["id"] for t in r.json()]

    assert ids() == [high["id"], mine["id"], low["id"]]  # by priority
    assert ids(unfinished=True) == [high["id"], mine["id"]]
    assert ids(status=["completed"]) == [low["id"]]
    assert ids(status=["open", "completed"]) == [high["id"], mine["id"], low["id"]]
    assert ids(mine=True) == [mine["id"]]
    assert ids(assigned_department="maintenance") == [high["id"]]
    assert ids(unassigned=True) == [low["id"]]
    assert ids(q="elevator") == [high["id"]]
    assert ids(limit=1, offset=1) == [mine["id"]]
