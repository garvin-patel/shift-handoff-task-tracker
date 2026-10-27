# Team GSA — Shift Handoff Task Tracker

Keep unfinished work visible as it passes from one shift to the next.

## Current status

Planning and repository scaffold only. Application code, database setup, authentication, tests, and deployment are not implemented yet.

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

See [the two-day plan](docs/two-day-plan.md) for the first demo and learning checkpoints.

## First working slice

1. Run PostgreSQL and apply a versioned migration.
2. Seed a demo employee and supervisor with hashed passwords.
3. Log in and retrieve the current user.
4. Demonstrate a server-enforced role restriction.
5. Run tests against an isolated PostgreSQL database.

Startup instructions will be added with the implementation. Never commit passwords, tokens, database dumps, or real user data.
