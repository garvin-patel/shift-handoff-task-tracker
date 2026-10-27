# First learning session: users and login

You can work on this foundation before the other teammates finish their parts. This branch contains Garvin's database and authentication work; it does not implement task or handoff business logic.

## What you have built

`backend/app/models.py` describes a user. PostgreSQL stores the record. `backend/migrations/versions/0001_users.py` creates the actual table. A migration is a versioned database change; an ORM model is the Python representation used by the application. Both must stay aligned.

Each user has a UUID, email, display name, password hash, role, active flag, and creation time. The database rejects duplicate emails, unnormalized emails, and roles other than employee or supervisor. Passwords are hashed with Argon2 rather than stored as readable text.

`backend/app/main.py` accepts requests. Login verifies a password and returns a signed token valid for 30 minutes. The token identifies a user; it is not an encrypted password container. Later requests send it in an Authorization header. `backend/app/security.py` checks the signature, expiration, and stored user. The role comes from PostgreSQL on each request, so a changed role applies immediately.

Authentication answers “who are you?” Authorization answers “are you allowed to do this?” An unauthenticated request gets 401. An employee trying the supervisor demo gets 403.

## Try it now

With the server running, open http://127.0.0.1:8000/docs.

1. Expand POST `/api/v1/auth/login` and click **Try it out**.
2. Use an email and password from your local `.local/demo-accounts.json` file. The accounts are `employee@gsa.example` and `supervisor@gsa.example`; each has its own generated password. This ignored file is for your local demo only.
3. Execute the request. Copy the `access_token` from the response.
4. Click **Authorize** at the top of the page. Paste the token alone into the Bearer field and authorize.
5. Execute GET `/api/v1/auth/me`. You should see the account's public details and no password hash.
6. Execute GET `/api/v1/demo/supervisor` with the employee token: expect 403.
7. Log in as the supervisor, replace the authorized token, and repeat: expect 200.

The supervisor demo is a small permission check, not a task-assignment implementation. Real task permissions still need agreement with Sadbhab.

## Run on this Mac

Open a terminal in the repository root. Activate the environment:

```sh
source .venv/bin/activate
python scripts/local_database.py start
alembic upgrade head
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Keep that terminal running. Stop the API with Ctrl+C. In a separate terminal with the environment activated, run tests:

```sh
python -m pytest -q
```

Tests use the separate `gsa_test` database and roll back their records. They do not clear your demo users. To stop the database when finished:

```sh
python scripts/local_database.py stop
```

## Fresh developer setup

Python 3.12+ and PostgreSQL 17 are required. On another Mac, install PostgreSQL through Homebrew. On this Mac PostgreSQL is already installed. For Intel Macs or other installations, set `PG_BIN` to the directory containing initdb and pg_ctl. Run from the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/local_database.py setup
alembic upgrade head
python -m backend.seed --generate
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

The setup creates a project-local cluster at `.local/postgres`, bound to 127.0.0.1:55432, and generates `.env`. It creates a dedicated app role without superuser rights and separate app/test databases. It does not register a login service. Keep `.env` and `.local/` private; Git ignores both. This helper is for local development. Cloud deployment will use a separately provisioned database and credentials.

## Explain these before moving on

1. What is the difference between the model and the migration?
2. Why does the API return a token instead of a password hash?
3. Why must the backend check roles even if the frontend hides buttons?
4. What do 401 and 403 mean in your demo?

Next checkpoint: agree on the users-to-tasks relationship with Sadbhab, add schema changes incrementally, then prepare deployment. Password reset, persistent login, refresh tokens, request throttling, and cloud hosting remain future work. This local demonstration is not ready for public deployment.

Implementation references: [FastAPI authentication](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/), [Alembic migrations](https://alembic.sqlalchemy.org/en/latest/tutorial.html), [SQLAlchemy PostgreSQL support](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html).
