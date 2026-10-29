from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

# Arbitrary constant key for the Postgres advisory lock that serializes shift start/end.
SHIFT_LOCK_KEY = 74_201


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def not_found(what: str, id_: int) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} {id_} not found")


def conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def lock_shifts(db: Session) -> None:
    """Serialize shift start/end so two shifts can't be active at once.

    Held until the transaction ends. No-op on non-Postgres databases (tests).
    """
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": SHIFT_LOCK_KEY})
