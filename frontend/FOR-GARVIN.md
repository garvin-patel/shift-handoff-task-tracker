# Arjun Lekhak: Frontend + Section 3 (Live Demo)

## What's in this folder
- frontend/ : React + TypeScript source code. Put it in the repo as `frontend/`.
- Section3-Live-Demo-Arjun.pptx : 4 slides for Section 3. Insert them after Section 2.
- shift-handoff-demo.html : the whole app in one file. Double-click to run it (works offline).

## Add the code to GitHub
Copy `frontend/` into the repo root, then:
    git checkout -b feature/frontend
    git add frontend
    git commit -m "Add frontend: login, dashboard, tasks, shift handoff"
    git push -u origin feature/frontend
Then open a Pull Request into main and have someone review it.

## Run it locally
    cd frontend
    npm install
    npm run dev        (opens http://localhost:5173)
Logins: arjun / 1234 (employee), garvin / 1234 (supervisor)

## Done
Login, dashboard (counts, filter, search, priority sort), create task, task detail with history,
end shift (carries unfinished tasks forward), acknowledge handoff, handoff history, mobile layout.

## Not done yet
- Uses a mock API in the browser. To connect to the real backend, create `frontend/.env` with
  VITE_API_URL=http://localhost:8000 and nothing else changes.
- Endpoints the frontend calls (Sadbhab):
  POST /auth/login -> { token, user }
  GET /tasks, POST /tasks, GET /tasks/{id}, PATCH /tasks/{id}
  GET /shifts/current, POST /shifts/end, GET /handoffs, POST /handoffs/{id}/acknowledge
- Auth (Garvin): the frontend sends `Authorization: Bearer <token>` on every request.
