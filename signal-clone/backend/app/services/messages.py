from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import Conflict
from app.models import Conversation, ConversationMember, Message, MessageReceipt, User, utcnow
from app.schemas import MessageOut, MessageStatus


def compute_status(message: Message) -> MessageStatus:
    """Aggregate status for the sender: delivered/read only once *every* recipient is."""
    receipts = message.receipts
    if receipts and all(r.read_at for r in receipts):
        return "read"
    if receipts and all(r.delivered_at for r in receipts):
        return "delivered"
    return "sent"


def to_out(message: Message) -> MessageOut:
    return MessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_name=message.sender.display_name if message.sender else None,
        type=message.type,
        body=message.body,
        client_message_id=message.client_message_id,
        created_at=message.created_at,
        status=compute_status(message) if message.type == "text" else None,
    )


def visible_messages(membership: ConversationMember) -> Select[tuple[Message]]:
    """Messages a member may see: from when they joined until they were removed (if ever)."""
    stmt = (
        select(Message)
        .where(
            Message.conversation_id == membership.conversation_id,
            Message.created_at >= membership.joined_at,
        )
        .options(selectinload(Message.sender), selectinload(Message.receipts))
    )
    if membership.removed_at is not None:
        stmt = stmt.where(Message.created_at <= membership.removed_at)
    return stmt


def list_messages(
    db: Session, membership: ConversationMember, before_id: int | None, limit: int
) -> tuple[list[Message], bool]:
    """Cursor pagination, newest first. Returns (messages oldest→newest, has_more)."""
    stmt = visible_messages(membership)
    if before_id is not None:
        stmt = stmt.where(Message.id < before_id)
    rows = list(db.scalars(stmt.order_by(Message.id.desc()).limit(limit + 1)))
    has_more = len(rows) > limit
    return list(reversed(rows[:limit])), has_more


def latest_messages(db: Session, memberships: list[ConversationMember]) -> dict[int, Message]:
    """Last visible message per conversation, for the chat list previews."""
    result: dict[int, Message] = {}
    active_ids = [m.conversation_id for m in memberships if m.is_active]
    if active_ids:
        latest_ids = (
            select(func.max(Message.id))
            .where(Message.conversation_id.in_(active_ids))
            .group_by(Message.conversation_id)
        )
        stmt = (
            select(Message)
            .where(Message.id.in_(latest_ids))
            .options(selectinload(Message.sender), selectinload(Message.receipts))
        )
        for message in db.scalars(stmt):
            result[message.conversation_id] = message

    # Removed members only see history up to their removal, so look those up individually.
    for membership in memberships:
        if not membership.is_active:
            stmt = visible_messages(membership).order_by(Message.id.desc()).limit(1)
            message = db.scalar(stmt)
            if message is not None:
                result[membership.conversation_id] = message
    return result


def unread_counts(db: Session, user_id: int) -> dict[int, int]:
    stmt = (
        select(Message.conversation_id, func.count())
        .join(MessageReceipt, MessageReceipt.message_id == Message.id)
        .where(MessageReceipt.user_id == user_id, MessageReceipt.read_at.is_(None))
        .group_by(Message.conversation_id)
    )
    return {conversation_id: count for conversation_id, count in db.execute(stmt)}


def send_message(
    db: Session, conversation: Conversation, sender: User, body: str, client_message_id: str
) -> tuple[Message, bool]:
    """Persists a text message with a pending receipt per recipient.

    Idempotent on (sender, client_message_id): a retry returns the original message.
    Returns (message, created).
    """
    existing = db.scalar(
        select(Message)
        .where(Message.sender_id == sender.id, Message.client_message_id == client_message_id)
        .options(selectinload(Message.receipts))
    )
    if existing is not None:
        if existing.conversation_id != conversation.id:
            raise Conflict("client_message_id was already used in another conversation")
        return existing, False

    recipient_ids = [
        m.user_id for m in conversation.members if m.is_active and m.user_id != sender.id
    ]
    message = Message(
        conversation_id=conversation.id,
        sender_id=sender.id,
        sender=sender,
        type="text",
        body=body,
        client_message_id=client_message_id,
        receipts=[MessageReceipt(user_id=uid) for uid in recipient_ids],
    )
    db.add(message)
    db.commit()
    return message, True


def add_system_message(db: Session, conversation: Conversation, text: str, at=None) -> Message:
    message = Message(
        conversation_id=conversation.id, type="system", body=text, created_at=at or utcnow()
    )
    db.add(message)
    return message


def mark_delivered(db: Session, message: Message, user_ids: list[int]) -> bool:
    """Marks the message delivered for the given recipients. Returns True if anything changed."""
    now = utcnow()
    changed = False
    for receipt in message.receipts:
        if receipt.user_id in user_ids and receipt.delivered_at is None:
            receipt.delivered_at = now
            changed = True
    if changed:
        db.commit()
    return changed


def mark_pending_delivered(db: Session, user_id: int) -> list[Message]:
    """Called when a user connects: everything sent to them while offline is now delivered."""
    receipts = list(
        db.scalars(
            select(MessageReceipt).where(
                MessageReceipt.user_id == user_id, MessageReceipt.delivered_at.is_(None)
            )
        )
    )
    return _touch_receipts(db, receipts, read=False)


def mark_read(
    db: Session, membership: ConversationMember, up_to_message_id: int | None
) -> list[Message]:
    stmt = (
        select(MessageReceipt)
        .join(Message, MessageReceipt.message_id == Message.id)
        .where(
            MessageReceipt.user_id == membership.user_id,
            MessageReceipt.read_at.is_(None),
            Message.conversation_id == membership.conversation_id,
        )
    )
    if up_to_message_id is not None:
        stmt = stmt.where(Message.id <= up_to_message_id)
    return _touch_receipts(db, list(db.scalars(stmt)), read=True)


def _touch_receipts(db: Session, receipts: list[MessageReceipt], read: bool) -> list[Message]:
    """Sets delivered (and optionally read) timestamps. Returns the affected messages."""
    if not receipts:
        return []
    now = utcnow()
    for receipt in receipts:
        receipt.delivered_at = receipt.delivered_at or now
        if read:
            receipt.read_at = now
    db.commit()
    message_ids = {r.message_id for r in receipts}
    return list(
        db.scalars(
            select(Message)
            .where(Message.id.in_(message_ids))
            .options(selectinload(Message.receipts))
        )
    )
