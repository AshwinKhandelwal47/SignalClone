"""Mocked phone/username verification and server-side sessions."""

import random
import re
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import BadRequest, Unauthorized
from app.core.security import generate_token, hash_token
from app.models import AuthSession, User, utcnow
from app.services.users import AVATAR_COLORS

PHONE_RE = re.compile(r"^\+[1-9]\d{6,14}$")
USERNAME_RE = re.compile(r"^[a-z][a-z0-9_.]{2,31}$")


def normalize_identifier(raw: str) -> tuple[str, str]:
    """Returns ("phone", "+15550000001") or ("username", "alice")."""
    value = raw.strip()
    if value[:1] == "+" or value[:1].isdigit():
        phone = re.sub(r"[\s\-().]", "", value)
        if phone.startswith("00"):
            phone = "+" + phone[2:]
        if not phone.startswith("+"):
            phone = "+" + phone
        if not PHONE_RE.match(phone):
            raise BadRequest("Enter a valid phone number with country code, e.g. +15550000001")
        return "phone", phone

    username = value.lower().lstrip("@")
    if not USERNAME_RE.match(username):
        raise BadRequest(
            "Usernames are 3-32 characters: letters, numbers, '_' or '.', starting with a letter"
        )
    return "username", username


def find_user(db: Session, identifier: str) -> User | None:
    kind, value = normalize_identifier(identifier)
    column = User.phone_number if kind == "phone" else User.username
    return db.scalar(select(User).where(column == value))


def verify_otp(db: Session, identifier: str, otp: str) -> tuple[str, User, bool]:
    """Checks the fixed OTP, creates the user on first login and opens a session.

    Returns (token, user, is_new_user). "New" means the profile isn't set up yet, so a user
    who abandoned onboarding is sent back to profile setup.
    """
    if otp != get_settings().mock_otp:
        raise Unauthorized("Incorrect code. Please try again.")

    kind, value = normalize_identifier(identifier)
    user = find_user(db, value)
    if user is None:
        user = User(avatar_color=random.choice(AVATAR_COLORS))
        if kind == "phone":
            user.phone_number = value
        else:
            user.username = value
        db.add(user)
        db.flush()

    token = generate_token()
    ttl = timedelta(days=get_settings().session_ttl_days)
    db.add(AuthSession(user_id=user.id, token_hash=hash_token(token), expires_at=utcnow() + ttl))
    db.commit()
    return token, user, not user.display_name


def get_session(db: Session, token: str) -> AuthSession | None:
    if not token:
        return None
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if session is None or session.expires_at < utcnow():
        return None
    return session


def logout(db: Session, session: AuthSession) -> None:
    db.delete(session)
    db.commit()
