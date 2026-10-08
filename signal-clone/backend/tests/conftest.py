import os
import tempfile

# Configure an isolated database before the app (and its engine) is imported.
_tmp_dir = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_dir}/test.db"
os.environ["MEDIA_DIR"] = f"{_tmp_dir}/media"
os.environ["SEED_ON_STARTUP"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    # The context manager shares one event loop between HTTP calls and WebSockets.
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def register(client):
    """Creates a fully onboarded user and returns (user, auth headers, token)."""

    def _register(identifier: str, name: str):
        response = client.post(
            "/api/v1/auth/verify-otp", json={"identifier": identifier, "otp": "123456"}
        )
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        user = client.patch("/api/v1/users/me", json={"display_name": name}, headers=headers).json()
        return user, headers, token

    return _register
