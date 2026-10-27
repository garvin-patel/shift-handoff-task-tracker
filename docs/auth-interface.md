# Authentication interface — implemented v0.1

For Arjun and Sadbhab to review before integration. No teammate implementation is assumed to exist.

Base URL locally: `http://127.0.0.1:8000`. Interactive API: `/docs`. OpenAPI schema: `/openapi.json`. Current allowed frontend origin: `http://localhost:5173`; change `CORS_ORIGINS` in the private environment configuration if needed.

| Request | Input | Success | Failure |
| --- | --- | --- | --- |
| POST /api/v1/auth/login | JSON email, password | 200: access_token, token_type=bearer, expires_in (seconds) | 401 wrong credentials or inactive user; 422 invalid body |
| GET /api/v1/auth/me | Authorization: Bearer TOKEN | 200: id, email, display_name, role, created_at | 401 missing/invalid/expired token or inactive/deleted user |
| GET /api/v1/demo/supervisor | Authorization: Bearer TOKEN | 200 for supervisor | 401 unauthenticated; 403 employee |
| GET /health/live | None | 200: process responds | — |
| GET /health/ready | None | 200: database and users table accessible | 503 database unavailable or migration missing |

Emails are normalized to trimmed lowercase. Roles are employee and supervisor. IDs are UUID strings; created_at is an ISO timestamp with timezone. Password hashes are never in API responses. Errors use FastAPI's `detail` field; validation errors have a list in that field.

Frontend: POST login as JSON, store the token in memory for this initial demo, then send it in the Authorization header. Reload requires re-login. Clear the token on logout and prompt for login on 401. On 403, show a permission message. Logout only clears the client's token; it does not revoke a copied token, which expires in 30 minutes. The bearer scheme in the API docs accepts the token alone.

Backend: reuse `get_db` from backend.app.db, `current_user` or `supervisor_only` from backend.app.security, and `User` from backend.app.models. Define additional routes through APIRouter modules as the backend grows. Add a new migration for table changes; never edit a migration already used by teammates. Do not create a parallel users table or a second authentication service.

Supervisor-only task assignment is proposed from the page 15 user story, but actual task edit/ownership rules are not implemented here. Tasks, shifts, handoffs, acknowledgments, and task history still require shared schema review and later migrations.
