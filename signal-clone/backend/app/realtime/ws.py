"""The single WebSocket endpoint: authenticates, tracks presence and relays typing events.

Persistent actions (sending, marking read) go through REST; the socket is for push and for
ephemeral signals only.
"""

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.errors import AppError
from app.db import SessionLocal
from app.models import User, utcnow
from app.realtime import events
from app.realtime.manager import manager
from app.services import auth as auth_service
from app.services import conversations as conversation_service
from app.services import messages as message_service

router = APIRouter()

UNAUTHORIZED_CLOSE_CODE = 4401


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = "") -> None:
    await websocket.accept()
    with SessionLocal() as db:
        session = auth_service.get_session(db, token)
        if session is None:
            await websocket.close(code=UNAUTHORIZED_CLOSE_CODE)
            return
        user_id = session.user_id
        is_first_connection = manager.connect(user_id, websocket)
        # Anything sent while this user was offline counts as delivered now.
        await events.message_statuses(message_service.mark_pending_delivered(db, user_id))
        if is_first_connection:
            await events.presence(db, session.user)

    try:
        while True:
            try:
                event = json.loads(await websocket.receive_text())
            except ValueError:
                continue  # ignore malformed frames
            await _handle_client_event(user_id, event)
    except WebSocketDisconnect:
        pass
    finally:
        if manager.disconnect(user_id, websocket):
            with SessionLocal() as db:
                user = db.get(User, user_id)
                if user is not None:
                    user.last_seen_at = utcnow()
                    db.commit()
                    await events.presence(db, user)


async def _handle_client_event(user_id: int, event: object) -> None:
    if not isinstance(event, dict):
        return
    event_type = event.get("type")
    data = event.get("data") or {}

    if event_type == "ping":
        await manager.send_to_user(user_id, {"type": "pong", "data": {}})
    elif event_type == "typing":
        conversation_id = data.get("conversation_id")
        if not isinstance(conversation_id, int):
            return
        with SessionLocal() as db:
            try:
                membership = conversation_service.get_membership(db, conversation_id, user_id)
                conversation_service.require_active(membership)
            except AppError:
                return
            others = [
                uid
                for uid in conversation_service.active_member_ids(membership.conversation)
                if uid != user_id
            ]
        await events.typing(conversation_id, user_id, bool(data.get("is_typing")), others)
