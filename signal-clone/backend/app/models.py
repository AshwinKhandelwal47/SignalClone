"""SQLAlchemy models. See the "Database Design" section of ARCHITECTURE.md for the rationale."""

from datetime import UTC, datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator):
    """Stores naive UTC in SQLite and always returns timezone-aware UTC datetimes."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(UTC).replace(tzinfo=None)
        return value

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        return value.replace(tzinfo=UTC) if value is not None else None


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "phone_number IS NOT NULL OR username IS NOT NULL", name="ck_user_has_identifier"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    phone_number: Mapped[str | None] = mapped_column(String(20), unique=True)
    username: Mapped[str | None] = mapped_column(String(32), unique=True)
    # Empty until the user finishes profile setup during onboarding.
    display_name: Mapped[str] = mapped_column(String(64), default="")
    about: Mapped[str] = mapped_column(String(140), default="")
    avatar_url: Mapped[str | None] = mapped_column(String(255))
    avatar_color: Mapped[str] = mapped_column(String(8))
    last_seen_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Only a SHA-256 hash of the token is stored, never the token itself.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)

    user: Mapped[User] = relationship()


class Contact(Base):
    """A directed address-book entry: `owner` saved `contact_user` as a contact."""

    __tablename__ = "contacts"
    __table_args__ = (
        UniqueConstraint("owner_id", "contact_user_id", name="uq_contact_pair"),
        CheckConstraint("owner_id <> contact_user_id", name="ck_contact_not_self"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    contact_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    contact_user: Mapped[User] = relationship(foreign_keys=[contact_user_id])


class Conversation(Base):
    """Both 1:1 chats (`direct`) and groups live in this table."""

    __tablename__ = "conversations"
    __table_args__ = (
        CheckConstraint("type IN ('direct', 'group')", name="ck_conversation_type"),
        CheckConstraint("type = 'direct' OR name IS NOT NULL", name="ck_group_has_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(10))
    name: Mapped[str | None] = mapped_column(String(64))
    # "<smaller user id>:<larger user id>" for direct chats, so each pair has exactly one chat.
    direct_key: Mapped[str | None] = mapped_column(String(32), unique=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    members: Mapped[list["ConversationMember"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class ConversationMember(Base):
    __tablename__ = "conversation_members"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_member"),
        CheckConstraint("role IN ('admin', 'member')", name="ck_member_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(10), default="member")
    joined_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    # Soft removal: removed members keep read access to history up to this moment.
    removed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    conversation: Mapped[Conversation] = relationship(back_populates="members")
    user: Mapped[User] = relationship()

    @property
    def is_active(self) -> bool:
        return self.removed_at is None


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        # Lets clients retry a send safely: the same client id never creates a second message.
        UniqueConstraint("sender_id", "client_message_id", name="uq_message_client_id"),
        CheckConstraint("type IN ('text', 'system')", name="ck_message_type"),
        Index("ix_messages_conversation_id_id", "conversation_id", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    # NULL for system messages ("Alice added Bob").
    sender_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    type: Mapped[str] = mapped_column(String(10), default="text")
    body: Mapped[str] = mapped_column(Text)
    client_message_id: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    sender: Mapped[User | None] = relationship()
    receipts: Mapped[list["MessageReceipt"]] = relationship(cascade="all, delete-orphan")


class MessageReceipt(Base):
    """Delivery/read state of one message for one recipient (needed for group receipts)."""

    __tablename__ = "message_receipts"
    __table_args__ = (Index("ix_receipts_user_read", "user_id", "read_at"),)

    message_id: Mapped[int] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    read_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
