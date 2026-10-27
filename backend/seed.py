"""Explicit, repeatable demo-account setup; never runs on application startup."""
from getpass import getpass
import argparse
import json
import os
from pathlib import Path
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db import get_engine
from backend.app.models import User
from backend.app.security import password_hasher


def main(generate=False):
    print("Local demo setup. Existing users are left unchanged.")
    credentials_path = Path(".local/demo-accounts.json")
    if generate and credentials_path.exists():
        raise SystemExit("Demo credentials already exist; use the saved file or run without --generate.")
    accounts = []
    with Session(get_engine()) as db:
        for role in ("employee", "supervisor"):
            email = f"{role}@gsa.example"
            if db.scalar(select(User).where(User.email == email)):
                print(f"Already exists: {email}")
                continue
            password = secrets.token_urlsafe(18) if generate else getpass(
                f"Choose password for {email} (12+ characters): ")
            if len(password) < 12:
                raise SystemExit("Password must have at least 12 characters; nothing saved.")
            db.add(User(email=email, display_name=f"Demo {role.title()}", role=role,
                        password_hash=password_hasher.hash(password)))
            accounts.append({"email": email, "password": password, "role": role})
        db.commit()
    if generate and accounts:
        credentials_path.parent.mkdir(exist_ok=True, mode=0o700)
        with open(credentials_path, "x", opener=lambda p, f: os.open(p, f, 0o600)) as out:
            json.dump(accounts, out, indent=2)
        print(f"Local credentials saved in {credentials_path}; do not share or commit this file.")
    print("Demo accounts ready.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generate", action="store_true", help="Generate local-only demo passwords")
    main(parser.parse_args().generate)
