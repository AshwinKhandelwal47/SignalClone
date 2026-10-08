from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BadRequest, Forbidden, NotFound
from app.models import Conversation, ConversationMember, Message, User, utcnow
from app.schemas import ConversationOut, MemberOut
from app.services import messages as message_service
from app.services.users import to_public

# ---------- Membership & permissions ----------


def get_membership(db: Session, conversation_id: int, user_id: int) -> ConversationMember:
    """Raises 404 (not 403) for non-members so conversation ids don't leak."""
    membership = db.scalar(
        select(ConversationMember)
        .where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
        .options(
            selectinload(ConversationMember.conversation)
            .selectinload(Conversation.members)
            .selectinload(ConversationMember.user)
        )
    )
    if membership is None:
        raise NotFound("Conversation not found")
    return membership


def require_active(membership: ConversationMember) -> None:
    if not membership.is_active:
        raise Forbidden("You are no longer a member of this group")


def require_group_admin(membership: ConversationMember) -> None:
    require_active(membership)
    if membership.conversation.type != "group":
        raise BadRequest("Only groups have admins")
    if membership.role != "admin":
        raise Forbidden("Only group admins can do that")


def active_member_ids(conversation: Conversation) -> list[int]:
    return [m.user_id for m in conversation.members if m.is_active]


# ---------- Serialization ----------


def to_out(
    membership: ConversationMember, last_message: Message | None, unread_count: int
) -> ConversationOut:
    conversation = membership.conversation
    active = [m for m in conversation.members if m.is_active]
    active.sort(key=lambda m: (m.role != "admin", m.user.display_name.lower()))
    return ConversationOut(
        id=conversation.id,
        type=conversation.type,
        name=conversation.name,
        created_by=conversation.created_by,
        created_at=conversation.created_at,
        members=[MemberOut(user=to_public(m.user), role=m.role) for m in active],
        last_message=message_service.to_out(last_message) if last_message else None,
        unread_count=unread_count,
        is_active_member=membership.is_active,
        my_role=membership.role,
    )


def get_conversation_out(db: Session, conversation_id: int, user: User) -> ConversationOut:
    membership = get_membership(db, conversation_id, user.id)
    last = message_service.latest_messages(db, [membership]).get(conversation_id)
    unread = message_service.unread_counts(db, user.id).get(conversation_id, 0)
    return to_out(membership, last, unread)


def list_conversations(db: Session, user: User) -> list[ConversationOut]:
    """The chat list, most recent activity first."""
    memberships = list(
        db.scalars(
            select(ConversationMember)
            .where(ConversationMember.user_id == user.id)
            .options(
                selectinload(ConversationMember.conversation)
                .selectinload(Conversation.members)
                .selectinload(ConversationMember.user)
            )
        )
    )
    latest = message_service.latest_messages(db, memberships)
    unread = message_service.unread_counts(db, user.id)

    result = []
    for membership in memberships:
        conversation = membership.conversation
        last = latest.get(conversation.id)
        # An empty 1:1 chat only shows up for the person who opened it.
        if conversation.type == "direct" and last is None and conversation.created_by != user.id:
            continue
        result.append(to_out(membership, last, unread.get(conversation.id, 0)))

    result.sort(
        key=lambda c: c.last_message.created_at if c.last_message else c.created_at, reverse=True
    )
    return result


# ---------- Creation ----------


def get_or_create_direct(db: Session, me: User, other_user_id: int) -> Conversation:
    if other_user_id == me.id:
        raise BadRequest("You can't start a chat with yourself")
    other = db.get(User, other_user_id)
    if other is None or not other.display_name:
        raise NotFound("User not found")

    key = f"{min(me.id, other.id)}:{max(me.id, other.id)}"
    existing = db.scalar(select(Conversation).where(Conversation.direct_key == key))
    if existing is not None:
        return existing

    conversation = Conversation(
        type="direct",
        direct_key=key,
        created_by=me.id,
        members=[ConversationMember(user_id=me.id), ConversationMember(user_id=other.id)],
    )
    db.add(conversation)
    try:
        db.commit()
    except IntegrityError:
        # Another request created the same chat concurrently; the unique key protects us.
        db.rollback()
        return db.scalar(select(Conversation).where(Conversation.direct_key == key))
    return conversation


def create_group(db: Session, me: User, name: str, member_ids: list[int]) -> Conversation:
    ids = {uid for uid in member_ids if uid != me.id}
    if not ids:
        raise BadRequest("Add at least one other member")
    users = _get_users(db, ids)

    conversation = Conversation(
        type="group",
        name=name,
        created_by=me.id,
        members=[ConversationMember(user_id=me.id, role="admin")]
        + [ConversationMember(user_id=u.id) for u in users],
    )
    db.add(conversation)
    db.flush()
    message_service.add_system_message(db, conversation, f"{me.display_name} created the group")
    db.commit()
    return conversation


# ---------- Group management (each returns the system message it created) ----------


def rename_group(db: Session, membership: ConversationMember, name: str) -> Message:
    require_group_admin(membership)
    conversation = membership.conversation
    conversation.name = name
    actor = membership.user.display_name
    message = message_service.add_system_message(
        db, conversation, f"{actor} changed the group name to “{name}”"
    )
    db.commit()
    return message


def add_members(db: Session, membership: ConversationMember, user_ids: list[int]) -> Message | None:
    require_group_admin(membership)
    conversation = membership.conversation
    users = _get_users(db, set(user_ids))
    existing = {m.user_id: m for m in conversation.members}
    now = utcnow()

    added: list[User] = []
    for user in users:
        member = existing.get(user.id)
        if member is not None and member.is_active:
            continue
        if member is not None:  # previously removed: re-activate
            member.removed_at = None
            member.role = "member"
            member.joined_at = now
        else:
            conversation.members.append(
                ConversationMember(user_id=user.id, user=user, joined_at=now)
            )
        added.append(user)

    if not added:
        return None
    names = ", ".join(u.display_name for u in added)
    message = message_service.add_system_message(
        db, conversation, f"{membership.user.display_name} added {names}", at=now
    )
    db.commit()
    return message


def remove_member(db: Session, membership: ConversationMember, user_id: int) -> Message:
    require_group_admin(membership)
    if user_id == membership.user_id:
        raise BadRequest("Use “Leave group” to leave the group")
    conversation = membership.conversation
    target = next((m for m in conversation.members if m.user_id == user_id and m.is_active), None)
    if target is None:
        raise NotFound("Member not found")

    now = utcnow()
    target.removed_at = now
    message = message_service.add_system_message(
        db,
        conversation,
        f"{membership.user.display_name} removed {target.user.display_name}",
        at=now,  # same timestamp as removal, so the removed member still sees it
    )
    db.commit()
    return message


def leave_group(db: Session, membership: ConversationMember) -> Message:
    require_active(membership)
    conversation = membership.conversation
    if conversation.type != "group":
        raise BadRequest("You can only leave groups")

    now = utcnow()
    membership.removed_at = now
    if membership.role == "admin":
        membership.role = "member"
        remaining = [m for m in conversation.members if m.is_active]
        # A group always keeps an admin: promote the longest-standing member.
        if remaining and not any(m.role == "admin" for m in remaining):
            min(remaining, key=lambda m: m.joined_at).role = "admin"

    message = message_service.add_system_message(
        db, conversation, f"{membership.user.display_name} left the group", at=now
    )
    db.commit()
    return message


def _get_users(db: Session, ids: set[int]) -> list[User]:
    users = list(db.scalars(select(User).where(User.id.in_(ids))))
    if len(users) != len(ids) or any(not u.display_name for u in users):
        raise NotFound("One or more users were not found")
    return users
