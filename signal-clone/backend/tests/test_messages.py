def _direct_chat(client, headers, other_id):
    return client.post(
        "/api/v1/conversations", json={"type": "direct", "user_id": other_id}, headers=headers
    ).json()["id"]


def _send(client, headers, conversation_id, body, client_id):
    return client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"client_message_id": client_id, "body": body},
        headers=headers,
    )


def test_direct_chat_is_unique_per_pair(client, register):
    alice_user, alice, _ = register("alice", "Alice")
    bob_user, bob, _ = register("bob", "Bob")
    first = _direct_chat(client, alice, bob_user["id"])
    assert _direct_chat(client, alice, bob_user["id"]) == first
    assert _direct_chat(client, bob, alice_user["id"]) == first


def test_empty_direct_chat_hidden_from_other_side(client, register):
    alice_user, alice, _ = register("alice", "Alice")
    bob_user, bob, _ = register("bob", "Bob")
    conversation_id = _direct_chat(client, alice, bob_user["id"])
    assert [c["id"] for c in client.get("/api/v1/conversations", headers=alice).json()] == [
        conversation_id
    ]
    assert client.get("/api/v1/conversations", headers=bob).json() == []


def test_send_unread_and_read_flow(client, register):
    _, alice, _ = register("alice", "Alice")
    bob_user, bob, _ = register("bob", "Bob")
    conversation_id = _direct_chat(client, alice, bob_user["id"])

    sent = _send(client, alice, conversation_id, "  hi bob  ", "c1")
    assert sent.status_code == 201
    assert sent.json()["body"] == "hi bob"
    assert sent.json()["status"] == "sent"  # bob is offline

    bob_list = client.get("/api/v1/conversations", headers=bob).json()
    assert bob_list[0]["unread_count"] == 1
    assert bob_list[0]["last_message"]["body"] == "hi bob"

    read = client.post(f"/api/v1/conversations/{conversation_id}/read", json={}, headers=bob)
    assert read.json() == {"unread_count": 0}

    messages = client.get(f"/api/v1/conversations/{conversation_id}/messages", headers=alice)
    assert messages.json()["items"][0]["status"] == "read"


def test_send_is_idempotent(client, register):
    _, alice, _ = register("alice", "Alice")
    bob_user, _, _ = register("bob", "Bob")
    conversation_id = _direct_chat(client, alice, bob_user["id"])

    first = _send(client, alice, conversation_id, "hello", "same-id")
    retry = _send(client, alice, conversation_id, "hello", "same-id")
    assert retry.status_code == 200
    assert retry.json()["id"] == first.json()["id"]
    page = client.get(f"/api/v1/conversations/{conversation_id}/messages", headers=alice).json()
    assert len(page["items"]) == 1


def test_message_validation(client, register):
    _, alice, _ = register("alice", "Alice")
    bob_user, _, _ = register("bob", "Bob")
    conversation_id = _direct_chat(client, alice, bob_user["id"])
    assert _send(client, alice, conversation_id, "   ", "c1").status_code == 422
    assert _send(client, alice, conversation_id, "x" * 4001, "c2").status_code == 422


def test_pagination(client, register):
    _, alice, _ = register("alice", "Alice")
    bob_user, _, _ = register("bob", "Bob")
    conversation_id = _direct_chat(client, alice, bob_user["id"])
    for i in range(5):
        _send(client, alice, conversation_id, f"m{i}", f"c{i}")

    url = f"/api/v1/conversations/{conversation_id}/messages"
    page = client.get(f"{url}?limit=3", headers=alice).json()
    assert [m["body"] for m in page["items"]] == ["m2", "m3", "m4"]
    assert page["has_more"] is True
    older = client.get(f"{url}?limit=3&before_id={page['items'][0]['id']}", headers=alice).json()
    assert [m["body"] for m in older["items"]] == ["m0", "m1"]
    assert older["has_more"] is False


def test_non_member_gets_404(client, register):
    _, alice, _ = register("alice", "Alice")
    bob_user, _, _ = register("bob", "Bob")
    _, eve, _ = register("eve", "Eve")
    conversation_id = _direct_chat(client, alice, bob_user["id"])
    assert client.get(f"/api/v1/conversations/{conversation_id}", headers=eve).status_code == 404
    assert _send(client, eve, conversation_id, "hi", "c1").status_code == 404
