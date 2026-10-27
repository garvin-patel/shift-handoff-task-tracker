# Team GSA: October 29 progress demo

## Assessment — October 27, 2026

Read all 21 pages of TEAM GSA_ProjectProposal (1).pdf. Page 20 assigns Garvin PostgreSQL, authentication, roles, testing, and deployment; Arjun owns React/TypeScript; Sadbhab owns FastAPI task and handoff business logic. Pages 17–19 require workflow tests and schedule the final deployment for November 30. Thursday October 29 is a progress presentation.

The current workspace is empty apart from work/ and outputs/. The user confirmed there is no existing repository: start fresh on GitHub. No application, database, tests, or deployment has been verified. Docker was not found on the command path. Git and GitHub CLI are available. Wider folders have not been inspected; there is no need to search unrelated projects.

## Demonstrable target

Start PostgreSQL and FastAPI, apply the initial migration, seed an employee and supervisor with hashed passwords, log in, fetch the current user, and demonstrate a protected action allowed for a supervisor and rejected for an employee. Restart the application and show the database records remain. Run automated tests against PostgreSQL. Use API documentation for the demonstration if the React login screen is not ready.

Include a task create/read flow only if Sadbhab's implementation is ready. Full handoff automation is a later integration milestone, not a prerequisite for demonstrating Garvin's portion.

## Tuesday October 27 — foundation (about 4 focused hours)

1. 45 minutes: create a private GitHub repository named shift-handoff-task-tracker, establish backend/, frontend/, docs/, and tests/ ownership, add README and environment-variable examples. Invite teammates only when their GitHub handles are provided.
2. 60 minutes: agree on schema and API contract; document proposed role permissions. Model users, departments, shifts, tasks, handoffs, handoff-task links, acknowledgments, and task history. Implement users and the minimum supporting tables first; avoid building Sadbhab's business logic independently.
3. 75 minutes: configure PostgreSQL, database sessions, versioned migrations, and repeatable local seed data. Verify empty-database migration and persistence. If Docker setup takes more than 30 minutes, use an available local PostgreSQL installation and document the exact setup.
4. 60 minutes: implement login, password hashing, current-user lookup, and backend role enforcement. Make one small commit per working checkpoint; explain the concept, implement it, test it, then have Garvin explain it back.

Tuesday exit condition: reproducible database setup and a working login/current-user request. If time runs short, prioritize this over extra schema and frontend work.

## Wednesday October 28 — integration and demo (about 4 focused hours)

1. 60 minutes: tests for successful/failed login, missing/invalid/expired authentication, employee permission denial, supervisor access, and database uniqueness/foreign-key constraints. Tests use a separate disposable PostgreSQL database.
2. 60 minutes: integrate with Arjun's login screen and Sadbhab's protected routes. If unavailable, retain the API demo and provide sample requests/responses and generated API schema.
3. 75 minutes: package reproducible startup, health/readiness checks, migration procedure, and seed instructions; attempt a small cloud deployment if accounts and hosting are available. Keep credentials in environment variables. Verify readiness actually checks the database. Provider and costs remain undecided.
4. 45 minutes: rehearse a three-minute walkthrough, record actual test results, prepare screenshots and a local fallback. Freeze demo changes Wednesday evening.

Wednesday exit condition: verified local demo, test results, teammate integration contract, and deployment status stated honestly. Cloud access is a stretch goal; deployment preparation is still a concrete deliverable.

## Thursday October 29 — before presentation

Allow 30–45 minutes for startup and smoke checks. Demonstrate the frozen build. Use screenshots if the network or hosting fails. Presentation time is not yet known.

## Proposed teammate interface (confirm before implementation)

- Prefix API routes with /api/v1. POST /auth/login accepts JSON email/password and returns access_token, token_type, expires_in. GET /auth/me returns id, email, display_name, role. Never return password hashes.
- Use employee and supervisor roles initially. Both can log in and access task workflows; supervisor assignment authority follows the user story on page 15. Exact edit/assignment permissions need team agreement. The server determines permissions from stored user data; frontend visibility is only a convenience.
- Agree on authentication transport and expiration before coding. Keep the first demo's token in browser memory if using bearer tokens; re-login after reload is acceptable. Defer persistent sessions, logout revocation, refresh tokens, registration, and password reset unless required for the demo.
- Share UUID identifiers, UTC timestamps, and stable task status values open, in_progress, completed. Proposed priorities low, medium, high require agreement.
- Garvin owns migrations, database session dependency, authentication helpers, role checks, test setup, and deployment configuration. Sadbhab calls shared helpers and implements task/handoff routes. Arjun implements screens and API calls against the contract. No teammate messages have been sent.
- A handoff links to existing tasks rather than copying them. Unique handoff/task links and acknowledgments prevent duplicates; transactions keep the handoff operation together. The detailed concurrency rules belong in the later handoff implementation and tests.

## Learning checkpoints

Database: tables store records; foreign keys connect them; migrations record schema changes. Authentication proves who a user is; authorization decides what they can do. Password hashing avoids storing readable passwords. Tests prove specific behavior, including denial cases. Deployment puts the verified application into an environment other people can reach.

## Presentation talking points — replace targets with verified results

- “My responsibility is the database, authentication, roles, testing, and deployment.”
- “Here is how a user signs in and how the API checks their permissions.”
- “Here are the database relationships and the migration that creates them.”
- “Here is an employee request being denied and a supervisor request succeeding.”
- “These are the tests we ran and the results.”
- “Next we integrate the task and handoff workflows; final deployment is planned for November 30.”

Do not claim cloud deployment, frontend integration, or handoff correctness until demonstrated and tested.
