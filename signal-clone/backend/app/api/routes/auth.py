from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_session, get_current_user
from app.core.config import get_settings
from app.db import get_db
from app.models import AuthSession, User
from app.schemas import AuthOut, OtpRequest, OtpRequestOut, OtpVerify, UserPublic
from app.services import auth as auth_service
from app.services.users import to_public

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/request-otp")
def request_otp(payload: OtpRequest, db: Session = Depends(get_db)) -> OtpRequestOut:
    """Mocked: no SMS is sent. The code is always the configured MOCK_OTP."""
    _, identifier = auth_service.normalize_identifier(payload.identifier)
    settings = get_settings()
    return OtpRequestOut(
        identifier=identifier,
        is_registered=auth_service.find_user(db, identifier) is not None,
        otp_hint=settings.mock_otp if settings.demo_mode else None,
    )


@router.post("/verify-otp")
def verify_otp(payload: OtpVerify, db: Session = Depends(get_db)) -> AuthOut:
    token, user, is_new_user = auth_service.verify_otp(db, payload.identifier, payload.otp)
    return AuthOut(token=token, user=to_public(user), is_new_user=is_new_user)


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> UserPublic:
    return to_public(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    session: AuthSession = Depends(get_current_session), db: Session = Depends(get_db)
) -> None:
    auth_service.logout(db, session)
