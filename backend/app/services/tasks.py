"""Task creation, updates, assignment and status changes.

Every change is recorded in task_events. Actions used (matching the seed data):
  created           new_value = initial status
  assigned          old/new_value = user ids (new_value NULL when unassigned)
  department_changed old/new_value = department names
  status_changed    old/new_value = statuses
  priority_changed  old/new_value = priorities
  title_changed / description_changed
  comment           new_value = note text
"""

from sqlalchemy import case, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Task, TaskEvent, User, handoff_tasks
from app.schemas import TaskAssign, TaskCreate, TaskStatus, TaskUpdate
from app.services.common import bad_request, not_found, utcnow
from app.services.shifts import get_active_shift

# Sort high -> low priority.
PRIORITY_RANK = case({"high": 0, "medium": 1, "low": 2}, value=Task.priority, else_=3)

_TASK_LOAD = (selectinload(Task.assignee), selectinload(Task.creator))


def _str(value: object) -> str | None:
    return None if value is None else str(value)


def _log(db: Session, task: Task, actor: User, action: str, old=None, new=None) -> bool:
    """Record a task event. Returns True so callers can track whether anything changed."""
    db.add(
        TaskEvent(task_id=task.id, user_id=actor.id, action=action, old_value=_str(old), new_value=_str(new))
    )
    return True


def _get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise bad_request(f"User {user_id} does not exist")
    return user


def load_task(db: Session, task_id: int, *, with_events: bool = False) -> Task:
    options = list(_TASK_LOAD)
    if with_events:
        options.append(selectinload(Task.events).selectinload(TaskEvent.user))
    task = db.scalar(
        select(Task).where(Task.id == task_id).options(*options).execution_options(populate_existing=True)
    )
    if task is None:
        raise not_found("Task", task_id)
    return task


def _lock_task(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id, with_for_update=True)
    if task is None:
        raise not_found("Task", task_id)
    return task


def handoff_ids_for_task(db: Session, task_id: int) -> list[int]:
    stmt = (
        select(handoff_tasks.c.handoff_id)
        .where(handoff_tasks.c.task_id == task_id)
        .order_by(handoff_tasks.c.handoff_id)
    )
    return list(db.scalars(stmt))


def list_tasks(
    db: Session,
    *,
    status: list[TaskStatus] | None = None,
    priority: str | None = None,
    assigned_user_id: int | None = None,
    assigned_department: str | None = None,
    created_in_shift: int | None = None,
    unfinished: bool | None = None,
    unassigned: bool | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Task]:
    stmt = select(Task).options(*_TASK_LOAD)
    if status:
        stmt = stmt.where(Task.status.in_([s.value for s in status]))
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if assigned_user_id is not None:
        stmt = stmt.where(Task.assigned_user_id == assigned_user_id)
    if assigned_department:
        stmt = stmt.where(Task.assigned_department.ilike(assigned_department))
    if created_in_shift is not None:
        stmt = stmt.where(Task.created_in_shift == created_in_shift)
    if unfinished is True:
        stmt = stmt.where(Task.status != TaskStatus.completed)
    elif unfinished is False:
        stmt = stmt.where(Task.status == TaskStatus.completed)
    if unassigned is True:
        stmt = stmt.where(Task.assigned_user_id.is_(None))
    elif unassigned is False:
        stmt = stmt.where(Task.assigned_user_id.is_not(None))
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Task.title.ilike(pattern), Task.description.ilike(pattern)))
    stmt = stmt.order_by(PRIORITY_RANK, Task.created_at, Task.id).limit(limit).offset(offset)
    return list(db.scalars(stmt))


def create_task(db: Session, data: TaskCreate, actor: User) -> Task:
    assignee = _get_user(db, data.assigned_user_id) if data.assigned_user_id is not None else None
    department = data.assigned_department or (assignee.department if assignee else None)
    shift = get_active_shift(db)

    task = Task(
        title=data.title.strip(),
        description=data.description,
        priority=data.priority.value,
        status=TaskStatus.open.value,
        assigned_user_id=assignee.id if assignee else None,
        assigned_department=department,
        created_by=actor.id,
        created_in_shift=shift.id if shift else None,
    )
    db.add(task)
    db.flush()

    _log(db, task, actor, "created", new=task.status)
    if assignee:
        _log(db, task, actor, "assigned", new=assignee.id)
    db.commit()
    return load_task(db, task.id)


def update_task(db: Session, task_id: int, data: TaskUpdate, actor: User) -> Task:
    task = _lock_task(db, task_id)
    fields = data.model_fields_set
    changed = False

    if "title" in fields:
        if data.title is None or not data.title.strip():
            raise bad_request("title cannot be empty")
        title = data.title.strip()
        if title != task.title:
            changed = _log(db, task, actor, "title_changed", task.title, title)
            task.title = title

    if "description" in fields and data.description != task.description:
        changed = _log(db, task, actor, "description_changed", task.description, data.description)
        task.description = data.description

    if "priority" in fields:
        if data.priority is None:
            raise bad_request("priority cannot be null")
        if data.priority.value != task.priority:
            changed = _log(db, task, actor, "priority_changed", task.priority, data.priority.value)
            task.priority = data.priority.value

    if changed:
        task.updated_at = utcnow()
    db.commit()
    return load_task(db, task_id)


def assign_task(db: Session, task_id: int, data: TaskAssign, actor: User) -> Task:
    task = _lock_task(db, task_id)
    assignee = _get_user(db, data.assigned_user_id) if data.assigned_user_id is not None else None

    if "assigned_department" in data.model_fields_set:
        department = data.assigned_department
    elif assignee and assignee.department:
        department = assignee.department
    else:
        department = task.assigned_department

    new_user_id = assignee.id if assignee else None
    changed = False
    if new_user_id != task.assigned_user_id:
        changed = _log(db, task, actor, "assigned", task.assigned_user_id, new_user_id)
        task.assigned_user_id = new_user_id
    if department != task.assigned_department:
        changed = _log(db, task, actor, "department_changed", task.assigned_department, department)
        task.assigned_department = department

    if changed:
        task.updated_at = utcnow()
    db.commit()
    return load_task(db, task_id)


def change_status(db: Session, task_id: int, new_status: TaskStatus, actor: User, comment: str | None) -> Task:
    task = _lock_task(db, task_id)
    now = utcnow()
    changed = False

    if new_status.value != task.status:
        changed = _log(db, task, actor, "status_changed", task.status, new_status.value)
        task.status = new_status.value
        task.completed_at = now if new_status == TaskStatus.completed else None
    if comment and comment.strip():
        changed = _log(db, task, actor, "comment", new=comment.strip())

    if changed:
        task.updated_at = now
    db.commit()
    return load_task(db, task_id)


def add_comment(db: Session, task_id: int, text: str, actor: User) -> TaskEvent:
    task = _lock_task(db, task_id)
    if not text.strip():
        raise bad_request("Comment cannot be empty")
    event = TaskEvent(task_id=task.id, user_id=actor.id, action="comment", new_value=text.strip())
    db.add(event)
    task.updated_at = utcnow()
    db.commit()
    db.refresh(event, ["user"])
    return event


def list_events(db: Session, task_id: int) -> list[TaskEvent]:
    if db.get(Task, task_id) is None:
        raise not_found("Task", task_id)
    stmt = (
        select(TaskEvent)
        .where(TaskEvent.task_id == task_id)
        .options(selectinload(TaskEvent.user))
        .order_by(TaskEvent.created_at, TaskEvent.id)
    )
    return list(db.scalars(stmt))
