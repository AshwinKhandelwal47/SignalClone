from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models import User
from app.realtime import events
from app.realtime.manager import manager
from app.schemas import MessageCreate, MessageOut, MessagePage
from app.services import conversations as conversation_service
from app.services import messages as message_service

router = APIRouter(prefix="/conversations/{conversation_id}/messages", tags=["messages"])


@router.get("")
def list_messages(
    conversation_id: int,
    before_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessagePage:
    membership = conversation_service.get_membership(db, conversation_id, user.id)
    items, has_more = message_service.list_messages(db, membership, before_id, limit)
    return MessagePage(items=[message_service.to_out(m) for m in items], has_more=has_more)


@router.post("", status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: int,
    payload: MessageCreate,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    membership = conversation_service.get_membership(db, conversation_id, user.id)
    conversation_service.require_active(membership)
    conversation = membership.conversation

    message, created = message_service.send_message(
        db, conversation, user, payload.body, payload.client_message_id
    )
    if not created:  # retry of a message we already stored
        response.status_code = status.HTTP_200_OK
        return message_service.to_out(message)

    # Recipients with an open socket receive it right now, so it counts as delivered.
    member_ids = conversation_service.active_member_ids(conversation)
    online_recipients = [uid for uid in member_ids if uid != user.id and manager.is_online(uid)]
    message_service.mark_delivered(db, message, online_recipients)

    # Sent to the sender too, so their other tabs stay in sync.
    await events.message_new(message, member_ids)
    return message_service.to_out(message)
