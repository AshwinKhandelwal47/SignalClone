import pytest
from starlette.websockets import WebSocketDisconnect


def _receive_until(ws, event_type):
    while True:
        event = ws.receive_json()
        if event["type"] == event_type:
            return event["data"]


def test_invalid_token_is_rejected(client):
    with client.websocket_connect("/ws?token=bogus") as ws:
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == 4401


def test_message_delivery_read_and_typing(client, register):
    _, alice, alice_token = register("alice", "Alice")
    bob_user, bob, bob_token = register("bob", "Bob")
    conversation_id = client.post(
        "/api/v1/conversations", json={"type": "direct", "user_id": bob_user["id"]}, headers=alice
    ).json()["id"]

    with (
        client.websocket_connect(f"/ws?token={alice_token}") as alice_ws,
        client.websocket_connect(f"/ws?token={bob_token}") as bob_ws,
    ):
        sent = client.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            json={"client_message_id": "c1", "body": "hey"},
            headers=alice,
        ).json()
        # Bob is online, so the message is delivered immediately.
        assert sent["status"] == "delivered"
        assert _receive_until(bob_ws, "message.new")["body"] == "hey"

        client.post(f"/api/v1/conversations/{conversation_id}/read", json={}, headers=bob)
        update = _receive_until(alice_ws, "message.status")["updates"][0]
        assert update == {
            "message_id": sent["id"],
            "conversation_id": conversation_id,
            "status": "read",
        }

        bob_ws.send_json(
            {"type": "typing", "data": {"conversation_id": conversation_id, "is_typing": True}}
        )
        typing = _receive_until(alice_ws, "typing")
        assert typing == {
            "conversation_id": conversation_id,
            "user_id": bob_user["id"],
            "is_typing": True,
        }


def test_offline_messages_delivered_on_connect(client, register):
    _, alice, alice_token = register("alice", "Alice")
    bob_user, _, bob_token = register("bob", "Bob")
    conversation_id = client.post(
        "/api/v1/conversations", json={"type": "direct", "user_id": bob_user["id"]}, headers=alice
    ).json()["id"]

    with client.websocket_connect(f"/ws?token={alice_token}") as alice_ws:
        sent = client.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            json={"client_message_id": "c1", "body": "you there?"},
            headers=alice,
        ).json()
        assert sent["status"] == "sent"

        with client.websocket_connect(f"/ws?token={bob_token}"):
            update = _receive_until(alice_ws, "message.status")["updates"][0]
            assert update["status"] == "delivered"
