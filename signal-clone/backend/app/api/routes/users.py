from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.errors import NotFound
from app.db import get_db
from app.models import User
from app.schemas import ProfileUpdate, UserPublic
from app.services import auth as auth_service
from app.services import users as user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me")
def update_me(
    payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserPublic:
    return user_service.to_public(user_service.update_profile(db, user, payload))


@router.post("/me/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPublic:
    return user_service.to_public(user_service.save_avatar(db, user, file))


@router.delete("/me/avatar")
def delete_avatar(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserPublic:
    return user_service.to_public(user_service.remove_avatar(db, user))


@router.get("/lookup")
def lookup_user(
    identifier: str = Query(min_length=3, max_length=32),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPublic:
    """Finds a registered user by exact phone number or username (used to add contacts)."""
    found = auth_service.find_user(db, identifier)
    if found is None or not found.display_name:
        raise NotFound("No Signal user found with that phone number or username")
    return user_service.to_public(found)
