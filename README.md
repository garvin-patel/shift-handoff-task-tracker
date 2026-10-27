# Team GSA — Shift Handoff Task Tracker

Keep unfinished work visible as it passes from one shift to the next.

## Current status

First database/authentication slice implemented on `feature/database-auth-foundation`: PostgreSQL users table, versioned migration, login, current-user endpoint, supervisor permission check, and 22 passing integration tests. Task/handoff tables, business logic, React integration, Docker, and cloud deployment are still pending.

Progress presentation: October 29, 2026. Final delivery target in the proposal: November 30, 2026.

## Team ownership

| Area | Owner | Planned technology |
| --- | --- | --- |
| Login screen, dashboard, task and handoff screens | Arjun Lekhak | React + TypeScript |
| Task endpoints, assignment, handoff and carry-forward logic | Sadbhab Ghimire | Python + FastAPI |
| Database, authentication, roles, testing and deployment | Garvin Patel | PostgreSQL, pytest, deployment tooling |

Authentication code belongs inside the shared FastAPI backend. Agree on shared database models and migrations before implementing task endpoints.

## Layout

- `backend/`: shared FastAPI application and database migrations
- `frontend/`: React + TypeScript application
- `tests/`: integration and workflow tests
- `docs/`: planning and interface agreements

Start with [the first learning session](docs/first-session.md). See [the authentication interface](docs/auth-interface.md) for teammate integration and [the two-day plan](docs/two-day-plan.md) for the next checkpoints.

## Verified first slice

1. Run PostgreSQL and apply a versioned migration.
2. Seed a demo employee and supervisor with hashed passwords.
3. Log in and retrieve the current user.
4. Demonstrate a server-enforced role restriction.
5. Run tests against an isolated PostgreSQL database.

The integration suite uses actual PostgreSQL in a separate test database. A live HTTP smoke check verified employee denial (403), supervisor access (200), and login after restarting PostgreSQL. The migration matches the model. One upstream test-client deprecation warning remains; all tests pass.

Follow [setup and startup instructions](docs/first-session.md). Never commit passwords, tokens, database dumps, or real user data. Demo credentials and database files live only in ignored `.local/` files. This slice is a local demonstration; it has not been deployed publicly.
