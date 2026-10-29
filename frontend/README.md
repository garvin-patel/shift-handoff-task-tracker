# Shift Handoff Task Tracker — Frontend (Arjun Lekhak)

React + TypeScript + Vite. Screens: Login, Dashboard, Create Task, Task Detail (with history), Shift Handoff (end shift, carry forward, acknowledge).

## Run
    npm install
    npm run dev        # http://localhost:5173

Demo logins: arjun / 1234 (employee), garvin / 1234 (supervisor)

## Backend connection
`src/api/client.ts` is the only file that talks to the backend. With no `VITE_API_URL` set it uses a mock stored in the browser.
To use Sadbhab's FastAPI backend create `.env`:

    VITE_API_URL=http://localhost:8000

Expected endpoints: POST /auth/login, GET/POST /tasks, GET/PATCH /tasks/{id},
GET /shifts/current, POST /shifts/end, GET /handoffs, POST /handoffs/{id}/acknowledge
