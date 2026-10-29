CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'employee',
    department     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
 );

 CREATE TABLE shifts (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  started_by  INTEGER REFERENCES users(id)
);

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
  acknowledged_at  TIMESTAMPTZ
);

CREATE TABLE handoff_tasks (
  handoff_id  INTEGER NOT NULL REFERENCES handoffs(id),
  task_id     INTEGER NOT NULL REFERENCES tasks(id),
  PRIMARY KEY (handoff_id, task_id)
);