"""Pydantic request/response models (the API contract)."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
MessageBody = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)
]
Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=32)]

MessageStatus = Literal["sent", "delivered", "read"]


# ---------- Users ----------


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    username: str | None
    phone_number: str | None
    avatar_url: str | None
    avatar_color: str
    about: str
    last_seen_at: datetime | None
    is_online: bool = False


class ProfileUpdate(BaseModel):
    display_name: DisplayName | None = None
    about: Annotated[str, StringConstraints(strip_whitespace=True, max_length=140)] | None = None


# ---------- Auth ----------


class OtpRequest(BaseModel):
    identifier: Identifier


class OtpRequestOut(BaseModel):
    identifier: str
    is_registered: bool
    otp_hint: str | None


class OtpVerify(BaseModel):
    identifier: Identifier
    otp: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10)]


class AuthOut(BaseModel):
    token: str
    user: UserPublic
    is_new_user: bool


# ---------- Contacts ----------


class ContactCreate(BaseModel):
    identifier: Identifier


class ContactOut(BaseModel):
    id: int
    user: UserPublic
    created_at: datetime


# ---------- Messages ----------


class MessageCreate(BaseModel):
    client_message_id: Annotated[str, StringConstraints(min_length=1, max_length=64)]
    body: MessageBody


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int | None
    sender_name: str | None
    type: Literal["text", "system"]
    body: str
    client_message_id: str | None
    created_at: datetime
    # Aggregate delivery state across all recipients; only meaningful to the sender.
    status: MessageStatus | None


class MessagePage(BaseModel):
    items: list[MessageOut]
    has_more: bool


class MarkRead(BaseModel):
    up_to_message_id: int | None = None


# ---------- Conversations ----------


class MemberOut(BaseModel):
    user: UserPublic
    role: Literal["admin", "member"]


class ConversationOut(BaseModel):
    id: int
    type: Literal["direct", "group"]
    name: str | None
    created_by: int | None
    created_at: datetime
    members: list[MemberOut]
    last_message: MessageOut | None
    unread_count: int
    is_active_member: bool
    my_role: Literal["admin", "member"]


class ConversationCreate(BaseModel):
    type: Literal["direct", "group"]
    user_id: int | None = None
    name: DisplayName | None = None
    member_ids: list[int] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def check_fields(self) -> "ConversationCreate":
        if self.type == "direct" and self.user_id is None:
            raise ValueError("user_id is required for a direct conversation")
        if self.type == "group" and (not self.name or not self.member_ids):
            raise ValueError("A group needs a name and at least one member")
        return self


class ConversationUpdate(BaseModel):
    name: DisplayName


class MembersAdd(BaseModel):
    user_ids: list[int] = Field(min_length=1, max_length=100)
