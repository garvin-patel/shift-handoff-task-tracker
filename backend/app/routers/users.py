from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession, Supervisor
from app.models import User
from app.routers.auth import create_user
from app.schemas import PasswordChange, UserCreate, UserOut
from app.security import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return UserOut.model_validate(user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(data: PasswordChange, db: DbSession, user: CurrentUser):
    """Change your own password, e.g. to replace the temporary one a supervisor gave you."""
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=list[UserOut])
def list_users(
    db: DbSession,
    _: CurrentUser,
    department: str | None = None,
    role: str | None = None,
):
    """List users, e.g. to fill an "assign to" dropdown."""
    stmt = select(User).order_by(User.name)
    if department:
        stmt = stmt.where(User.department.ilike(department))
    if role:
        stmt = stmt.where(User.role == role)
    return [UserOut.model_validate(u) for u in db.scalars(stmt)]


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: DbSession, _: CurrentUser):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found")
    return UserOut.model_validate(user)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user_as_supervisor(data: UserCreate, db: DbSession, _: Supervisor):
    """Supervisors add staff: name, work email (used to sign in), a temporary password, role,
    department and usual shift."""
    return UserOut.model_validate(create_user(db, data, role=data.role.value))
