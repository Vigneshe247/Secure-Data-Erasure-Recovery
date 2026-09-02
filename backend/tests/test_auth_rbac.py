import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app


@pytest.mark.asyncio
async def test_auth_login_success():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "adminpassword123"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["user"]["username"] == "admin"
        assert data["user"]["role"] == "admin"


@pytest.mark.asyncio
async def test_auth_login_invalid_password():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "wrongpassword"}
        )
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_rbac_forensic_analyst_cannot_execute_erasure():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login as forensic analyst
        login_res = await client.post(
            "/api/auth/login",
            json={"username": "forensic_analyst", "password": "analystpass123"}
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Attempt to execute destructive erasure -> Must be 403 Forbidden!
        erasure_res = await client.post(
            "/api/erasure/execute",
            json={"operation_id": "dummy-op-id", "confirmation_phrase": "ERASE"},
            headers=headers
        )
        assert erasure_res.status_code == 403
        assert "erasure.execute" in erasure_res.json()["detail"]
