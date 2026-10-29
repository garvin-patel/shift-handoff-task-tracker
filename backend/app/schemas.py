from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, field_validator


class TaskStatus(StrEnum):
    open = "open"
    in_progress = "in_progress"
    completed = "completed"


class TaskPriority(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class UserRole(StrEnum):
    employee = "employee"
    supervisor = "supervisor"


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Users & auth ----------


def _check_password(value: str) -> str:
    # bcrypt only looks at the first 72 bytes and rejects longer input.
    if len(value.encode()) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return value


class UserBrief(ORMModel):
    id: int
    name: str
    department: str | None


class UserOut(ORMModel):
    id: int
    name: str
    email: str
    role: str
    department: str | None
    created_at: datetime


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)
    department: str | None = Field(default=None, max_length=100)

    _password = field_validator("password")(_check_password)


class UserCreate(RegisterRequest):
    """Supervisor-only: create a user with any role."""

    role: UserRole = UserRole.employee


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Shifts ----------


class ShiftStart(BaseModel):
    name: str = Field(min_length=1, max_length=50, examples=["Morning", "Evening", "Night"])


class ShiftOut(ORMModel):
    id: int
    name: str
    started_at: datetime
    ended_at: datetime | None
    started_by: int | None
    started_by_user: UserBrief | None

    @computed_field
    @property
    def is_active(self) -> bool:
        return self.ended_at is None


# ---------- Tasks ----------


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    priority: TaskPriority = TaskPriority.medium
    assigned_user_id: int | None = None
    # Defaults to the assignee's department when omitted.
    assigned_department: str | None = Field(default=None, max_length=100)


class TaskUpdate(BaseModel):
    """Partial update; only the fields you send are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    priority: TaskPriority | None = None


class TaskAssign(BaseModel):
    """Set assigned_user_id to null to unassign.

    If assigned_department is omitted it follows the new assignee's department.
    """

    assigned_user_id: int | None
    assigned_department: str | None = Field(default=None, max_length=100)


class TaskStatusUpdate(BaseModel):
    status: TaskStatus
    comment: str | None = Field(default=None, max_length=2000)


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class TaskOut(ORMModel):
    id: int
    title: str
    description: str | None
    priority: TaskPriority
    status: TaskStatus
    assigned_user_id: int | None
    assigned_department: str | None
    created_by: int
    created_in_shift: int | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    assignee: UserBrief | None
    creator: UserBrief


class TaskEventOut(ORMModel):
    id: int
    task_id: int
    user_id: int | None
    action: str
    old_value: str | None
    new_value: str | None
    created_at: datetime
    user: UserBrief | None


class TaskDetail(TaskOut):
    events: list[TaskEventOut]
    # Handoffs this task was carried over in.
    handoff_ids: list[int]


# ---------- Handoffs ----------


class HandoffSummary(ORMModel):
    id: int
    from_shift: ShiftOut
    to_shift: ShiftOut | None
    created_at: datetime
    acknowledged_by: int | None
    acknowledged_by_user: UserBrief | None
    acknowledged_at: datetime | None
    task_count: int


class HandoffOut(HandoffSummary):
    # Tasks carried over, with their *current* state.
    tasks: list[TaskOut]
