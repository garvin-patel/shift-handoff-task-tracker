from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import CurrentUser, DbSession
from app.schemas import HandoffOut, HandoffSummary
from app.services import shifts as svc

router = APIRouter(prefix="/handoffs", tags=["handoffs"])


@router.get("", response_model=list[HandoffSummary])
def list_handoffs(
    db: DbSession,
    _: CurrentUser,
    acknowledged: bool | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    handoffs = svc.list_handoffs(db, acknowledged=acknowledged, limit=limit, offset=offset)
    return [HandoffSummary.model_validate(h) for h in handoffs]


@router.get("/incoming", response_model=HandoffOut | None)
def incoming_handoff(db: DbSession, _: CurrentUser):
    """What the current shift received from the previous one (null if nothing)."""
    handoff = svc.get_incoming_handoff(db)
    return HandoffOut.model_validate(handoff) if handoff else None


@router.get("/{handoff_id}", response_model=HandoffOut)
def get_handoff(handoff_id: int, db: DbSession, _: CurrentUser):
    return HandoffOut.model_validate(svc.get_handoff(db, handoff_id))


@router.post("/{handoff_id}/acknowledge", response_model=HandoffOut)
def acknowledge_handoff(handoff_id: int, db: DbSession, user: CurrentUser):
    """Confirm the incoming shift has reviewed the carried-over tasks."""
    return HandoffOut.model_validate(svc.acknowledge_handoff(db, handoff_id, user))
