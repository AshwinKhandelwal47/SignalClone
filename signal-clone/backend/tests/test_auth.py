def test_wrong_otp_is_rejected(client):
    response = client.post("/api/v1/auth/verify-otp", json={"identifier": "alice", "otp": "000000"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_invalid_phone_is_rejected(client):
    response = client.post("/api/v1/auth/request-otp", json={"identifier": "+12"})
    assert response.status_code == 400


def test_registration_then_login(client):
    first = client.post("/api/v1/auth/request-otp", json={"identifier": "+1 (555) 123-4567"})
    assert first.json() == {
        "identifier": "+15551234567",
        "is_registered": False,
        "otp_hint": "123456",
    }

    verified = client.post(
        "/api/v1/auth/verify-otp", json={"identifier": "+15551234567", "otp": "123456"}
    ).json()
    assert verified["is_new_user"] is True
    headers = {"Authorization": f"Bearer {verified['token']}"}

    profile = client.patch("/api/v1/users/me", json={"display_name": "  Zoe  "}, headers=headers)
    assert profile.json()["display_name"] == "Zoe"

    again = client.post(
        "/api/v1/auth/verify-otp", json={"identifier": "+15551234567", "otp": "123456"}
    ).json()
    assert again["is_new_user"] is False
    assert again["user"]["id"] == verified["user"]["id"]


def test_logout_revokes_session(client, register):
    _, headers, _ = register("alice", "Alice")
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_requires_auth(client):
    assert client.get("/api/v1/conversations").status_code == 401
