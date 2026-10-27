"""Manage a project-local PostgreSQL cluster on a developer machine.

Run from the repository root. No login service or system database is modified.
"""
import argparse
import os
from pathlib import Path
import secrets
import shutil
import subprocess

import psycopg
from psycopg import sql
from dotenv import dotenv_values
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / ".local"
DATA = LOCAL / "postgres"
ADMIN_PASSWORD = LOCAL / "admin-password"
PORT = 55432


def executable(name):
    bindir = os.environ.get("PG_BIN", "/opt/homebrew/opt/postgresql@17/bin")
    candidate = Path(bindir) / name
    found = str(candidate) if candidate.exists() else shutil.which(name)
    if not found:
        raise SystemExit("Install PostgreSQL 17 or set PG_BIN to its bin directory.")
    return found


def run(name, *args, **kwargs):
    return subprocess.run([executable(name), *map(str, args)], check=True, **kwargs)


def start():
    status = subprocess.run([executable("pg_ctl"), "-D", str(DATA), "status"],
                            capture_output=True)
    if status.returncode != 0:
        run("pg_ctl", "-D", DATA, "-l", LOCAL / "postgres.log", "-o",
            f"-h 127.0.0.1 -p {PORT} -c unix_socket_directories=''", "-w", "start")
    print(f"Project PostgreSQL is running on 127.0.0.1:{PORT}.")


def setup():
    LOCAL.mkdir(exist_ok=True, mode=0o700)
    env_path = ROOT / ".env"
    if not env_path.exists():
        if DATA.exists():
            raise SystemExit("Existing cluster has no .env. Restore .env before continuing.")
        app_password = secrets.token_urlsafe(32)
        with open(env_path, "x", opener=lambda p, f: os.open(p, f, 0o600)) as env:
            env.write(
                f"DATABASE_URL=postgresql+psycopg://gsa_app:{app_password}@127.0.0.1:{PORT}/gsa\n"
                f"TEST_DATABASE_URL=postgresql+psycopg://gsa_app:{app_password}@127.0.0.1:{PORT}/gsa_test\n"
                f"JWT_SECRET={secrets.token_urlsafe(48)}\n"
            )
    env = dotenv_values(env_path)
    url = make_url(env["DATABASE_URL"])
    if (url.host, url.port, url.username, url.database) != ("127.0.0.1", PORT, "gsa_app", "gsa"):
        raise SystemExit("Local setup requires the project-local gsa connection. Use manual setup for other servers.")
    if not DATA.exists():
        if not ADMIN_PASSWORD.exists():
            with open(ADMIN_PASSWORD, "x", opener=lambda p, f: os.open(p, f, 0o600)) as out:
                out.write(secrets.token_urlsafe(48))
        run("initdb", "-D", DATA, "-U", "gsa_local_admin", "--auth=scram-sha-256",
            "--pwfile", ADMIN_PASSWORD, "--encoding=UTF8", "--locale=C")
    start()
    with psycopg.connect(host="127.0.0.1", port=PORT, user="gsa_local_admin",
                         password=ADMIN_PASSWORD.read_text(), dbname="postgres", autocommit=True) as conn:
        if not conn.execute("SELECT 1 FROM pg_roles WHERE rolname='gsa_app'").fetchone():
            conn.execute(sql.SQL("CREATE ROLE gsa_app LOGIN PASSWORD {}").format(sql.Literal(url.password)))
        for name in ("gsa", "gsa_test"):
            if not conn.execute("SELECT 1 FROM pg_database WHERE datname=%s", (name,)).fetchone():
                conn.execute(sql.SQL("CREATE DATABASE {} OWNER gsa_app").format(sql.Identifier(name)))
    print("Databases gsa and gsa_test ready. Secrets are stored only in ignored local files.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["setup", "start", "stop"])
    args = parser.parse_args()
    os.chdir(ROOT)
    if args.action == "setup":
        setup()
    elif args.action == "start":
        start()
    else:
        run("pg_ctl", "-D", DATA, "-m", "fast", "-w", "stop")
