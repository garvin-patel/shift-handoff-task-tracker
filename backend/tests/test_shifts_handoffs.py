def _task(client, headers, title, **body):
    r = client.post("/tasks", json={"title": title, **body}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _status(client, headers, task_id, status):
    r = client.put(f"/tasks/{task_id}/status", json={"status": status}, headers=headers)
    assert r.status_code == 200, r.text


def test_only_one_active_shift(client, make_user):
    _, headers = make_user(role="supervisor")
    assert client.get("/shifts/current", headers=headers).json() is None

    shift = client.post("/shifts", json={"name": "Morning"}, headers=headers).json()
    assert shift["is_active"] is True
    assert client.get("/shifts/current", headers=headers).json()["id"] == shift["id"]
    assert client.post("/shifts", json={"name": "Evening"}, headers=headers).status_code == 409

    client.post(f"/shifts/{shift['id']}/end", headers=headers)
    assert client.post(f"/shifts/{shift['id']}/end", headers=headers).status_code == 409
    assert client.get("/shifts/current", headers=headers).json() is None


def test_unfinished_tasks_carry_over(client, make_user):
    _, alice = make_user(name="Alice", role="supervisor")
    _, bob = make_user(name="Bob", role="supervisor")

    morning = client.post("/shifts", json={"name": "Morning"}, headers=alice).json()
    done = _task(client, alice, "Restock towels")
    in_progress = _task(client, alice, "Room 312 AC")
    still_open = _task(client, alice, "Elevator noise")
    _status(client, alice, done["id"], "completed")
    _status(client, alice, in_progress["id"], "in_progress")

    r = client.post(f"/shifts/{morning['id']}/end", headers=alice)
    assert r.status_code == 200, r.text
    handoff = r.json()
    assert handoff["from_shift"]["id"] == morning["id"]
    assert handoff["from_shift"]["is_active"] is False
    assert handoff["to_shift"] is None
    assert [t["id"] for t in handoff["tasks"]] == [in_progress["id"], still_open["id"]]
    assert handoff["task_count"] == 2

    # Can't acknowledge until the next shift exists.
    assert client.post(f"/handoffs/{handoff['id']}/acknowledge", headers=bob).status_code == 409

    evening = client.post("/shifts", json={"name": "Evening"}, headers=bob).json()
    incoming = client.get("/handoffs/incoming", headers=bob).json()
    assert incoming["id"] == handoff["id"]
    assert incoming["to_shift"]["id"] == evening["id"]

    r = client.post(f"/handoffs/{handoff['id']}/acknowledge", headers=bob)
    assert r.status_code == 200
    assert r.json()["acknowledged_by_user"]["name"] == "Bob"
    assert r.json()["acknowledged_at"] is not None
    assert client.post(f"/handoffs/{handoff['id']}/acknowledge", headers=bob).status_code == 409

    # Task detail shows it was carried over.
    assert client.get(f"/tasks/{still_open['id']}", headers=bob).json()["handoff_ids"] == [handoff["id"]]

    # Evening finishes one, adds one; the leftover from Morning carries over again.
    _status(client, bob, in_progress["id"], "completed")
    vip = _task(client, bob, "VIP amenity")
    second = client.post(f"/shifts/{evening['id']}/end", headers=bob).json()
    assert [t["id"] for t in second["tasks"]] == [still_open["id"], vip["id"]]
    assert client.get(f"/tasks/{still_open['id']}", headers=bob).json()["handoff_ids"] == [
        handoff["id"], second["id"],
    ]

    summaries = client.get("/handoffs", headers=bob).json()
    assert [h["id"] for h in summaries] == [second["id"], handoff["id"]]
    assert client.get("/handoffs", params={"acknowledged": False}, headers=bob).json()[0]["id"] == second["id"]


def test_prepare_handoff_is_refreshed_on_end(client, make_user):
    _, headers = make_user(role="supervisor")
    shift = client.post("/shifts", json={"name": "Night"}, headers=headers).json()
    first = _task(client, headers, "First")

    prepared = client.post(f"/shifts/{shift['id']}/handoff", headers=headers).json()
    assert [t["id"] for t in prepared["tasks"]] == [first["id"]]

    _status(client, headers, first["id"], "completed")
    late = _task(client, headers, "Added after preview")

    ended = client.post(f"/shifts/{shift['id']}/end", headers=headers).json()
    assert ended["id"] == prepared["id"]
    assert [t["id"] for t in ended["tasks"]] == [late["id"]]


def test_empty_handoff_and_not_found(client, make_user):
    _, headers = make_user(role="supervisor")
    shift = client.post("/shifts", json={"name": "Morning"}, headers=headers).json()
    handoff = client.post(f"/shifts/{shift['id']}/end", headers=headers).json()
    assert handoff["tasks"] == []

    assert client.post("/shifts/999/end", headers=headers).status_code == 404
    assert client.get("/handoffs/999", headers=headers).status_code == 404
    assert client.get("/handoffs/incoming", headers=headers).json() is None
