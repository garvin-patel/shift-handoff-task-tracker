from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import User

password_hasher = PasswordHash.recommended()
# Used for unknown users too, so failed login still performs password verification.
dummy_hash = password_hasher.hash("this-is-not-a-user-password")
bearer = HTTPBearer(auto_error=False)
ISSUER = "gsa-api"
AUDIENCE = "gsa-client"


def create_access_token(user_id: UUID) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(user_id), "iat": now,
         "exp": now + timedelta(minutes=settings.access_token_minutes),
         "iss": ISSUER, "aud": AUDIENCE},
        settings.jwt_secret.get_secret_value(), algorithm="HS256",
    )


def unauthorized() -> HTTPException:
    return HTTPException(401, "Invalid or missing authentication",
                         headers={"WWW-Authenticate": "Bearer"})


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise unauthorized()
    try:
        payload = jwt.decode(
            credentials.credentials, get_settings().jwt_secret.get_secret_value(),
            algorithms=["HS256"], issuer=ISSUER, audience=AUDIENCE,
            options={"require": ["sub", "iat", "exp", "iss", "aud"]},
        )
        user_id = UUID(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise unauthorized() from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized()
    return user


def supervisor_only(user: User = Depends(current_user)) -> User:
    # Read the stored role on every request, so a role change takes effect immediately.
    if user.role != "supervisor":
        raise HTTPException(403, "Supervisor role required")
    return user
