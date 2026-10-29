# Test Plan

This plan turns the testing strategy in our project proposal (Section 4) into concrete tests. The proposal asks six questions about the workflows that would hurt most if they broke. Each question below lists its tests.

**Status:** planned. The backend and frontend aren't built yet, so these tests get written as each feature lands. Only the database-level tests exist so far, in [`database/tests/constraints_test.sql`](../database/tests/constraints_test.sql).

## Test types and owners

Each type of test has one owner, matching our roles in the proposal:

| Type | What it checks | Tools | Owner |
|---|---|---|---|
| **pytest unit** | One piece of backend logic on its own, such as "which tasks go into a handoff?". Fast, and needs no browser. | pytest | **Garvin** |
| **Integration** | A request through the real API into the real Docker database, then checking what got saved. | pytest + FastAPI `TestClient` | **Sadbhab** |
| **Manual** | A person clicking through the app in a browser. | Browser, desktop and phone | **Arjun** |
| **Shift-change walkthrough** | The whole Room 312 story, end to end ([below](#manual-shift-change-walkthrough-room-312)). | Browser + `psql` | **All three, Garvin leads** |

Every test should start from known data. Integration tests run inside a transaction that is rolled back afterwards, like the constraint tests. Manual tests start from a fresh database:

```bash
docker compose down -v
```

```bash
docker compose up -d
```

## 1. Can a user create a task?

**1.1 A valid task is saved with the right defaults** (pytest unit, Garvin)
1. Create a task with only a title and a creator.
2. Expect `status = open`, `priority = medium`, and `created_at` filled in.
3. Expect one `task_events` row with `action = created`.

**1.2 Bad input is rejected** (pytest unit, Garvin)
1. Try to create a task with each of these: no title, priority `urgent`, and an assigned user who doesn't exist.
2. Expect a clear validation error each time, and no new task saved.

**1.3 Creating through the API saves to the database** (integration, Sadbhab)
1. Send the create-task request: "Room 312 AC broken", priority `high`, department Maintenance.
2. Expect a success response that includes the new task's `id`.
3. Look up that `id` in `tasks` and check that every field matches what was sent.

**1.4 Creating from the form** (manual, Arjun)
1. Log in, open the create-task form, and submit a task.
2. Check that it appears on the dashboard with the right priority and owner, and that it's still there after refreshing the page.
3. Submit the form with an empty title. Check that a readable error appears.

## 2. Can the task status be updated?

**2.1 Allowed changes work and are recorded** (pytest unit, Garvin)
1. Move a task from `open` to `in_progress`, then to `completed`.
2. After each change, expect a `status_changed` event with the correct `old_value` and `new_value`, and a newer `updated_at`.
3. After `completed`, expect `completed_at` to be filled in.

**2.2 An invalid status is rejected** (pytest unit, Garvin)
1. Try to set the status to `done`.
2. Expect an error, the task unchanged, and no new event.

**2.3 Updating through the API** (integration, Sadbhab)
1. Send a status update for a task.
2. Check the task's row and its new `task_events` row in the database.
3. Send an update for a task `id` that doesn't exist. Expect a "not found" error, not a crash.

**2.4 Updating in the browser** (manual, Arjun)
1. Change a task's status on its detail screen.
2. Check that the dashboard and the task history both show the change.
3. Check that a second browser shows the change too, after a refresh.

## 3. Does a completed task stay closed?

**3.1 Ending a shift doesn't change any task's status** (pytest unit, Garvin)
1. Set up one completed task and one open task, then end the shift.
2. Expect both tasks to keep exactly the status they had.

**3.2 Completed tasks are left out of the handoff** (pytest unit, Garvin)
1. Set up tasks with each status, then generate a handoff.
2. Expect no `completed` task in it.

**3.3 A completed task stays closed across several shifts** (integration, Sadbhab)
1. Complete a task through the API, then end two shifts in a row.
2. Expect the task to still be `completed`, with the same `completed_at`, and in neither handoff.

**3.4 Completed tasks in the browser** (manual, Arjun)
1. Check that completed tasks don't show on the next shift's handoff screen.
2. Check that they can still be found in the task history.

## 4. Does an unfinished task move to the next shift?

**4.1 Open and in-progress tasks are included** (pytest unit, Garvin)
1. Set up tasks with each status, then generate a handoff.
2. Expect every `open` and `in_progress` task to be in it.

**4.2 Older unfinished tasks are included too** (pytest unit, Garvin)
1. Set up a task that was created two shifts ago and is still `in_progress`.
2. Generate a handoff. Expect the task to be in it, even though the current shift didn't create it.

**4.3 Ending a shift through the API creates the handoff** (integration, Sadbhab)
1. Start from the seed data and end the current shift, shift 3 (Evening).
2. Expect one new `handoffs` row with `from_shift_id = 3`.
3. Expect its `handoff_tasks` rows to be exactly tasks 1, 4 and 6: Room 312, the elevator and the VIP amenity.

**4.4 The next shift sees the tasks** (manual, Arjun)

Covered in steps 7 to 9 of the walkthrough.

## 5. Can the next shift acknowledge the handoff?

**5.1 Acknowledging records who and when** (pytest unit, Garvin)
1. Acknowledge a handoff as a user.
2. Expect `acknowledged_by` to be that user and `acknowledged_at` to be filled in.

**5.2 Acknowledging twice keeps the first one** (pytest unit, Garvin)
1. Acknowledge the same handoff as a second user.
2. Expect the original `acknowledged_by` and `acknowledged_at` to stay unchanged.
3. Acknowledge a handoff `id` that doesn't exist. Expect a "not found" error.

**5.3 Only logged-in users can acknowledge** (integration, Sadbhab)
1. Send the acknowledge request without logging in. Expect "unauthorized", and nothing saved.
2. Send it again while logged in. Expect success.

**5.4 Acknowledging in the browser** (manual, Arjun)

Covered in steps 10 and 11 of the walkthrough.

## 6. Are tasks ever duplicated or lost in a handoff?

**6.1 Nothing is left out** (pytest unit, Garvin)
1. Set up a mix of tasks, then generate a handoff.
2. Expect the task `id`s in the handoff to be exactly the same set as the unfinished tasks just before it: none missing and none extra.

**6.2 Ending the same shift twice doesn't create a second handoff** (integration, Sadbhab)
1. Send the end-shift request twice for the same shift.
2. Expect only one `handoffs` row and no repeated tasks.
3. Expect a clear error on the second request, not a crash.

**6.3 The database blocks duplicates** (database test, Garvin) ✅ **already done**

`constraints_test.sql` checks 16 and 17 confirm that a shift can't be handed off twice and a task can't appear twice in one handoff.

**6.4 A long-running task is listed once per handoff** (integration, Sadbhab)
1. Leave one task unfinished across three shift changes.
2. Expect it in all three handoffs, exactly once in each.

**6.5 The handoff screen matches the dashboard** (manual, Arjun)

Covered in steps 6 and 13 of the walkthrough.

## Manual shift-change walkthrough: Room 312

This walks through the proposal's Room 312 story with the real app. Run it at least once before the demo, and again after any change to handoff code.

**Owners:** all three people, led by Garvin. One person drives the browser, one reads out the expected results, and one checks the database.

**Before you start**
- The backend and frontend are running.
- The database has been reset, so it holds the seed data.
- The demo users have real passwords. Their seed hashes are fake, so this needs to be set up once login is built.

**Starting state (from the seed):** The current shift is Evening (shift 3). Room 312 is `in_progress`, assigned to Marcus Reed, with high priority. It was carried over from the previous evening.

### Part 1: Evening shift, logged in as James Carter

| # | Do this | Expect this | Checks question |
|---|---|---|---|
| 1 | Log in and open the dashboard. | The unfinished tasks are Room 312, the lobby elevator, and the VIP amenity. The towels, late checkout and pool light tasks are not shown as open. | 3 |
| 2 | Open Room 312. | Its history shows it was created by James, assigned to Marcus, moved to in progress, and has two notes about the part. | 2 |
| 3 | Add the note "Part arrived, installing at 8 AM." | The note appears at the top of the history, with James's name and the time. | 2 |
| 4 | Create the task "Room 415 TV not turning on": priority low, department Maintenance. | It appears on the dashboard with status open. | 1 |
| 5 | Mark the VIP amenity task as completed. | Its status shows Completed. | 2 |
| 6 | End the shift. | A handoff is created containing **exactly 3 tasks**: Room 312, the elevator, and Room 415. The VIP amenity task is not included. | 3, 4, 6 |

### Part 2: Morning shift, logged in as Maria Lopez

| # | Do this | Expect this | Checks question |
|---|---|---|---|
| 7 | Log in and start the Morning shift. | The handoff screen shows the same 3 tasks. | 4, 6 |
| 8 | Open Room 312 from the handoff screen. | You can see its owner (Marcus), its priority (high), and the 8 AM note from step 3. | 4 |
| 9 | Look for any task listed twice, and for any unfinished task that's missing. | Nothing is listed twice and nothing is missing. | 6 |
| 10 | Click Acknowledge. | The screen shows the handoff was acknowledged by Maria, with the time. | 5 |
| 11 | Log in as James in another browser and acknowledge the same handoff. | It still shows Maria as the person who acknowledged it. | 5 |

### Part 3: Fixing it, logged in as Marcus Reed

| # | Do this | Expect this | Checks question |
|---|---|---|---|
| 12 | Mark Room 312 as completed. | Its status shows Completed, and its history shows when Marcus completed it. | 2 |
| 13 | End the Morning shift. | The new handoff contains only the elevator and Room 415. Room 312 is not in it. | 3, 4, 6 |
| 14 | Search the task history for Room 312. | Its full timeline is there, from creation to completion. | 3 |

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

### Recording results

Write PASS or FAIL next to each step. For every FAIL, open a GitHub issue that says which step failed, what you expected, and what actually happened. Add a screenshot if it helps.

## When

These dates come from the milestones in our proposal:

| Dates | Testing work |
|---|---|
| Oct 26 – Nov 8 (Shift Handoff System) | Write the unit and integration tests for questions 3 to 6 alongside the handoff code. |
| Nov 9 – 15 (Integration) | Write the manual tests. Do the first walkthrough run. |
| Nov 16 – 22 (Testing & Bug Fixing) | Run everything. Fix every FAIL. |
| Nov 23 – 30 (Deployment) | Do a final walkthrough on the deployed app before the demo. |

## Open questions

We need to decide these before the related tests can be finished:

- **Can a completed task be reopened?** The database allows it right now. Test 3.1 only checks that a shift change doesn't reopen a task.
- **Who is allowed to acknowledge a handoff?** Anyone logged in, or only people on the next shift? This affects test 5.3.
- **What should ending an already-ended shift return?** An error, or the existing handoff? This affects test 6.2.
