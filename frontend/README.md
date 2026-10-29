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

| Shift | Staff |
|---|---|
| Morning (7 AM – 3 PM) | **Maria Lopez** (supervisor), Aisha Khan, Tom Nguyen |
| Evening (3 PM – 11 PM) | **Daniel Brooks** (supervisor), James Carter, Priya Shah, Marcus Reed |
| Night (11 PM – 7 AM) | **Sofia Rossi** (supervisor), Leo Park |

The API address defaults to `http://localhost:8000`. To use a different one, create `frontend/.env` with:

```
VITE_API_URL=http://your-api-host:8000
```

## Screens

| Screen | Route | What it does |
|---|---|---|
| Sign in | `/login` | Email and password login. On the dev server, also one-click demo accounts grouped by shift. |
| Tasks | `/` | A board with Open / In progress / Done columns, or a list view. Search, department and "My tasks" filters, a banner when a handoff needs review, and quick Start / Mark done / Reopen buttons. **New task** opens a form in a dialog. |
| Task detail | `/tasks/:id` | Status, assignment, priority, editing, notes, and the full history as readable sentences |
| Handoff | `/handoff` | Review and acknowledge the incoming handoff, end the shift (supervisors), and the handoff history |
| Team | `/team` | Staff grouped by usual shift, with the current shift marked. Supervisors can **Add staff member**: name, work email, role, department, usual shift and a temporary password to hand over. |

Everyone can change their own password from the profile menu at the bottom of the sidebar.

Buttons follow the roles in [`backend/README.md`](../backend/README.md#roles). For example, only supervisors see "End shift", the assignment and priority dropdowns, and "Reopen". The backend enforces the same rules, so hiding a button is only for convenience.

The layout is a sidebar app on desktop. On phones it switches to a top bar with tabs along the bottom. It follows the system's light or dark mode.

## Code layout

```
src/
  api/client.ts       every backend request (the only file that calls fetch)
  types.ts            the shapes the backend returns
  auth.tsx            login state; signs out automatically when the token expires
  appData.tsx         current shift, incoming handoff and staff list, shared by all screens
  format.ts           labels, relative times and other display helpers
  components/         sidebar layout, dialogs (new task, change password), toasts and small UI pieces
  pages/              one file per screen
  index.css           the whole design system: colors, spacing, components
```

## Checks

```bash
npm run build   # type-checks with tsc, then builds
npm run lint
```
