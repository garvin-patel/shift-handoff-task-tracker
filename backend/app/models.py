"""ORM models mirroring database/01_schema.sql.

The SQL files are the source of truth for the real database; keep these in sync with them.
"""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Table,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

TASK_STATUSES = ("open", "in_progress", "completed")
TASK_PRIORITIES = ("low", "medium", "high")


class Base(DeclarativeBase):
    # Fetch server-generated values (ids, created_at) right after INSERT.
    __mapper_args__ = {"eager_defaults": True}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text, default="employee", server_default="employee")
    department: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    started_by_user: Mapped[User | None] = relationship(foreign_keys=[started_by])


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("priority IN ('low', 'medium', 'high')", name="tasks_priority_check"),
        CheckConstraint("status IN ('open', 'in_progress', 'completed')", name="tasks_status_check"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(Text, default="medium", server_default="medium")
    status: Mapped[str] = mapped_column(Text, default="open", server_default="open")
    assigned_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    assigned_department: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_in_shift: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    assignee: Mapped[User | None] = relationship(foreign_keys=[assigned_user_id])
    creator: Mapped[User] = relationship(foreign_keys=[created_by])
    events: Mapped[list["TaskEvent"]] = relationship(
        back_populates="task", order_by="TaskEvent.created_at, TaskEvent.id"
    )


class TaskEvent(Base):
    __tablename__ = "task_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(Text)
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task: Mapped[Task] = relationship(back_populates="events")
    user: Mapped[User | None] = relationship()


handoff_tasks = Table(
    "handoff_tasks",
    Base.metadata,
    Column("handoff_id", Integer, ForeignKey("handoffs.id"), primary_key=True),
    Column("task_id", Integer, ForeignKey("tasks.id"), primary_key=True),
)


class Handoff(Base):
    __tablename__ = "handoffs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    from_shift_id: Mapped[int] = mapped_column(ForeignKey("shifts.id"), unique=True)
    to_shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    acknowledged_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    from_shift: Mapped[Shift] = relationship(foreign_keys=[from_shift_id])
    to_shift: Mapped[Shift | None] = relationship(foreign_keys=[to_shift_id])
    acknowledged_by_user: Mapped[User | None] = relationship(foreign_keys=[acknowledged_by])
    tasks: Mapped[list[Task]] = relationship(secondary=handoff_tasks, order_by=Task.id)

    @property
    def task_count(self) -> int:
        return len(self.tasks)
