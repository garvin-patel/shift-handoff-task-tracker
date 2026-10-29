CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'employee'
                   CHECK (role IN ('employee', 'supervisor')),
    department     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
 );

-- Emails are unique regardless of capitalization (Maria@... and maria@... are the same person).
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

 CREATE TABLE shifts (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  started_by  INTEGER REFERENCES users(id),
  CONSTRAINT shifts_ends_after_start CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Only one shift can be active (not ended) at a time.
CREATE UNIQUE INDEX shifts_one_active ON shifts ((true)) WHERE ended_at IS NULL;

CREATE TABLE tasks (
  id                  SERIAL PRIMARY KEY,
  title               TEXT NOT NULL,
  description         TEXT,
  priority            TEXT NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low', 'medium', 'high')),
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'in_progress', 'completed')),
  assigned_user_id    INTEGER REFERENCES users(id),
  assigned_department TEXT,
  created_by          INTEGER NOT NULL REFERENCES users(id),
  created_in_shift    INTEGER REFERENCES shifts(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

CREATE TABLE task_events (
  id          SERIAL PRIMARY KEY,
  task_id     INTEGER NOT NULL REFERENCES tasks(id),
  user_id     INTEGER REFERENCES users(id),
  action      TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE handoffs (
  id               SERIAL PRIMARY KEY,
  from_shift_id    INTEGER NOT NULL UNIQUE REFERENCES shifts(id),
  to_shift_id      INTEGER REFERENCES shifts(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by  INTEGER REFERENCES users(id),
  acknowledged_at  TIMESTAMPTZ,
  CONSTRAINT handoffs_not_to_self CHECK (to_shift_id IS NULL OR to_shift_id <> from_shift_id)
);

CREATE TABLE handoff_tasks (
  handoff_id  INTEGER NOT NULL REFERENCES handoffs(id),
  task_id     INTEGER NOT NULL REFERENCES tasks(id),
  PRIMARY KEY (handoff_id, task_id)
);

-- Indexes for the lookups the app does most often.
CREATE INDEX tasks_status_idx             ON tasks (status);
CREATE INDEX tasks_assigned_user_id_idx   ON tasks (assigned_user_id);
CREATE INDEX tasks_created_in_shift_idx   ON tasks (created_in_shift);
CREATE INDEX task_events_task_id_idx      ON task_events (task_id);
CREATE INDEX handoffs_to_shift_id_idx     ON handoffs (to_shift_id);
CREATE INDEX handoff_tasks_task_id_idx    ON handoff_tasks (task_id);