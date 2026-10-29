"""Shift lifecycle and handoffs (carrying unfinished tasks to the next shift).

Flow:
  1. POST /shifts               start a shift (only one may be active at a time).
                                 If the previous shift left a handoff, it is linked
                                 to this new shift (handoffs.to_shift_id).
  2. POST /shifts/{id}/handoff  optional: prepare/refresh the handoff before ending.
  3. POST /shifts/{id}/end      end the shift. A handoff is created (or refreshed)
                                 containing every task that is not completed.
  4. POST /handoffs/{id}/acknowledge   someone on the next shift confirms receipt.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Handoff, Shift, Task, User
from app.services.common import conflict, lock_shifts, not_found, utcnow

_HANDOFF_LOAD = (
    selectinload(Handoff.from_shift).selectinload(Shift.started_by_user),
    selectinload(Handoff.to_shift).selectinload(Shift.started_by_user),
    selectinload(Handoff.acknowledged_by_user),
    selectinload(Handoff.tasks).selectinload(Task.assignee),
    selectinload(Handoff.tasks).selectinload(Task.creator),
)


# ---------- Shifts ----------


def get_active_shift(db: Session) -> Shift | None:
    stmt = (
        select(Shift)
        .where(Shift.ended_at.is_(None))
        .options(selectinload(Shift.started_by_user))
        .order_by(Shift.started_at.desc(), Shift.id.desc())
        .limit(1)
    )
    return db.scalar(stmt)


def get_shift(db: Session, shift_id: int) -> Shift:
    shift = db.get(Shift, shift_id, options=[selectinload(Shift.started_by_user)])
    if shift is None:
        raise not_found("Shift", shift_id)
    return shift


def list_shifts(db: Session, *, limit: int = 50, offset: int = 0) -> list[Shift]:
    stmt = (
        select(Shift)
        .options(selectinload(Shift.started_by_user))
        .order_by(Shift.started_at.desc(), Shift.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt))


def start_shift(db: Session, name: str, actor: User) -> Shift:
    lock_shifts(db)
    active = get_active_shift(db)
    if active is not None:
        raise conflict(f"Shift {active.id} ({active.name}) is still active. End it before starting a new one.")

    shift = Shift(name=name.strip(), started_by=actor.id)
    db.add(shift)
    db.flush()

    # Link the most recent handoff that is still waiting for a next shift.
    pending = db.scalar(
        select(Handoff)
        .join(Shift, Handoff.from_shift_id == Shift.id)
        .where(Handoff.to_shift_id.is_(None), Shift.ended_at.is_not(None))
        .order_by(Shift.ended_at.desc(), Handoff.id.desc())
        .limit(1)
    )
    if pending is not None:
        pending.to_shift_id = shift.id

    db.commit()
    return get_shift(db, shift.id)


def end_shift(db: Session, shift_id: int) -> Handoff:
    lock_shifts(db)
    shift = db.get(Shift, shift_id, with_for_update=True)
    if shift is None:
        raise not_found("Shift", shift_id)
    if shift.ended_at is not None:
        raise conflict(f"Shift {shift_id} has already ended")

    shift.ended_at = utcnow()
    handoff = _snapshot_handoff(db, shift)
    db.commit()
    return get_handoff(db, handoff.id)


def prepare_handoff(db: Session, shift_id: int) -> Handoff:
    """Create or refresh the handoff for an active shift without ending it."""
    shift = db.get(Shift, shift_id, with_for_update=True)
    if shift is None:
        raise not_found("Shift", shift_id)
    if shift.ended_at is not None:
        raise conflict(f"Shift {shift_id} has already ended")

    handoff = _snapshot_handoff(db, shift)
    db.commit()
    return get_handoff(db, handoff.id)


def unfinished_tasks(db: Session) -> list[Task]:
    return list(db.scalars(select(Task).where(Task.status != "completed").order_by(Task.id)))


def _snapshot_handoff(db: Session, shift: Shift) -> Handoff:
    """Point the shift's handoff at the tasks that are unfinished right now.

    Unfinished tasks from earlier shifts are included too, so nothing is dropped
    if it was carried over more than once.
    """
    handoff = db.scalar(select(Handoff).where(Handoff.from_shift_id == shift.id))
    if handoff is not None and handoff.acknowledged_at is not None:
        raise conflict(f"Handoff {handoff.id} was already acknowledged and can't be changed")
    if handoff is None:
        handoff = Handoff(from_shift_id=shift.id)
        db.add(handoff)

    handoff.tasks = unfinished_tasks(db)
    db.flush()
    return handoff


# ---------- Handoffs ----------


def get_handoff(db: Session, handoff_id: int) -> Handoff:
    handoff = db.scalar(
        select(Handoff)
        .where(Handoff.id == handoff_id)
        .options(*_HANDOFF_LOAD)
        .execution_options(populate_existing=True)
    )
    if handoff is None:
        raise not_found("Handoff", handoff_id)
    return handoff


def list_handoffs(
    db: Session, *, acknowledged: bool | None = None, limit: int = 50, offset: int = 0
) -> list[Handoff]:
    stmt = select(Handoff).options(*_HANDOFF_LOAD)
    if acknowledged is True:
        stmt = stmt.where(Handoff.acknowledged_at.is_not(None))
    elif acknowledged is False:
        stmt = stmt.where(Handoff.acknowledged_at.is_(None))
    stmt = stmt.order_by(Handoff.created_at.desc(), Handoff.id.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt))


def get_incoming_handoff(db: Session) -> Handoff | None:
    """The handoff received by the currently active shift, if any."""
    active = get_active_shift(db)
    if active is None:
        return None
    handoff_id = db.scalar(select(Handoff.id).where(Handoff.to_shift_id == active.id))
    return get_handoff(db, handoff_id) if handoff_id is not None else None


def acknowledge_handoff(db: Session, handoff_id: int, actor: User) -> Handoff:
    handoff = db.get(Handoff, handoff_id, with_for_update=True)
    if handoff is None:
        raise not_found("Handoff", handoff_id)
    if handoff.acknowledged_at is not None:
        raise conflict(f"Handoff {handoff_id} was already acknowledged")
    if handoff.to_shift_id is None:
        raise conflict("The next shift hasn't started yet, so this handoff can't be acknowledged")

    handoff.acknowledged_by = actor.id
    handoff.acknowledged_at = utcnow()
    db.commit()
    return get_handoff(db, handoff_id)
