CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'employee',
    department     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
 );