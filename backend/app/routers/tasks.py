from typing import Annotated

from fastapi import APIRouter, Query, status

from app.deps import CurrentUser, DbSession
from app.schemas import (
    CommentCreate,
    TaskAssign,
    TaskCreate,
    TaskDetail,
    TaskEventOut,
    TaskOut,
    TaskPriority,
    TaskStatus,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.services import tasks as svc

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
def list_tasks(
    db: DbSession,
    user: CurrentUser,
    status_: Annotated[list[TaskStatus] | None, Query(alias="status")] = None,
    priority: TaskPriority | None = None,
    assigned_user_id: int | None = None,
    assigned_department: str | None = None,
    created_in_shift: int | None = None,
    unfinished: Annotated[bool | None, Query(description="true = not completed, false = completed")] = None,
    unassigned: bool | None = None,
    mine: Annotated[bool, Query(description="Only tasks assigned to me")] = False,
    q: Annotated[str | None, Query(description="Search title and description")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """List tasks, highest priority first. `status` can be repeated: ?status=open&status=in_progress"""
    tasks = svc.list_tasks(
        db,
        status=status_,
        priority=priority.value if priority else None,
        assigned_user_id=user.id if mine else assigned_user_id,
        assigned_department=assigned_department,
        created_in_shift=created_in_shift,
        unfinished=unfinished,
        unassigned=unassigned,
        q=q,
        limit=limit,
        offset=offset,
    )
    return [TaskOut.model_validate(t) for t in tasks]


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(data: TaskCreate, db: DbSession, user: CurrentUser):
    """Create a task. It is stamped with the current active shift (if any)."""
    return TaskOut.model_validate(svc.create_task(db, data, user))


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(task_id: int, db: DbSession, _: CurrentUser):
    task = svc.load_task(db, task_id, with_events=True)
    return TaskDetail(
        **TaskOut.model_validate(task).model_dump(),
        events=[TaskEventOut.model_validate(e) for e in task.events],
        handoff_ids=svc.handoff_ids_for_task(db, task_id),
    )


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, data: TaskUpdate, db: DbSession, user: CurrentUser):
    """Edit title, description and/or priority."""
    return TaskOut.model_validate(svc.update_task(db, task_id, data, user))


@router.put("/{task_id}/assignment", response_model=TaskOut)
def assign_task(task_id: int, data: TaskAssign, db: DbSession, user: CurrentUser):
    """Assign (or unassign with `assigned_user_id: null`) a task."""
    return TaskOut.model_validate(svc.assign_task(db, task_id, data, user))


@router.put("/{task_id}/status", response_model=TaskOut)
def change_status(task_id: int, data: TaskStatusUpdate, db: DbSession, user: CurrentUser):
    """Move a task between open / in_progress / completed, with an optional note."""
    return TaskOut.model_validate(svc.change_status(db, task_id, data.status, user, data.comment))


@router.post("/{task_id}/comments", response_model=TaskEventOut, status_code=status.HTTP_201_CREATED)
def add_comment(task_id: int, data: CommentCreate, db: DbSession, user: CurrentUser):
    return TaskEventOut.model_validate(svc.add_comment(db, task_id, data.text, user))


@router.get("/{task_id}/events", response_model=list[TaskEventOut])
def list_events(task_id: int, db: DbSession, _: CurrentUser):
    """Full history of a task (creation, assignments, status changes, comments...)."""
    return [TaskEventOut.model_validate(e) for e in svc.list_events(db, task_id)]
