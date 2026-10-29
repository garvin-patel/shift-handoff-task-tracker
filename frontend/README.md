# Frontend: Shift Handoff Task Tracker

React + TypeScript + Vite. It talks to the FastAPI backend in `../backend`.

## Run it

Start the database and API first, from the repo root:

```bash
docker compose up -d
```

Then start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. On the dev server, the sign-in page lists the demo accounts. Click one to sign in. Every demo password is `password123`.

| Account | Role |
|---|---|
| Maria Lopez | Supervisor, Front Desk |
| James Carter | Employee, Front Desk |
| Priya Shah | Employee, Housekeeping |
| Marcus Reed | Employee, Maintenance |

The API address defaults to `http://localhost:8000`. To use a different one, create `frontend/.env` with:

```
VITE_API_URL=http://your-api-host:8000
```

## Screens

| Screen | Route | What it does |
|---|---|---|
| Sign in | `/login` | Email and password login. On the dev server, also one-click demo accounts. |
| Tasks | `/` | Shift summary, a banner when a handoff needs review, counts, search and filters, and one-click Start / Complete / Reopen |
| New task | `/tasks/new` | Title, details, priority, department. Supervisors can also assign a person. |
| Task detail | `/tasks/:id` | Status, assignment, priority, editing, notes, and the full history as readable sentences |
| Handoff | `/handoff` | Review and acknowledge the incoming handoff, end the shift (supervisors), and the handoff history |

Buttons follow the roles in [`backend/README.md`](../backend/README.md#roles). For example, only supervisors see "End shift", the assignment and priority dropdowns, and "Reopen". The backend enforces the same rules, so hiding a button is only for convenience.

The layout works on phones (bottom tab bar) and follows the system's light or dark mode.

## Code layout

```
src/
  api/client.ts       every backend request (the only file that calls fetch)
  types.ts            the shapes the backend returns
  auth.tsx            login state; signs out automatically when the token expires
  appData.tsx         current shift, incoming handoff and staff list, shared by all screens
  format.ts           labels, relative times and other display helpers
  components/         layout, toasts and small UI pieces
  pages/              one file per screen
  index.css           the whole design system: colors, spacing, components
```

## Checks

```bash
npm run build   # type-checks with tsc, then builds
npm run lint
```
