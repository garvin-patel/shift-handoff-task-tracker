from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import DbSession
from app.models import User
from app.schemas import LoginRequest, Token, UserCreate, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def create_user(db: Session, data: UserCreate, role: str) -> User:
    email = data.email.lower()
    if db.scalar(select(User.id).where(func.lower(User.email) == email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
    user = User(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password),
        role=role,
        department=data.department,
        usual_shift=data.usual_shift.value if data.usual_shift else None,
    )
    db.add(user)
    db.commit()
    return user


def _authenticate(db: Session, email: str, password: str) -> Token:
    user = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Token(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


# There is no self-registration: supervisors create accounts with POST /users.


@router.post("/login", response_model=Token)
def login(data: LoginRequest, db: DbSession):
    """JSON login for the frontend."""
    return _authenticate(db, data.email, data.password)


@router.post("/token", response_model=Token)
def token(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession):
    """Form login (OAuth2 password flow) used by the Swagger "Authorize" button. Username = email."""
    return _authenticate(db, form.username, form.password)
