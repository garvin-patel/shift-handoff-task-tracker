from typing import Annotated

from fastapi import APIRouter, Query, status

from app.deps import CurrentUser, DbSession
from app.schemas import HandoffOut, ShiftOut, ShiftStart
from app.services import shifts as svc

router = APIRouter(prefix="/shifts", tags=["shifts"])


@router.get("", response_model=list[ShiftOut])
def list_shifts(
    db: DbSession,
    _: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Shifts, newest first."""
    return [ShiftOut.model_validate(s) for s in svc.list_shifts(db, limit=limit, offset=offset)]


@router.get("/current", response_model=ShiftOut | None)
def current_shift(db: DbSession, _: CurrentUser):
    """The active shift, or null if no shift is running."""
    shift = svc.get_active_shift(db)
    return ShiftOut.model_validate(shift) if shift else None


@router.get("/{shift_id}", response_model=ShiftOut)
def get_shift(shift_id: int, db: DbSession, _: CurrentUser):
    return ShiftOut.model_validate(svc.get_shift(db, shift_id))


@router.post("", response_model=ShiftOut, status_code=status.HTTP_201_CREATED)
def start_shift(data: ShiftStart, db: DbSession, user: CurrentUser):
    """Start a new shift. Fails with 409 if another shift is active.

    The previous shift's handoff (its unfinished tasks) is linked to the new shift.
    """
    return ShiftOut.model_validate(svc.start_shift(db, data.name, user))


@router.post("/{shift_id}/end", response_model=HandoffOut)
def end_shift(shift_id: int, db: DbSession, _: CurrentUser):
    """End the shift and hand off every unfinished task to the next shift."""
    return HandoffOut.model_validate(svc.end_shift(db, shift_id))


@router.post("/{shift_id}/handoff", response_model=HandoffOut)
def prepare_handoff(shift_id: int, db: DbSession, _: CurrentUser):
    """Preview/prepare the handoff before ending. It is refreshed again when the shift ends."""
    return HandoffOut.model_validate(svc.prepare_handoff(db, shift_id))
