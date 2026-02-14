"""
Tests for /api/users/me routes. Auth is overridden; service layer is mocked (no MongoDB).
Run: cd api && venv/bin/pip install pytest && venv/bin/pytest tests/test_users.py -v
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.auth.dependencies import get_token_claims
from src.auth.schemas import TokenClaims
from src.main import app


@pytest.fixture
def client():
    # Skip MongoDB init so tests run without a real DB
    with patch("src.main.init_db", new_callable=AsyncMock):
        with TestClient(app) as c:
            yield c


# Override auth so we don't need a real Auth0 token
@pytest.fixture(autouse=True)
def override_auth():
    def fake_claims():
        return TokenClaims(user_id="test-auth0-id")

    app.dependency_overrides[get_token_claims] = fake_claims
    yield
    app.dependency_overrides.clear()


def _fake_user(**kwargs):
    """Build a fake User-like object for _to_response."""
    from types import SimpleNamespace

    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id="507f1f77bcf86cd799439011",
        auth0_id=kwargs.get("auth0_id", "test-auth0-id"),
        name=kwargs.get("name", "Test User"),
        occupation=kwargs.get("occupation", "Tester"),
        gender=kwargs.get("gender", "non-binary"),
        interests=kwargs.get("interests", ["Testing", "Coffee", "Reading"]),
        created_at=kwargs.get("created_at", now),
        updated_at=kwargs.get("updated_at", now),
    )


# ----- GET /api/users/me -----


@patch("src.users.router.get_by_auth0_id", new_callable=AsyncMock)
def test_get_me_not_found(mock_get, client):
    mock_get.return_value = None
    response = client.get("/api/users/me")
    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"
    mock_get.assert_called_once_with("test-auth0-id")


@patch("src.users.router.get_by_auth0_id", new_callable=AsyncMock)
def test_get_me_success(mock_get, client):
    mock_get.return_value = _fake_user(name="Nick", occupation="SecEng")
    response = client.get("/api/users/me")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Nick"
    assert data["occupation"] == "SecEng"
    assert data["auth0_id"] == "test-auth0-id"
    assert "id" in data
    assert len(data["interests"]) == 3


# ----- POST /api/users/me -----


@patch("src.users.router.create_or_update", new_callable=AsyncMock)
def test_post_me_creates_user(mock_create, client):
    payload = {
        "name": "Nick chen",
        "occupation": "SecEng @ Google",
        "gender": "Male",
        "interests": ["Rock Climbing", "Running", "Raving"],
    }
    mock_create.return_value = _fake_user(**payload)
    response = client.post("/api/users/me", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == payload["name"]
    assert data["occupation"] == payload["occupation"]
    assert data["gender"] == payload["gender"]
    assert data["interests"] == payload["interests"]
    mock_create.assert_called_once()
    call_args = mock_create.call_args[0]  # positional: (auth0_id, payload)
    assert call_args[0] == "test-auth0-id"
    assert call_args[1].name == payload["name"]


@patch("src.users.router.create_or_update", new_callable=AsyncMock)
def test_post_me_validation_too_few_interests(mock_create, client):
    payload = {
        "name": "Nick",
        "occupation": "Engineer",
        "gender": "Male",
        "interests": ["Only", "Two"],
    }
    response = client.post("/api/users/me", json=payload)
    assert response.status_code == 422
    mock_create.assert_not_called()


@patch("src.users.router.create_or_update", new_callable=AsyncMock)
def test_post_me_validation_missing_fields(mock_create, client):
    response = client.post("/api/users/me", json={"name": "Nick"})
    assert response.status_code == 422
    mock_create.assert_not_called()


# ----- PATCH /api/users/me -----


@patch("src.users.router.update_me", new_callable=AsyncMock)
def test_patch_me_not_found(mock_update, client):
    mock_update.return_value = None
    response = client.patch(
        "/api/users/me",
        json={"name": "Updated"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"
    mock_update.assert_called_once()
    assert mock_update.call_args[0][0] == "test-auth0-id"


@patch("src.users.router.update_me", new_callable=AsyncMock)
def test_patch_me_success(mock_update, client):
    mock_update.return_value = _fake_user(name="Updated Name", occupation="New Job")
    response = client.patch(
        "/api/users/me",
        json={"name": "Updated Name", "occupation": "New Job"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["occupation"] == "New Job"
