import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import BadRequest
from app.models import Contact, ConversationMember, User
from app.realtime.manager import manager
from app.schemas import ProfileUpdate, UserPublic

# Signal's avatar colour palette (keys match the frontend's AVATAR_COLORS).
AVATAR_COLORS = [f"A{n}" for n in range(100, 220, 10)]

ALLOWED_AVATAR_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_AVATAR_BYTES = 2 * 1024 * 1024


def to_public(user: User) -> UserPublic:
    return UserPublic.model_validate(user).model_copy(
        update={"is_online": manager.is_online(user.id)}
    )


def update_profile(db: Session, user: User, data: ProfileUpdate) -> User:
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.about is not None:
        user.about = data.about
    db.commit()
    return user


def save_avatar(db: Session, user: User, upload: UploadFile) -> User:
    extension = ALLOWED_AVATAR_TYPES.get(upload.content_type or "")
    if extension is None:
        raise BadRequest("Avatar must be a PNG, JPEG, WebP or GIF image")
    content = upload.file.read(MAX_AVATAR_BYTES + 1)
    if len(content) > MAX_AVATAR_BYTES:
        raise BadRequest("Avatar must be 2 MB or smaller")

    avatars_dir = Path(get_settings().media_dir) / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (avatars_dir / filename).write_bytes(content)

    _delete_avatar_file(user)
    user.avatar_url = f"/media/avatars/{filename}"
    db.commit()
    return user


def remove_avatar(db: Session, user: User) -> User:
    _delete_avatar_file(user)
    user.avatar_url = None
    db.commit()
    return user


def _delete_avatar_file(user: User) -> None:
    if user.avatar_url and user.avatar_url.startswith("/media/avatars/"):
        path = Path(get_settings().media_dir) / "avatars" / Path(user.avatar_url).name
        path.unlink(missing_ok=True)


def related_user_ids(db: Session, user_id: int) -> set[int]:
    """Users who should see this user's presence: chat partners and people who saved them."""
    my_conversations = select(ConversationMember.conversation_id).where(
        ConversationMember.user_id == user_id
    )
    co_members = select(ConversationMember.user_id).where(
        ConversationMember.conversation_id.in_(my_conversations),
        ConversationMember.user_id != user_id,
    )
    saved_me = select(Contact.owner_id).where(Contact.contact_user_id == user_id)
    return set(db.scalars(co_members.union(saved_me)))
