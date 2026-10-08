from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Tracks open WebSockets per user (a user may have several tabs open).

    In-memory, so it only works with a single server process. Scaling out would need a
    shared pub/sub (e.g. Redis), which is out of scope for this project.
    """

    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

    def connect(self, user_id: int, websocket: WebSocket) -> bool:
        """Registers a socket. Returns True if this is the user's first open connection."""
        is_first = not self._connections[user_id]
        self._connections[user_id].add(websocket)
        return is_first

    def disconnect(self, user_id: int, websocket: WebSocket) -> bool:
        """Unregisters a socket. Returns True if the user has no connections left."""
        sockets = self._connections.get(user_id)
        if sockets is None:
            return True
        sockets.discard(websocket)
        if not sockets:
            del self._connections[user_id]
            return True
        return False

    def is_online(self, user_id: int) -> bool:
        return bool(self._connections.get(user_id))

    async def send_to_user(self, user_id: int, event: dict[str, Any]) -> None:
        for websocket in list(self._connections.get(user_id, ())):
            try:
                await websocket.send_json(event)
            except Exception:
                # A broken socket is cleaned up by its own receive loop.
                pass

    async def send_to_users(self, user_ids: Iterable[int], event: dict[str, Any]) -> None:
        for user_id in set(user_ids):
            await self.send_to_user(user_id, event)


manager = ConnectionManager()
