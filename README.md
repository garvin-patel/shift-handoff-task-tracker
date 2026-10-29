# Shift Handoff Task Tracker

A web app that keeps unfinished work visible as it passes from one work shift to the next.

*Team GSA: Garvin Patel, Sadbhab Ghimire and Arjun Lekhak*

## The problem

In workplaces that run in shifts, some tasks are still unfinished when a shift ends. The next shift needs to know:
- what still needs to be done
- who is responsible for it
- how important it is
- whether it's already been completed

Today that information lives in verbal handovers, notebooks, group chats and spreadsheets, where it gets scattered, buried or forgotten.

**Example:** At 8 PM, a hotel guest reports that the AC in Room 312 isn't working. The evening employee calls maintenance. At 11 PM the shift ends, and the AC is still broken. The next morning, nobody can say whether it was fixed, who is following up, or how long it's been open.

## How it works

1. **During a shift,** employees create tasks, each with a priority, an owner and a status. They update the task as the work progresses.
2. **When the shift ends,** every unfinished task is automatically handed to the next shift. Nothing has to be typed in again.
3. **The next shift** reviews the handoff, confirms they've seen it, and keeps working until each task is marked complete.

A shift change never closes a task. Every task keeps a full history of who created it, who changed it, and when.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React + TypeScript |
| Backend | Python + FastAPI (REST API) |
| Database | PostgreSQL 17 |
| Testing | pytest, integration tests and manual walkthroughs |
| Environment | Docker |

## Project status

| Area | Status |
|---|---|
| Database: schema, demo data and constraint tests | ✅ Done |
| Test plan | ✅ Done |
| Login (password hashing + JWT) and supervisor/employee roles | ✅ Done |
| Backend API | ✅ Done |
| Frontend, connected to the backend | ✅ Done |
| Deployment | ⏳ Planned |

Our goal is to be feature complete by November 15 and ready to demo by November 30, 2026.

## Getting started

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) and [Node.js](https://nodejs.org/) 20 or newer.

```bash
git clone https://github.com/garvin-patel/shift-handoff-task-tracker.git
```

```bash
cd shift-handoff-task-tracker
```

```bash
cp .env.example .env
```

Edit `.env` and set your own password, then start the database and the API:

```bash
docker compose up -d
```

This starts PostgreSQL with hotel demo data (including the Room 312 task) and the API at http://localhost:8000. Then start the frontend in a second terminal:

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173 and pick a demo account. There are 9 staff across the Morning, Evening and Night shifts, with one supervisor per shift (Maria, Daniel and Sofia). Every demo password is `password123`. For how to connect, reset and test the database, see the [database guide](database/README.md).

## Repository layout

```
frontend/          React + TypeScript app (see frontend/README.md)
backend/           FastAPI app and its tests (see backend/README.md)
database/          Tables, demo data and tests (see database/README.md)
docs/              Project documents, such as the test plan
docker-compose.yml Starts the database and API in Docker
.env.example       Template for your local settings (copy it to .env)
```

## Documentation

- [Frontend guide](frontend/README.md): the screens, how to run them, and how they talk to the API
- [Backend guide](backend/README.md): every endpoint and the supervisor/employee roles
- [Database guide](database/README.md): the tables, how they connect, and how to run the database
- [Test plan](docs/TEST_PLAN.md): what we test, who owns each test, and the Room 312 walkthrough

## Team

| Name | Role |
|---|---|
| Arjun Lekhak | Frontend: React + TypeScript UI |
| Sadbhab Ghimire | Backend: FastAPI endpoints, task and handoff logic |
| Garvin Patel | Database, authentication, testing and deployment |

## Contributing

- Work on a branch (`feature/...` or `docs/...`) and open a pull request. Never commit directly to `main`.
- Start every commit message with `feat:`, `fix:` or `docs:`.
- Never commit `.env`. It holds your passwords.
