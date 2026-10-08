"""Demo data so the app is usable immediately.

Runs automatically on startup when the database is empty. To reset manually:
    python -m app.seed --reset

Every account logs in with the fixed OTP (123456 by default).
"""

import sys
from datetime import timedelta

from sqlalchemy.orm import Session

from app.models import (
    Contact,
    Conversation,
    ConversationMember,
    Message,
    MessageReceipt,
    User,
    utcnow,
)

USERS = [
    # (phone, username, display name, about, avatar colour)
    ("+15550000001", "alice", "Alice Johnson", "Coffee first ☕", "A110"),
    ("+15550000002", "bob", "Bob Smith", "Available", "A130"),
    ("+15550000003", "carol", "Carol White", "On a hike 🏔️", "A150"),
    ("+15550000004", "david", "David Lee", "Busy", "A170"),
    ("+15550000005", "emma", "Emma Davis", "Product @ Acme", "A120"),
    ("+15550000006", "frank", "Frank Miller", "", "A180"),
    ("+15550000007", "grace", "Grace Kim", "Speak friend and enter", "A140"),
    ("+15550000008", "henry", "Henry Brown", "Hey there! I am using Signal.", "A200"),
]

# Each message: (sender username, text, minutes ago, state for the recipients)
# state: "read" | "delivered" | "sent" (not yet delivered)
DIRECT_CHATS = {
    ("alice", "bob"): [
        ("alice", "Hey Bob! Are we still on for tomorrow?", 180, "read"),
        ("bob", "Yes! 10am at the usual place?", 175, "read"),
        ("alice", "Perfect 👍", 174, "read"),
        ("bob", "I'll bring the slides for the demo", 60, "read"),
        ("alice", "Great, thanks", 58, "read"),
        ("bob", "Also, did you see the new Signal update?", 6, "delivered"),
        ("bob", "The new chat folders look really nice", 5, "delivered"),
    ],
    ("alice", "carol"): [
        ("carol", "Made it to the summit! 🏔️", 60 * 26, "read"),
        ("alice", "Wow, congrats!! Send pics", 60 * 26 - 3, "read"),
        ("carol", "Will do once I have signal 😅", 60 * 25, "read"),
        ("alice", "Haha, the irony", 60 * 25 - 1, "read"),
    ],
    ("alice", "david"): [
        ("david", "Can you review my PR when you get a chance?", 60 * 5, "read"),
        ("alice", "Sure, looking at it now", 60 * 4, "read"),
        ("alice", "Left a few comments, mostly small things", 60 * 3, "delivered"),
    ],
    ("alice", "emma"): [
        ("emma", "Thanks for the help with the launch last week!", 60 * 24 * 4, "read"),
        ("alice", "Anytime! It went really well", 60 * 24 * 4 - 10, "read"),
    ],
    ("bob", "carol"): [
        ("bob", "Carol, do you have the cabin address?", 60 * 30, "read"),
        ("carol", "Sending it in the group chat", 60 * 29, "read"),
    ],
}

GROUPS = [
    {
        "name": "Weekend Trip ⛰️",
        "admin": "alice",
        "members": ["bob", "carol", "david"],
        "created_minutes_ago": 60 * 24 * 3,
        "messages": [
            ("alice", "Okay team, cabin is booked for Saturday!", 60 * 24 * 2, "read"),
            ("carol", "Yesss 🎉", 60 * 24 * 2 - 2, "read"),
            ("david", "What should I bring?", 60 * 24 * 2 - 5, "read"),
            ("bob", "Snacks. Lots of snacks.", 60 * 24 * 2 - 6, "read"),
            ("alice", "And warm clothes, it gets cold at night", 60 * 20, "read"),
            ("carol", "Address: 42 Pine Ridge Rd", 60 * 2, "delivered"),
            ("david", "Leaving at 8am sharp 🚗", 30, "delivered"),
        ],
    },
    {
        "name": "Project Team",
        "admin": "emma",
        "members": ["alice", "frank", "grace"],
        "created_minutes_ago": 60 * 24 * 7,
        "messages": [
            ("emma", "Welcome to the project channel!", 60 * 24 * 7 - 1, "read"),
            ("frank", "Standup moved to 11 today", 60 * 24, "read"),
            ("grace", "Design mocks are ready for review", 45, "delivered"),
            ("emma", "Nice, let's go through them after lunch", 40, "delivered"),
            ("frank", "Sounds good", 12, "delivered"),
        ],
    },
]


def seed(db: Session) -> None:
    now = utcnow()
    users = {}
    for phone, username, name, about, color in USERS:
        user = User(
            phone_number=phone,
            username=username,
            display_name=name,
            about=about,
            avatar_color=color,
            last_seen_at=now - timedelta(minutes=len(users) * 17 + 3),
            created_at=now - timedelta(days=30),
        )
        db.add(user)
        users[username] = user
    db.flush()

    # Everyone knows everyone, except Alice hasn't saved Henry yet (try adding him: "henry").
    for owner in users.values():
        for other in users.values():
            if owner is not other and not (owner.username == "alice" and other.username == "henry"):
                db.add(Contact(owner_id=owner.id, contact_user_id=other.id))

    for (a, b), messages in DIRECT_CHATS.items():
        first, second = users[a], users[b]
        created = now - timedelta(minutes=messages[0][2] + 1)
        conversation = Conversation(
            type="direct",
            direct_key=f"{min(first.id, second.id)}:{max(first.id, second.id)}",
            created_by=first.id,
            created_at=created,
            members=[
                ConversationMember(user_id=first.id, joined_at=created),
                ConversationMember(user_id=second.id, joined_at=created),
            ],
        )
        db.add(conversation)
        db.flush()
        _add_messages(db, conversation, users, messages, now)

    for group in GROUPS:
        created = now - timedelta(minutes=group["created_minutes_ago"])
        admin = users[group["admin"]]
        conversation = Conversation(
            type="group",
            name=group["name"],
            created_by=admin.id,
            created_at=created,
            members=[ConversationMember(user_id=admin.id, role="admin", joined_at=created)]
            + [
                ConversationMember(user_id=users[u].id, joined_at=created) for u in group["members"]
            ],
        )
        db.add(conversation)
        db.flush()
        db.add(
            Message(
                conversation_id=conversation.id,
                type="system",
                body=f"{admin.display_name} created the group",
                created_at=created,
            )
        )
        _add_messages(db, conversation, users, group["messages"], now)

    db.commit()


def _add_messages(db, conversation, users, messages, now) -> None:
    member_ids = [m.user_id for m in conversation.members]
    for index, (sender_name, text, minutes_ago, state) in enumerate(messages):
        sender = users[sender_name]
        sent_at = now - timedelta(minutes=minutes_ago)
        receipts = [
            MessageReceipt(
                user_id=uid,
                delivered_at=sent_at if state in ("delivered", "read") else None,
                read_at=sent_at if state == "read" else None,
            )
            for uid in member_ids
            if uid != sender.id
        ]
        db.add(
            Message(
                conversation_id=conversation.id,
                sender_id=sender.id,
                type="text",
                body=text,
                client_message_id=f"seed-{conversation.id}-{index}",
                created_at=sent_at,
                receipts=receipts,
            )
        )


if __name__ == "__main__":
    from app.db import Base, SessionLocal, engine

    if "--reset" in sys.argv:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        seed(session)
    print("Seeded demo data. Log in as +15550000001 (or 'alice') with OTP 123456.")
