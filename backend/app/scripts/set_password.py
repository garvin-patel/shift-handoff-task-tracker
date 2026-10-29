"""Set a real password for an existing user (e.g. the seed users, whose hashes are fake).

Usage (from backend/):
    python -m app.scripts.set_password maria.lopez@example.com password123
    python -m app.scripts.set_password --all-seed-users password123
"""

import argparse
import sys

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import User
from app.security import hash_password

SEED_PLACEHOLDER_HASH = "fake_hash_demo_only"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("email", nargs="?")
    target.add_argument("--all-seed-users", action="store_true", help="every user still on the seed placeholder hash")
    parser.add_argument("password")
    args = parser.parse_args()

    if len(args.password) < 8:
        print("Password must be at least 8 characters", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        if args.all_seed_users:
            users = list(db.scalars(select(User).where(User.password_hash == SEED_PLACEHOLDER_HASH)))
        else:
            users = list(db.scalars(select(User).where(func.lower(User.email) == args.email.lower())))
        if not users:
            print("No matching users found", file=sys.stderr)
            return 1
        for user in users:
            user.password_hash = hash_password(args.password)
            print(f"Password set for {user.email}")
        db.commit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
