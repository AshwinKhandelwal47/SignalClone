from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import Unauthorized
from app.db import get_db
from app.models import AuthSession, User
from app.services import auth as auth_service

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthSession:
    session = auth_service.get_session(db, credentials.credentials if credentials else "")
    if session is None:
        raise Unauthorized("Your session has expired. Please log in again.")
    return session


def get_current_user(session: AuthSession = Depends(get_current_session)) -> User:
    return session.user
