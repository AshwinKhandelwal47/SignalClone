"""Server → client WebSocket events. Every event is {"type": str, "data": dict}."""

from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from sqlalchemy.orm import Session

from app.models import Message, User
from app.realtime.manager import manager
from app.services import messages as message_service
from app.services.users import related_user_ids


def _event(type_: str, data: dict[str, Any]) -> dict[str, Any]:
    return {"type": type_, "data": data}


async def message_new(message: Message, user_ids: Iterable[int]) -> None:
    payload = message_service.to_out(message).model_dump(mode="json")
    await manager.send_to_users(user_ids, _event("message.new", payload))


async def message_statuses(messages: Iterable[Message]) -> None:
    """Tells each sender the new aggregate status of their messages (batched per sender)."""
    updates: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for message in messages:
        if message.sender_id is not None:
            updates[message.sender_id].append(
                {
                    "message_id": message.id,
                    "conversation_id": message.conversation_id,
                    "status": message_service.compute_status(message),
                }
            )
    for sender_id, items in updates.items():
        await manager.send_to_user(sender_id, _event("message.status", {"updates": items}))


async def conversation_updated(conversation_id: int, user_ids: Iterable[int]) -> None:
    """Clients refetch the conversation (its shape depends on who is asking)."""
    await manager.send_to_users(
        user_ids, _event("conversation.updated", {"conversation_id": conversation_id})
    )


async def conversation_read(conversation_id: int, user_id: int) -> None:
    """Syncs the unread badge across the reader's other tabs."""
    await manager.send_to_user(
        user_id, _event("conversation.read", {"conversation_id": conversation_id})
    )


async def typing(
    conversation_id: int, user_id: int, is_typing: bool, user_ids: Iterable[int]
) -> None:
    data = {"conversation_id": conversation_id, "user_id": user_id, "is_typing": is_typing}
    await manager.send_to_users(user_ids, _event("typing", data))


async def presence(db: Session, user: User) -> None:
    data = {
        "user_id": user.id,
        "is_online": manager.is_online(user.id),
        "last_seen_at": user.last_seen_at.isoformat() if user.last_seen_at else None,
    }
    await manager.send_to_users(related_user_ids(db, user.id), _event("presence", data))
