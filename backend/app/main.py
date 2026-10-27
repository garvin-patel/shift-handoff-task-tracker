from datetime import datetime
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import User
from .security import (create_access_token, current_user, dummy_hash,
                       password_hasher, supervisor_only, unauthorized)

app = FastAPI(title="Team GSA — Authentication Foundation", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins,
                   allow_methods=["GET", "POST"],
                   allow_headers=["Authorization", "Content-Type"])


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=1024)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: str
    display_name: str
    role: str
    created_at: datetime


@app.get("/health/live", tags=["Health"])
def live():
    return {"status": "ok"}


@app.get("/health/ready", tags=["Health"])
def ready(db: Session = Depends(get_db)):
    try:
        # Check both the connection and the table required for login.
        db.execute(text("SELECT id FROM users LIMIT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "Database unavailable or migrations missing") from None
    return {"status": "ready"}


@app.post("/api/v1/auth/login", response_model=TokenResponse, tags=["Authentication"])
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    valid = password_hasher.verify(body.password, user.password_hash if user else dummy_hash)
    if not valid or user is None or not user.is_active:
        raise unauthorized()
    response.headers["Cache-Control"] = "no-store"
    return TokenResponse(access_token=create_access_token(user.id),
                         expires_in=get_settings().access_token_minutes * 60)


@app.get("/api/v1/auth/me", response_model=UserResponse, tags=["Authentication"])
def me(user: User = Depends(current_user)):
    return user


@app.get("/api/v1/demo/supervisor", tags=["Role demonstration"])
def supervisor_demo(user: User = Depends(supervisor_only)):
    return {"message": "Supervisor permission verified", "user_id": str(user.id)}
