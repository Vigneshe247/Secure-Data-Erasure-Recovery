import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.services.verification_engine import VerificationEngineService
from backend.app.ai.residual_risk import ResidualRiskAI


def test_shannon_entropy_calculation():
    # Pure zeroes have 0.0 entropy
    zero_buf = b"\x00" * 4096
    entropy_zero = VerificationEngineService.calculate_shannon_entropy(zero_buf)
    assert entropy_zero == 0.0

    # Uniform all 256 bytes have 8.0 entropy
    full_byte_buf = bytes(range(256)) * 16
    entropy_full = VerificationEngineService.calculate_shannon_entropy(full_byte_buf)
    assert 7.95 <= entropy_full <= 8.05


def test_residual_risk_evaluation():
    # 0 signatures, 0 recoverable objects -> PASSED, LOW risk
    verdict, risk, summary = ResidualRiskAI.evaluate_residual_evidence(
        residual_signatures_count=0,
        recoverable_objects_count=0,
        residual_entropy=0.0,
        controlled_recovery_successes=0,
        storage_type="HDD",
        sanitization_method="NIST_800_88_CLEAR"
    )
    assert verdict == "PASSED"
    assert risk == "LOW"

    # Residual objects found -> FAILED, HIGH/CRITICAL risk
    verdict_fail, risk_fail, _ = ResidualRiskAI.evaluate_residual_evidence(
        residual_signatures_count=4,
        recoverable_objects_count=2,
        residual_entropy=4.5,
        controlled_recovery_successes=1,
        storage_type="SSD",
        sanitization_method="NIST_800_88_PURGE"
    )
    assert verdict_fail == "FAILED"
    assert risk_fail in ["HIGH", "CRITICAL"]


@pytest.mark.asyncio
async def test_erasure_confirmation_phrase_mismatch():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login as security admin
        login_res = await client.post(
            "/api/auth/login",
            json={"username": "security_admin", "password": "secadminpass123"}
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Request erasure on a sandbox device
        devices_res = await client.get("/api/storage/devices", headers=headers)
        devices = devices_res.json()
        target_dev = devices[0]

        req_res = await client.post(
            "/api/erasure/request",
            json={
                "target_device_id": target_dev["id"],
                "target_scope": "FREE_SPACE",
                "sanitization_method": "NIST_800_88_CLEAR"
            },
            headers=headers
        )
        assert req_res.status_code == 200
        op = req_res.json()

        # Approve
        app_res = await client.post(
            "/api/erasure/approve",
            json={"operation_id": op["id"]},
            headers=headers
        )
        assert app_res.status_code == 200

        # Execute with WRONG phrase -> Must fail!
        exec_bad = await client.post(
            "/api/erasure/execute",
            json={"operation_id": op["id"], "confirmation_phrase": "WRONG_PHRASE"},
            headers=headers
        )
        assert exec_bad.status_code == 400
        assert "phrase mismatch" in (exec_bad.json().get("detail") or "").lower()

        # Execute with CORRECT phrase -> Must succeed!
        exec_good = await client.post(
            "/api/erasure/execute",
            json={"operation_id": op["id"], "confirmation_phrase": op["confirmation_phrase"]},
            headers=headers
        )
        assert exec_good.status_code == 200
        assert exec_good.json()["status"] in ["VERIFYING", "VERIFIED"]
