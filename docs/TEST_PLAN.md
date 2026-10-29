# Test Plan

This plan turns the testing strategy in our project proposal (Section 4) into concrete tests. The proposal asks six questions about the workflows that would hurt most if they broke. Each question below lists its tests.

## Status

The backend is built (see [`backend/README.md`](../backend/README.md)). The frontend isn't built yet.

| Coverage | Tests | Meaning |
|---|---|---|
| ✅ | 13 | An automated test already checks this. |
| 🟡 | 7 | An automated test checks part of it. The gap is noted. |
| ⬜ | 2 | Not automated yet. |
| 🧑 | 6 | Manual. Needs the frontend, or is covered by the walkthrough. |

**Where the automated tests are:**
- [`backend/tests/`](../backend/tests/) has 18 pytest tests written by Sadbhab. They send real requests through the API (using FastAPI's `TestClient`) and check what comes back. So one test usually covers both a "unit" item and an "integration" item below.
- [`database/tests/constraints_test.sql`](../database/tests/constraints_test.sql) has 51 checks that the database enforces its rules.

**Walkthrough dry run, Oct 29 2026:** all 14 steps of the [Room 312 walkthrough](#manual-shift-change-walkthrough-room-312) passed. They were run through the API on a temporary copy of the seed data, since there's no frontend yet.

## Running the tests

**Backend tests.** First set up Python as described in [`backend/README.md`](../backend/README.md). Then:

```bash
cd backend && pytest
```

By default these run on SQLite, a small in-memory database, so they're fast. To run them on real Postgres instead, follow "Tests" in the backend README. Use a throwaway database: the tests delete everything in it.

**Database tests:**

```bash
docker exec -i shift_handoff_db sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/tests/constraints_test.sql
```

**Manual tests** start from a fresh database:

```bash
docker compose down -v
```

```bash
docker compose up -d --build
```

## Test types and owners

| Type | What it checks | Tools | Owner |
|---|---|---|---|
| **pytest unit** | One piece of backend logic, such as "which tasks go into a handoff?" | pytest | **Garvin** fills the gaps (🟡 and ⬜) |
| **Integration** | A request through the API into a real database, then checking what got saved | pytest + `TestClient` | **Sadbhab**, who wrote the current suite |
| **Manual** | A person clicking through the app in a browser | Browser, desktop and phone | **Arjun** |
| **Shift-change walkthrough** | The whole Room 312 story, end to end | Browser (or `/docs` until the frontend exists) + `psql` | **All three, Garvin leads** |

## 1. Can a user create a task?

**1.1 A valid task is saved with the right defaults** (pytest unit, Garvin) 🟡
1. Send `POST /tasks` with only a title.
2. Expect `status = open`, `priority = medium`, and `created_at` filled in.
3. Expect one `task_events` row with `action = created`.

*Covered by `test_create_task_defaults_and_events`. Gap: that test always sends a priority, so the `medium` default is never checked.*

**1.2 Bad input is rejected** (pytest unit, Garvin) ✅
1. Send `POST /tasks` with each of these: an empty title, priority `urgent`, and an assigned user who doesn't exist.
2. Expect `422`, `422` and `400`.

*Covered by `test_create_task_validation`.*

**1.3 Creating through the API saves to the database** (integration, Sadbhab) ✅
1. Send `POST /tasks`: "Room 312 AC broken", priority `high`, assigned to a Maintenance user.
2. Expect `201`, with the task's `id`, its assignee, and the department copied from that assignee.
3. Expect `GET /tasks/{id}/events` to list `created`, then `assigned`.

*Covered by `test_create_task_defaults_and_events`. Run it with `TEST_DATABASE_URL` to check it on real Postgres.*

**1.4 Creating from the form** (manual, Arjun) 🧑
1. Log in, open the create-task form, and submit a task.
2. Check that it appears on the dashboard with the right priority and owner, and that it's still there after refreshing the page.
3. Submit the form with an empty title. Check that a readable error appears.

## 2. Can the task status be updated?

**2.1 Allowed changes work and are recorded** (pytest unit, Garvin) 🟡
1. Send `PUT /tasks/{id}/status` to move a task from `open` to `in_progress`, then to `completed`.
2. After each change, expect a `status_changed` event with the correct `old_value` and `new_value`, and a newer `updated_at`.
3. After `completed`, expect `completed_at` to be filled in.

*Covered by `test_status_changes`. Gap: that test doesn't check `old_value`, `new_value` or `updated_at`.*

**2.2 An invalid status is rejected** (pytest unit, Garvin) ✅
1. Send `PUT /tasks/{id}/status` with status `done`.
2. Expect `422`, the task unchanged, and no new event.

*Covered by `test_status_changes`.*

**2.3 Updating through the API** (integration, Sadbhab) 🟡
1. Send a status update, and check the task's row and its new `task_events` row.
2. Send `PUT /tasks/999/status` for a task that doesn't exist. Expect `404`, not a crash.

*Step 1 is covered by `test_status_changes`. Gap: no test sends a status update for a missing task. The dry run confirmed it does return `404`.*

**2.4 Updating in the browser** (manual, Arjun) 🧑
1. Change a task's status on its detail screen.
2. Check that the dashboard and the task history both show the change.
3. Check that a second browser shows the change too, after a refresh.

## 3. Does a completed task stay closed?

**3.1 Ending a shift doesn't change any task's status** (pytest unit, Garvin) ⬜
1. Set up one completed task and one open task, then send `POST /shifts/{id}/end`.
2. Expect both tasks to keep exactly the status they had.

**3.2 Completed tasks are left out of the handoff** (pytest unit, Garvin) ✅
1. Set up tasks with each status, then end the shift.
2. Expect no `completed` task in the handoff.

*Covered by `test_unfinished_tasks_carry_over`.*

**3.3 A completed task stays closed across several shifts** (integration, Sadbhab) 🟡
1. Complete a task through the API, then end two shifts in a row.
2. Expect the task to still be `completed`, with the same `completed_at`, and in neither handoff.

*Partly covered by `test_unfinished_tasks_carry_over`. Gap: it checks the task is left out of the next handoff, but not that `completed_at` stays the same.*

**3.4 Completed tasks in the browser** (manual, Arjun) 🧑
1. Check that completed tasks don't show on the next shift's handoff screen.
2. Check that they can still be found in the task history.

## 4. Does an unfinished task move to the next shift?

**4.1 Open and in-progress tasks are included** (pytest unit, Garvin) ✅
1. Set up tasks with each status, then end the shift.
2. Expect every `open` and `in_progress` task to be in the handoff.

*Covered by `test_unfinished_tasks_carry_over`.*

**4.2 Older unfinished tasks are included too** (pytest unit, Garvin) ✅
1. Leave a task unfinished through one shift, then end the next shift.
2. Expect the task in the second handoff too, even though the current shift didn't create it.

*Covered by `test_unfinished_tasks_carry_over` (the "Elevator noise" task).*

**4.3 Ending a shift with the seed data creates the right handoff** (integration, Sadbhab) ⬜
1. Start from the seed data and send `POST /shifts/3/end` to end the current Evening shift.
2. Expect one new handoff with `from_shift.id = 3`, containing exactly tasks 1, 4 and 6: Room 312, the elevator and the VIP amenity.

*Not automated yet: the pytest suite builds its own data instead of using the seed. The dry run confirmed this works.*

**4.4 Only one shift can be active at a time** (integration, Sadbhab) ✅
1. Start a shift with `POST /shifts`, then try to start a second one.
2. Expect `409` for the second shift.

*Covered by `test_only_one_active_shift`.*

**4.5 The next shift sees the tasks** (manual, Arjun) 🧑

Covered in steps 7 to 9 of the walkthrough.

## 5. Can the next shift acknowledge the handoff?

**5.1 Acknowledging records who and when** (pytest unit, Garvin) ✅
1. Start the next shift, then send `POST /handoffs/{id}/acknowledge`.
2. Expect `acknowledged_by_user` to be that user and `acknowledged_at` to be filled in.

*Covered by `test_unfinished_tasks_carry_over`.*

**5.2 Acknowledging twice is rejected** (pytest unit, Garvin) 🟡
1. Acknowledge the same handoff again, as anyone.
2. Expect `409`, with the original `acknowledged_by` and `acknowledged_at` unchanged.
3. Acknowledge `/handoffs/999` (a handoff that doesn't exist). Expect `404`.

*Step 2's `409` is covered by `test_unfinished_tasks_carry_over`. Gap: no test checks that the original values are unchanged, or tries a missing handoff. The dry run confirmed both behave correctly.*

**5.3 Only logged-in users can acknowledge** (integration, Sadbhab) 🟡
1. Send the acknowledge request without logging in. Expect `401`, with nothing saved.

*`test_requires_auth` checks that login is required, but only on `GET /tasks`. Gap: not tested on the acknowledge endpoint. The dry run confirmed it returns `401`.*

**5.4 A handoff can't be acknowledged before the next shift starts** (integration, Sadbhab) ✅
1. End a shift. Then, before anyone starts the next shift, send `POST /handoffs/{id}/acknowledge`.
2. Expect `409`.

*Covered by `test_unfinished_tasks_carry_over`.*

**5.5 Acknowledging in the browser** (manual, Arjun) 🧑

Covered in steps 10 and 11 of the walkthrough.

## 6. Are tasks ever duplicated or lost in a handoff?

**6.1 Nothing is left out** (pytest unit, Garvin) ✅
1. Set up a mix of tasks, then end the shift.
2. Expect the task `id`s in the handoff to be exactly the unfinished tasks: none missing and none extra.

*Covered by `test_unfinished_tasks_carry_over`, which compares exact lists of `id`s.*

**6.2 Ending the same shift twice doesn't create a second handoff** (integration, Sadbhab) ✅
1. Send `POST /shifts/{id}/end` twice.
2. Expect `409` on the second request, and still only one handoff.

*Covered by `test_only_one_active_shift`. The database also blocks a second handoff, as the next test shows.*

**6.3 The database blocks duplicates** (database test, Garvin) ✅

`constraints_test.sql` checks 16 and 17 confirm that a shift can't be handed off twice and a task can't appear twice in one handoff.

**6.4 A long-running task is listed once per handoff** (integration, Sadbhab) 🟡
1. Leave one task unfinished across three shift changes.
2. Expect it in all three handoffs, exactly once in each. `GET /tasks/{id}` should list all three in `handoff_ids`.

*`test_unfinished_tasks_carry_over` checks this across two handoffs. Gap: not three.*

**6.5 An early handoff preview is refreshed when the shift ends** (integration, Sadbhab) ✅
1. Send `POST /shifts/{id}/handoff` to build a preview of the handoff.
2. Complete one task and create another, then end the shift.
3. Expect the final handoff to reflect those changes, not the out-of-date preview.

*Covered by `test_prepare_handoff_is_refreshed_on_end`.*

**6.6 The handoff screen matches the dashboard** (manual, Arjun) 🧑

Covered in steps 6, 9 and 13 of the walkthrough.

## Manual shift-change walkthrough: Room 312

This walks through the proposal's Room 312 story with the real app. Run it at least once before the demo, and again after any change to handoff code.

**Owners:** all three people, led by Garvin. One person drives the browser, one reads out the expected results, and one checks the database.

**Before you start**
1. Copy any new settings from `.env.example` into your `.env`.
2. Reset the database and start everything:

   ```bash
   docker compose down -v
   ```

   ```bash
   docker compose up -d --build
   ```

3. Give the demo users real passwords:

   ```bash
   docker compose exec api python -m app.scripts.set_password --all-seed-users password123
   ```

4. Until the frontend exists, run each step at **http://localhost:8000/docs**. Click **Authorize** and log in with the user's email (for example `james.carter@example.com`) and `password123`. Then use the endpoint shown in the API column.

**Starting state (from the seed):** The current shift is Evening (shift 3). Room 312 (task 1) is `in_progress`, assigned to Marcus Reed, with high priority. It was carried over from the previous evening.

### Part 1: Evening shift, logged in as James Carter

| # | Do this | API | Expect this | Checks question |
|---|---|---|---|---|
| 1 | Open the dashboard. | `GET /tasks?unfinished=true` | The unfinished tasks are Room 312, the lobby elevator, and the VIP amenity. The towels, late checkout and pool light tasks are not listed. | 3 |
| 2 | Open Room 312. | `GET /tasks/1` | Its history shows it was created by James, assigned to Marcus, moved to in progress, and has two notes from Marcus. | 2 |
| 3 | Add the note "Part arrived, installing at 8 AM." | `POST /tasks/1/comments` | The note appears in the history, with James's name and the time. | 2 |
| 4 | Create the task "Room 415 TV not turning on": priority low, department Maintenance. | `POST /tasks` | It's created with status open and `created_in_shift` 3. | 1 |
| 5 | Mark the VIP amenity task (task 6) as completed. | `PUT /tasks/6/status` | Its status is completed. | 2 |
| 6 | End the shift. | `POST /shifts/3/end` | A handoff is created containing **exactly 3 tasks**: Room 312, the elevator, and Room 415. The VIP amenity task is not included. | 3, 4, 6 |

### Part 2: Morning shift, logged in as Maria Lopez

| # | Do this | API | Expect this | Checks question |
|---|---|---|---|---|
| 7 | Start the Morning shift, then open the handoff screen. | `POST /shifts`, then `GET /handoffs/incoming` | The handoff shows the same 3 tasks. | 4, 6 |
| 8 | Open Room 312 from the handoff. | `GET /tasks/1` | You can see its owner (Marcus), its priority (high), and the 8 AM note from step 3. | 4 |
| 9 | Compare the handoff with the dashboard. | `GET /tasks?unfinished=true` | Nothing is listed twice, and the handoff has exactly the same tasks as the dashboard. | 6 |
| 10 | Click Acknowledge. | `POST /handoffs/{id}/acknowledge` | The handoff shows it was acknowledged by Maria, with the time. | 5 |
| 11 | Log in as James and acknowledge the same handoff. | Same request, logged in as James | Rejected with `409` "already acknowledged". The handoff still shows Maria. | 5 |

### Part 3: Fixing it, logged in as Marcus Reed

| # | Do this | API | Expect this | Checks question |
|---|---|---|---|---|
| 12 | Mark Room 312 as completed. | `PUT /tasks/1/status` | Its status is completed, and `completed_at` is filled in. | 2 |
| 13 | End the Morning shift. | `GET /shifts/current` to find its id, then `POST /shifts/{id}/end` | The new handoff contains only the elevator and Room 415. Room 312 is not in it. | 3, 4, 6 |
| 14 | Look up Room 312's full history. | `GET /tasks/1` | It's completed. Its history runs from creation to completion, and `handoff_ids` lists 2 handoffs: the seed one and the one from step 6. | 3 |

New task, shift and handoff ids depend on what's already in the database, so check them in each response rather than expecting fixed numbers.

### Database check (after step 13)

Connect to the database with the command in [`database/README.md`](../database/README.md), then run:

```sql
-- Each handoff and its tasks. The last two handoffs should match steps 6 and 13.
SELECT h.id AS handoff, s.name AS from_shift, t.id AS task, t.title, t.status
FROM handoffs h
JOIN shifts s         ON s.id = h.from_shift_id
JOIN handoff_tasks ht ON ht.handoff_id = h.id
JOIN tasks t          ON t.id = ht.task_id
ORDER BY h.id, t.id;

-- Room 312's full history, in order.
SELECT created_at, user_id, action, old_value, new_value
FROM task_events
WHERE task_id = 1
ORDER BY created_at;
```

When you're done, run `docker compose down -v` to go back to clean demo data.

### Recording results

Write PASS or FAIL next to each step. For every FAIL, open a GitHub issue that says which step failed, what you expected, and what actually happened. Add a screenshot if it helps.

## When

These dates come from the milestones in our proposal:

| Dates | Testing work |
|---|---|
| Oct 26 – Nov 8 (Shift Handoff System) | Fill the 🟡 and ⬜ gaps in the pytest suite. |
| Nov 9 – 15 (Integration) | Write the manual tests once the frontend exists. Do the first walkthrough in the browser. |
| Nov 16 – 22 (Testing & Bug Fixing) | Run everything. Fix every FAIL. |
| Nov 23 – 30 (Deployment) | Do a final walkthrough on the deployed app before the demo. |

## Decisions

The backend answered our earlier open questions. These are the current behaviors. Tell the team if you disagree, since changing them means changing code and tests.

| Question | What the backend does now |
|---|---|
| Can a completed task be reopened? | **Yes.** Setting the status back to `open` or `in_progress` clears `completed_at` and adds a `status_changed` event. |
| Who can acknowledge a handoff? | **Any logged-in user, once the next shift has started, and only once.** A second acknowledgment gets `409`. |
| What happens if someone ends a shift that's already ended? | **`409` "already ended".** No second handoff is created. |

## Open questions

- **Should anyone be able to create an account?** Right now `POST /auth/register` is open to anyone. On a public deployment, strangers could sign up.
- **Should only supervisors start and end shifts?** Right now any logged-in user can.
- **The deployed app needs its own `JWT_SECRET`.** If none is set, the backend falls back to a default that's visible in the code, so anyone could create valid login tokens. Garvin will add a deployment check for this.
