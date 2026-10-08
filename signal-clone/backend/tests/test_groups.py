def _create_group(client, headers, member_ids, name="Friends"):
    return client.post(
        "/api/v1/conversations",
        json={"type": "group", "name": name, "member_ids": member_ids},
        headers=headers,
    )


def test_create_group(client, register):
    alice_user, alice, _ = register("alice", "Alice")
    bob_user, bob, _ = register("bob", "Bob")
    response = _create_group(client, alice, [bob_user["id"]])
    assert response.status_code == 201
    group = response.json()
    assert group["my_role"] == "admin"
    assert {m["user"]["id"] for m in group["members"]} == {alice_user["id"], bob_user["id"]}
    assert group["last_message"]["body"] == "Alice created the group"
    assert client.get("/api/v1/conversations", headers=bob).json()[0]["name"] == "Friends"


def test_group_requires_members_and_name(client, register):
    _, alice, _ = register("alice", "Alice")
    assert _create_group(client, alice, []).status_code == 422


def test_only_admin_manages_members(client, register):
    _, alice, _ = register("alice", "Alice")
    bob_user, bob, _ = register("bob", "Bob")
    carol_user, _, _ = register("carol", "Carol")
    group_id = _create_group(client, alice, [bob_user["id"]]).json()["id"]

    as_bob = client.post(
        f"/api/v1/conversations/{group_id}/members",
        json={"user_ids": [carol_user["id"]]},
        headers=bob,
    )
    assert as_bob.status_code == 403

    as_alice = client.post(
        f"/api/v1/conversations/{group_id}/members",
        json={"user_ids": [carol_user["id"]]},
        headers=alice,
    )
    assert len(as_alice.json()["members"]) == 3


def test_removed_member_cannot_send_but_keeps_history(client, register):
    _, alice, _ = register("alice", "Alice")
    bob_user, bob, _ = register("bob", "Bob")
    group_id = _create_group(client, alice, [bob_user["id"]]).json()["id"]

    removed = client.delete(
        f"/api/v1/conversations/{group_id}/members/{bob_user['id']}", headers=alice
    )
    assert len(removed.json()["members"]) == 1

    send = client.post(
        f"/api/v1/conversations/{group_id}/messages",
        json={"client_message_id": "x", "body": "hello?"},
        headers=bob,
    )
    assert send.status_code == 403

    bob_view = client.get(f"/api/v1/conversations/{group_id}", headers=bob).json()
    assert bob_view["is_active_member"] is False
    history = client.get(f"/api/v1/conversations/{group_id}/messages", headers=bob).json()
    assert history["items"][-1]["body"] == "Alice removed Bob"


def test_last_admin_leaving_promotes_someone(client, register):
    _, alice, _ = register("alice", "Alice")
    bob_user, bob, _ = register("bob", "Bob")
    group_id = _create_group(client, alice, [bob_user["id"]]).json()["id"]

    assert client.post(f"/api/v1/conversations/{group_id}/leave", headers=alice).status_code == 204
    assert client.get(f"/api/v1/conversations/{group_id}", headers=bob).json()["my_role"] == "admin"


def test_admin_cannot_remove_self(client, register):
    alice_user, alice, _ = register("alice", "Alice")
    bob_user, _, _ = register("bob", "Bob")
    group_id = _create_group(client, alice, [bob_user["id"]]).json()["id"]
    response = client.delete(
        f"/api/v1/conversations/{group_id}/members/{alice_user['id']}", headers=alice
    )
    assert response.status_code == 400
