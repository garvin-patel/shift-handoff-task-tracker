# Backend: Shift Handoff Task Tracker API

FastAPI + SQLAlchemy 2 + Postgres 17. The database schema lives in `../database/*.sql`. The SQL files are the source of truth, and `app/models.py` mirrors them.

## Run it

### Option A: everything in Docker

```bash
cp .env.example .env            # then set POSTGRES_PASSWORD and JWT_SECRET
docker compose up --build
```

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs

The schema and seed data load only the **first** time the `pgdata` volume is created. Run `docker compose down -v` to reset the database.

**Deploying:** set `APP_ENV=production` and a real `JWT_SECRET`. The API refuses to start in production if `JWT_SECRET` is missing, is a placeholder from this repo, or is shorter than 32 characters. That's because anyone who knows the secret can create their own login tokens.

### Option B: Postgres in Docker, API locally (hot reload)

```bash
docker compose up -d db
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Settings are read from the repo-root `.env`.

### Logging in as the seed users

Every seed user's password is `password123`, and it works right after a reset. There are 9 staff with one supervisor per shift: Morning: Maria Lopez (supervisor), Aisha Khan, Tom Nguyen. Evening: Daniel Brooks (supervisor), James Carter, Priya Shah, Marcus Reed. Night: Sofia Rossi (supervisor), Leo Park. Sign in with, for example, `maria.lopez@example.com` / `password123`. In `/docs`, click **Authorize** and enter the email as the username.

To change one user's password:

```bash
docker compose exec api python -m app.scripts.set_password maria.lopez@example.com new-password
```

### Roles

There is no self-registration: a supervisor creates accounts with `POST /users`. Employees get `403 Forbidden` for the supervisor-only actions below.

| Action | Employee | Supervisor |
|---|---|---|
| Create accounts | ❌ | ✅ |
| Create a task and set its department | ✅ | ✅ |
| Assign a task to a person, or reassign it | ❌ | ✅ |
| Start, end, or preview a shift's handoff | ❌ | ✅ |
| Move a task to `in_progress` or `completed`, or add a comment | ✅ | ✅ |
| Reopen a completed task | ❌ | ✅ |
| Change a task's priority after it's created | ❌ | ✅ |
| Edit a task's title or description | Only tasks they created | Any task |
| Acknowledge a handoff | ✅ | ✅ |

The frontend can read the logged-in user's role from `GET /users/me` to hide buttons employees can't use.

## Tests

```bash
cd backend && pytest
```

Tests use in-memory SQLite by default. To run them against real Postgres, point `TEST_DATABASE_URL` at a **throwaway** database. Its schema is dropped and rebuilt from `01_schema.sql` on every test.

```bash
docker compose exec db createdb -U shift shift_handoff_test
TEST_DATABASE_URL=postgresql+psycopg://shift:<password>@localhost:5432/shift_handoff_test pytest
```

## How shifts and handoffs work

1. `POST /shifts` starts a shift. Only one shift can be active at a time; a second start returns 409. If the previous shift left a handoff, it is linked to the new shift through `handoffs.to_shift_id`.
2. Tasks created while a shift is active are stamped with `created_in_shift`.
3. `POST /shifts/{id}/end` ends the shift and creates a handoff that lists **every task not yet completed**. This includes tasks carried over from earlier shifts, so nothing is lost.
4. `POST /shifts/{id}/handoff` (optional) builds the handoff early as a preview. It is rebuilt when the shift ends.
5. The next shift checks `GET /handoffs/incoming`, then calls `POST /handoffs/{id}/acknowledge`.

## Endpoints

Every endpoint except `/auth/*` and `/health` needs `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | JSON login, returns `{access_token, user}` |
| POST | `/auth/token` | Form login (used by Swagger) |
| GET | `/users/me`, `/users`, `/users/{id}` | Current user; list users (`?department=`, `?role=`) |
| POST | `/users` | Supervisor only: add a staff member `{name, email, password, role, department, usual_shift}`. The password is a temporary one to hand over. |
| POST | `/users/me/password` | Change your own password `{current_password, new_password}` |
| GET | `/tasks` | List and filter: `status` (repeatable), `priority`, `assigned_user_id`, `assigned_department`, `created_in_shift`, `unfinished`, `unassigned`, `mine`, `q`, `limit`, `offset` |
| POST | `/tasks` | Create a task. Only supervisors can set `assigned_user_id`. |
| GET | `/tasks/{id}` | Task with full event history and the handoffs it appeared in |
| PATCH | `/tasks/{id}` | Edit title, description, or priority. Employees: own tasks only, and no priority changes. |
| PUT | `/tasks/{id}/assignment` | Supervisor only: `{assigned_user_id, assigned_department?}`; send `null` to unassign |
| PUT | `/tasks/{id}/status` | `{status, comment?}` with status `open`, `in_progress`, or `completed`. Only supervisors can reopen a completed task. |
| POST | `/tasks/{id}/comments` | Add a note |
| GET | `/tasks/{id}/events` | Task history |
| GET | `/shifts`, `/shifts/current`, `/shifts/{id}` | Shifts |
| POST | `/shifts` | Supervisor only: start a shift `{name}` |
| POST | `/shifts/{id}/end` | Supervisor only: end the shift and create the handoff |
| POST | `/shifts/{id}/handoff` | Supervisor only: preview or prepare the handoff |
| GET | `/handoffs` | List handoffs (`?acknowledged=`) |
| GET | `/handoffs/incoming` | Handoff received by the current shift |
| GET | `/handoffs/{id}` | Handoff with its tasks (current state) |
| POST | `/handoffs/{id}/acknowledge` | Incoming shift confirms receipt |
| GET | `/health` | Database check |

Every task change is written to `task_events` with one of these actions: `created`, `assigned`, `department_changed`, `status_changed`, `priority_changed`, `title_changed`, `description_changed`, `comment`.

## Layout

```
app/
  main.py          app, CORS, routers, /health
  config.py        settings from env/.env
  database.py      engine + session
  models.py        ORM models (mirror database/01_schema.sql)
  schemas.py       request/response models
  security.py      bcrypt + JWT
  deps.py          auth dependencies
  routers/         HTTP layer
  services/        business logic (tasks.py, shifts.py = shifts + handoffs)
  scripts/         set_password CLI
tests/
```
