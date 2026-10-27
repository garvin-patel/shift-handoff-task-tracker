# October 29 progress presentation — current checkpoint

## Three-minute walkthrough

1. Ownership (20 seconds): “My portion is PostgreSQL, authentication, roles, testing, and deployment. I started with the user and login foundation that the other features need.”
2. Database (30 seconds): Show the users migration. “Every account has an ID, unique normalized email, hashed password, and role. The migration lets each teammate create the same table.”
3. Login (45 seconds): Use the API docs to log in and fetch `/api/v1/auth/me`. “The API verifies the password and issues a signed token. It returns public account details, never password hashes.”
4. Permissions (45 seconds): Use employee and supervisor tokens on the supervisor demonstration endpoint. “The server returns 403 for an employee and 200 for a supervisor. The permission comes from the database.”
5. Evidence and next steps (40 seconds): Run the tests. “22 automated tests pass against a separate PostgreSQL database. Both demo accounts also survived a database restart. Next I will coordinate the task relationships and frontend login integration, then prepare deployment.”

## Verified on October 27

- PostgreSQL 17.11 running locally; app role is not a database superuser.
- Initial migration applied; Alembic reports no model/schema differences.
- 22 tests passed: login, tokens, disabled accounts, changed roles, constraints, and health checks.
- Live HTTP demo verified login and permissions after a database restart.
- Local secrets, database files, and demo passwords are excluded from Git.

## State honestly

The React login screen has not been integrated. The supervisor endpoint demonstrates permission enforcement; it does not implement task assignment. Only the users table is implemented. Task/handoff relationships, workflow tests, Docker, and cloud deployment remain. There is one upstream test-client deprecation warning. Do not claim the whole project is finished.
