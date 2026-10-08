"""Conversation and group endpoints.

Routes that notify other users are `async` so they can push WebSocket events after the
database commit. Database work itself stays synchronous (SQLite calls are fast).
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models import User
from app.realtime import events
from app.schemas import (
    ConversationCreate,
    ConversationOut,
    ConversationUpdate,
    MarkRead,
    MembersAdd,
)
from app.services import conversations as conversation_service
from app.services import messages as message_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
def list_conversations(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ConversationOut]:
    return conversation_service.list_conversations(db, user)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreate,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationOut:
    if payload.type == "direct":
        # Idempotent: returns the existing chat with that user if there is one.
        conversation = conversation_service.get_or_create_direct(db, user, payload.user_id)
        response.status_code = status.HTTP_200_OK
    else:
        conversation = conversation_service.create_group(db, user, payload.name, payload.member_ids)
        await events.conversation_updated(
            conversation.id, conversation_service.active_member_ids(conversation)
        )
    return conversation_service.get_conversation_out(db, conversation.id, user)


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ConversationOut:
    return conversation_service.get_conversation_out(db, conversation_id, user)


@router.patch("/{conversation_id}")
async def rename_group(
    conversation_id: int,
    payload: ConversationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationOut:
    membership = conversation_service.get_membership(db, conversation_id, user.id)
    message = conversation_service.rename_group(db, membership, payload.name)
    await _broadcast_group_change(membership.conversation, message)
    return conversation_service.get_conversation_out(db, conversation_id, user)


@router.post("/{conversation_id}/members")
async def add_members(
    conversation_id: int,
    payload: MembersAdd,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationOut:
    membership = conversation_service.get_membership(db, conversation_id, user.id)
    message = conversation_service.add_members(db, membership, payload.user_ids)
    if message is not None:
        await _broadcast_group_change(membership.conversation, message)
    return conversation_service.get_conversation_out(db, conversation_id, user)


@router.delete("/{conversation_id}/members/{user_id}")
async def remove_member(
    conversation_id: int,
    user_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationOut:
    membership = conversation_service.get_membership(db, conversation_id, user.id)
    message = conversation_service.remove_member(db, membership, user_id)
    await _broadcast_group_change(membership.conversation, message, also_notify=[user_id])
    return conversation_service.get_conversation_out(db, conversation_id, user)


@router.post("/{conversation_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group(
    conversation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    membership = conversation_service.get_membership(db, conversation_id, user.id)
    message = conversation_service.leave_group(db, membership)
    await _broadcast_group_change(membership.conversation, message, also_notify=[user.id])


@router.post("/{conversation_id}/read")
async def mark_read(
    conversation_id: int,
    payload: MarkRead,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    membership = conversation_service.get_membership(db, conversation_id, user.id)
    updated = message_service.mark_read(db, membership, payload.up_to_message_id)
    if updated:
        await events.message_statuses(updated)
        await events.conversation_read(conversation_id, user.id)
    return {"unread_count": message_service.unread_counts(db, user.id).get(conversation_id, 0)}


async def _broadcast_group_change(
    conversation, message, also_notify: list[int] | None = None
) -> None:
    """Pushes the system message and asks every affected client to refetch the group."""
    recipients = set(conversation_service.active_member_ids(conversation)) | set(also_notify or [])
    await events.message_new(message, recipients)
    await events.conversation_updated(conversation.id, recipients)
