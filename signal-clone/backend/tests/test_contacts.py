def test_add_and_search_contacts(client, register):
    _, alice, _ = register("alice", "Alice")
    register("bob", "Bob Builder")

    added = client.post("/api/v1/contacts", json={"identifier": "@Bob"}, headers=alice)
    assert added.status_code == 201
    assert added.json()["user"]["display_name"] == "Bob Builder"

    duplicate = client.post("/api/v1/contacts", json={"identifier": "bob"}, headers=alice)
    assert duplicate.status_code == 409

    assert len(client.get("/api/v1/contacts?q=build", headers=alice).json()) == 1
    assert client.get("/api/v1/contacts?q=zzz", headers=alice).json() == []


def test_cannot_add_self_or_unknown(client, register):
    _, alice, _ = register("alice", "Alice")
    assert (
        client.post("/api/v1/contacts", json={"identifier": "alice"}, headers=alice).status_code
        == 400
    )
    assert (
        client.post("/api/v1/contacts", json={"identifier": "nobody"}, headers=alice).status_code
        == 404
    )
