-- Checks that every rule in 01_schema.sql is enforced by the database.
-- Run from the project root while the Docker database is up:
--
--   docker exec -i shift_handoff_db sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/tests/constraints_test.sql
--
-- Everything runs inside one transaction that is rolled back at the end,
-- so the database is left exactly as it was. Exits non-zero if any check fails.

\set QUIET on
SET client_min_messages = warning;

BEGIN;

-- Test fixtures: one user, two ended shifts, one task, and a handoff from shift A to B
-- that already contains the task. Checks below refer to them through fx.
-- The shifts are ended because only one shift may be active, and the seed data already has one.
INSERT INTO users (name, email, password_hash)
VALUES ('Constraints Test', 'constraints-test@example.com', 'fake_hash_demo_only');

INSERT INTO shifts (name, started_by, ended_at)
SELECT s.name, u.id, now()
FROM users u, (VALUES ('constraints-test shift A'), ('constraints-test shift B')) AS s(name)
WHERE u.email = 'constraints-test@example.com';

INSERT INTO tasks (title, created_by, created_in_shift)
SELECT 'constraints-test task', u.id, s.id
FROM users u, shifts s
WHERE u.email = 'constraints-test@example.com' AND s.name = 'constraints-test shift A';

INSERT INTO handoffs (from_shift_id, to_shift_id)
SELECT a.id, b.id
FROM shifts a, shifts b
WHERE a.name = 'constraints-test shift A' AND b.name = 'constraints-test shift B';

CREATE TEMP TABLE fx AS
SELECT
  (SELECT id FROM users  WHERE email = 'constraints-test@example.com') AS user_id,
  (SELECT id FROM shifts WHERE name  = 'constraints-test shift A')     AS shift_a,
  (SELECT id FROM shifts WHERE name  = 'constraints-test shift B')     AS shift_b,
  (SELECT id FROM tasks  WHERE title = 'constraints-test task')        AS task_id,
  (SELECT h.id FROM handoffs h JOIN shifts s ON s.id = h.from_shift_id
    WHERE s.name = 'constraints-test shift A')                         AS handoff_id;

INSERT INTO handoff_tasks (handoff_id, task_id)
SELECT handoff_id, task_id FROM fx;

-- Each check is one SQL statement plus the outcome we expect:
-- 'accepted', or the kind of error the database should raise.
CREATE TEMP TABLE checks (
  n           SERIAL,
  check_name  TEXT NOT NULL,
  expect      TEXT NOT NULL,
  stmt        TEXT NOT NULL,
  result      TEXT,
  detail      TEXT
);

INSERT INTO checks (check_name, expect, stmt) VALUES
  -- Valid data is accepted. If these fail, the FAIL/PASS results below can't be trusted.
  ('valid: priority low',     'accepted', $$INSERT INTO tasks (title, priority, created_by) VALUES ('t', 'low',    (SELECT user_id FROM fx))$$),
  ('valid: priority medium',  'accepted', $$INSERT INTO tasks (title, priority, created_by) VALUES ('t', 'medium', (SELECT user_id FROM fx))$$),
  ('valid: priority high',    'accepted', $$INSERT INTO tasks (title, priority, created_by) VALUES ('t', 'high',   (SELECT user_id FROM fx))$$),
  ('valid: status open',        'accepted', $$INSERT INTO tasks (title, status, created_by) VALUES ('t', 'open',        (SELECT user_id FROM fx))$$),
  ('valid: status in_progress', 'accepted', $$INSERT INTO tasks (title, status, created_by) VALUES ('t', 'in_progress', (SELECT user_id FROM fx))$$),
  ('valid: status completed',   'accepted', $$INSERT INTO tasks (title, status, created_by) VALUES ('t', 'completed',   (SELECT user_id FROM fx))$$),
  ('valid: a different shift can be handed off', 'accepted',
     $$INSERT INTO handoffs (from_shift_id) VALUES ((SELECT shift_b FROM fx))$$),
  ('valid: a second task can join the same handoff', 'accepted',
     $$WITH t AS (INSERT INTO tasks (title, created_by) VALUES ('t2', (SELECT user_id FROM fx)) RETURNING id)
       INSERT INTO handoff_tasks (handoff_id, task_id) SELECT (SELECT handoff_id FROM fx), id FROM t$$),
  ('valid: the same task can be in a different handoff', 'accepted',
     $$WITH h AS (INSERT INTO handoffs (from_shift_id) VALUES ((SELECT shift_b FROM fx)) RETURNING id)
       INSERT INTO handoff_tasks (handoff_id, task_id) SELECT id, (SELECT task_id FROM fx) FROM h$$),

  -- CHECK rules on tasks.priority and tasks.status
  ('invalid priority ''urgent'' rejected',          'check_violation',
     $$INSERT INTO tasks (title, priority, created_by) VALUES ('t', 'urgent', (SELECT user_id FROM fx))$$),
  ('wrong-case priority ''High'' rejected',         'check_violation',
     $$INSERT INTO tasks (title, priority, created_by) VALUES ('t', 'High', (SELECT user_id FROM fx))$$),
  ('invalid status ''done'' rejected',              'check_violation',
     $$INSERT INTO tasks (title, status, created_by) VALUES ('t', 'done', (SELECT user_id FROM fx))$$),
  ('empty status rejected',                         'check_violation',
     $$INSERT INTO tasks (title, status, created_by) VALUES ('t', '', (SELECT user_id FROM fx))$$),
  ('updating a task to an invalid status rejected', 'check_violation',
     $$UPDATE tasks SET status = 'closed' WHERE id = (SELECT task_id FROM fx)$$),

  -- UNIQUE rules
  ('duplicate email rejected', 'unique_violation',
     $$INSERT INTO users (name, email, password_hash) VALUES ('Dup', 'constraints-test@example.com', 'x')$$),
  ('same shift handed off twice rejected', 'unique_violation',
     $$INSERT INTO handoffs (from_shift_id, to_shift_id) VALUES ((SELECT shift_a FROM fx), (SELECT shift_b FROM fx))$$),
  ('same task twice in one handoff rejected', 'unique_violation',
     $$INSERT INTO handoff_tasks (handoff_id, task_id) VALUES ((SELECT handoff_id FROM fx), (SELECT task_id FROM fx))$$),

  -- Foreign keys: pointing at a row that doesn't exist (ids are never negative)
  ('shifts.started_by: unknown user rejected',           'foreign_key_violation',
     $$INSERT INTO shifts (name, started_by, ended_at) VALUES ('s', -1, now())$$),
  ('tasks.created_by: unknown user rejected',            'foreign_key_violation',
     $$INSERT INTO tasks (title, created_by) VALUES ('t', -1)$$),
  ('tasks.assigned_user_id: unknown user rejected',      'foreign_key_violation',
     $$INSERT INTO tasks (title, created_by, assigned_user_id) VALUES ('t', (SELECT user_id FROM fx), -1)$$),
  ('tasks.created_in_shift: unknown shift rejected',     'foreign_key_violation',
     $$INSERT INTO tasks (title, created_by, created_in_shift) VALUES ('t', (SELECT user_id FROM fx), -1)$$),
  ('task_events.task_id: unknown task rejected',         'foreign_key_violation',
     $$INSERT INTO task_events (task_id, action) VALUES (-1, 'created')$$),
  ('task_events.user_id: unknown user rejected',         'foreign_key_violation',
     $$INSERT INTO task_events (task_id, user_id, action) VALUES ((SELECT task_id FROM fx), -1, 'created')$$),
  ('handoffs.from_shift_id: unknown shift rejected',     'foreign_key_violation',
     $$INSERT INTO handoffs (from_shift_id) VALUES (-1)$$),
  ('handoffs.to_shift_id: unknown shift rejected',       'foreign_key_violation',
     $$INSERT INTO handoffs (from_shift_id, to_shift_id) VALUES ((SELECT shift_b FROM fx), -1)$$),
  ('handoffs.acknowledged_by: unknown user rejected',    'foreign_key_violation',
     $$INSERT INTO handoffs (from_shift_id, acknowledged_by) VALUES ((SELECT shift_b FROM fx), -1)$$),
  ('handoff_tasks.handoff_id: unknown handoff rejected', 'foreign_key_violation',
     $$INSERT INTO handoff_tasks (handoff_id, task_id) VALUES (-1, (SELECT task_id FROM fx))$$),
  ('handoff_tasks.task_id: unknown task rejected',       'foreign_key_violation',
     $$INSERT INTO handoff_tasks (handoff_id, task_id) VALUES ((SELECT handoff_id FROM fx), -1)$$),

  -- Foreign keys: deleting a row that other rows still point at
  ('deleting a user who created tasks rejected',   'foreign_key_violation',
     $$DELETE FROM users WHERE id = (SELECT user_id FROM fx)$$),
  ('deleting a shift that was handed off rejected', 'foreign_key_violation',
     $$DELETE FROM shifts WHERE id = (SELECT shift_a FROM fx)$$),
  ('deleting a task that is in a handoff rejected', 'foreign_key_violation',
     $$DELETE FROM tasks WHERE id = (SELECT task_id FROM fx)$$),

  -- NOT NULL rules: every required column
  ('users.name required',          'not_null_violation', $$INSERT INTO users (name, email, password_hash) VALUES (NULL, 'nn@example.com', 'x')$$),
  ('users.email required',         'not_null_violation', $$INSERT INTO users (name, email, password_hash) VALUES ('n', NULL, 'x')$$),
  ('users.password_hash required', 'not_null_violation', $$INSERT INTO users (name, email, password_hash) VALUES ('n', 'nn@example.com', NULL)$$),
  ('users.role required',          'not_null_violation', $$INSERT INTO users (name, email, password_hash, role) VALUES ('n', 'nn@example.com', 'x', NULL)$$),
  ('users.created_at required',    'not_null_violation', $$INSERT INTO users (name, email, password_hash, created_at) VALUES ('n', 'nn@example.com', 'x', NULL)$$),
  ('shifts.name required',         'not_null_violation', $$INSERT INTO shifts (name, ended_at) VALUES (NULL, now())$$),
  ('shifts.started_at required',   'not_null_violation', $$INSERT INTO shifts (name, started_at, ended_at) VALUES ('s', NULL, now())$$),
  ('tasks.title required',         'not_null_violation', $$INSERT INTO tasks (title, created_by) VALUES (NULL, (SELECT user_id FROM fx))$$),
  ('tasks.priority required',      'not_null_violation', $$INSERT INTO tasks (title, created_by, priority) VALUES ('t', (SELECT user_id FROM fx), NULL)$$),
  ('tasks.status required',        'not_null_violation', $$INSERT INTO tasks (title, created_by, status) VALUES ('t', (SELECT user_id FROM fx), NULL)$$),
  ('tasks.created_by required',    'not_null_violation', $$INSERT INTO tasks (title, created_by) VALUES ('t', NULL)$$),
  ('tasks.created_at required',    'not_null_violation', $$INSERT INTO tasks (title, created_by, created_at) VALUES ('t', (SELECT user_id FROM fx), NULL)$$),
  ('tasks.updated_at required',    'not_null_violation', $$INSERT INTO tasks (title, created_by, updated_at) VALUES ('t', (SELECT user_id FROM fx), NULL)$$),
  ('task_events.task_id required', 'not_null_violation', $$INSERT INTO task_events (task_id, action) VALUES (NULL, 'created')$$),
  ('task_events.action required',  'not_null_violation', $$INSERT INTO task_events (task_id, action) VALUES ((SELECT task_id FROM fx), NULL)$$),
  ('task_events.created_at required', 'not_null_violation', $$INSERT INTO task_events (task_id, action, created_at) VALUES ((SELECT task_id FROM fx), 'created', NULL)$$),
  ('handoffs.from_shift_id required', 'not_null_violation', $$INSERT INTO handoffs (from_shift_id) VALUES (NULL)$$),
  ('handoffs.created_at required',    'not_null_violation', $$INSERT INTO handoffs (from_shift_id, created_at) VALUES ((SELECT shift_b FROM fx), NULL)$$),
  ('handoff_tasks.handoff_id required', 'not_null_violation', $$INSERT INTO handoff_tasks (handoff_id, task_id) VALUES (NULL, (SELECT task_id FROM fx))$$),
  ('handoff_tasks.task_id required',    'not_null_violation', $$INSERT INTO handoff_tasks (handoff_id, task_id) VALUES ((SELECT handoff_id FROM fx), NULL)$$),

  -- Shift, role and email rules. Kept at the end so the check numbers above don't change.
  ('valid: role supervisor', 'accepted',
     $$INSERT INTO users (name, email, password_hash, role) VALUES ('S', 'sup@example.com', 'x', 'supervisor')$$),
  ('valid: ended shifts don''t count as active', 'accepted',
     $$INSERT INTO shifts (name, ended_at) VALUES ('x', now()), ('y', now())$$),
  ('valid: handed off to a different shift', 'accepted',
     $$INSERT INTO handoffs (from_shift_id, to_shift_id) VALUES ((SELECT shift_b FROM fx), (SELECT shift_a FROM fx))$$),
  ('invalid role ''admin'' rejected', 'check_violation',
     $$INSERT INTO users (name, email, password_hash, role) VALUES ('A', 'admin@example.com', 'x', 'admin')$$),
  ('shift ending before it starts rejected', 'check_violation',
     $$INSERT INTO shifts (name, started_at, ended_at) VALUES ('s', now(), now() - interval '1 hour')$$),
  ('shift handed off to itself rejected', 'check_violation',
     $$INSERT INTO handoffs (from_shift_id, to_shift_id) VALUES ((SELECT shift_b FROM fx), (SELECT shift_b FROM fx))$$),
  ('same email in different capitals rejected', 'unique_violation',
     $$INSERT INTO users (name, email, password_hash) VALUES ('Dup', 'Constraints-Test@Example.com', 'x')$$),
  -- Inserts two active shifts at once, so this fails whether or not one is already active.
  ('two active shifts at once rejected', 'unique_violation',
     $$INSERT INTO shifts (name) VALUES ('x'), ('y')$$),

  -- users.usual_shift
  ('valid: usual shift Night', 'accepted',
     $$INSERT INTO users (name, email, password_hash, usual_shift) VALUES ('N', 'night@example.com', 'x', 'Night')$$),
  ('invalid usual shift ''Afternoon'' rejected', 'check_violation',
     $$INSERT INTO users (name, email, password_hash, usual_shift) VALUES ('A', 'aft@example.com', 'x', 'Afternoon')$$);

-- Run each check and record PASS or FAIL. Every statement is undone right after
-- it runs (by raising 'undo'), so one check can never affect the next.
DO $run$
DECLARE
  c        RECORD;
  accepted BOOLEAN;
  code     TEXT;
BEGIN
  FOR c IN SELECT * FROM checks ORDER BY n LOOP
    accepted := false;
    -- Postgres error codes for each kind of rule violation
    code := CASE c.expect
              WHEN 'check_violation'       THEN '23514'
              WHEN 'unique_violation'      THEN '23505'
              WHEN 'foreign_key_violation' THEN '23503'
              WHEN 'not_null_violation'    THEN '23502'
            END;
    BEGIN
      EXECUTE c.stmt;
      accepted := true;
      RAISE EXCEPTION 'undo';
    EXCEPTION WHEN OTHERS THEN
      IF accepted AND c.expect = 'accepted' THEN
        UPDATE checks SET result = 'PASS' WHERE n = c.n;
      ELSIF accepted THEN
        UPDATE checks SET result = 'FAIL', detail = 'was accepted, expected ' || c.expect WHERE n = c.n;
      ELSIF c.expect = 'accepted' THEN
        UPDATE checks SET result = 'FAIL', detail = 'was rejected: ' || SQLERRM WHERE n = c.n;
      ELSIF SQLSTATE = code THEN
        UPDATE checks SET result = 'PASS' WHERE n = c.n;
      ELSE
        UPDATE checks SET result = 'FAIL', detail = 'wrong error, expected ' || c.expect || ': ' || SQLERRM WHERE n = c.n;
      END IF;
    END;
  END LOOP;
END
$run$;

\pset footer off
SELECT n AS "#", result, check_name AS "check", COALESCE(detail, '') AS detail
FROM checks ORDER BY n;

SELECT count(*) FILTER (WHERE result = 'PASS') AS passed,
       count(*) FILTER (WHERE result = 'FAIL') AS failed
FROM checks;

-- Make psql exit with an error code if anything failed (useful for CI later).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM checks WHERE result IS DISTINCT FROM 'PASS') THEN
    RAISE EXCEPTION 'constraint tests failed';
  END IF;
END
$$;

ROLLBACK;
