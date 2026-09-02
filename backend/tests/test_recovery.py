import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.services.signature_analyzer import identify_signature_at_offset
from backend.app.ai.recovery_confidence import RecoveryConfidenceAI


def test_signature_detection():
    # JPEG header
    jpeg_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00"
    match = identify_signature_at_offset(jpeg_bytes, 0)
    assert match is not None
    assert match[0] == "JPG"

    # PNG header
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    match_png = identify_signature_at_offset(png_bytes, 0)
    assert match_png is not None
    assert match_png[0] == "PNG"

    # PDF header
    pdf_bytes = b"%PDF-1.4\n1 0 obj"
    match_pdf = identify_signature_at_offset(pdf_bytes, 0)
    assert match_pdf is not None
    assert match_pdf[0] == "PDF"


def test_recovery_confidence_scoring():
    score, level, explanation = RecoveryConfidenceAI.evaluate_candidate(
        detected_format="JPG",
        signature_match_pct=100.0,
        structure_validity_pct=95.0,
        continuity_pct=90.0,
        metadata_quality_pct=85.0,
        file_size_bytes=1024 * 1024,
        integrity_status="PASS"
    )
    assert 85.0 <= score <= 100.0
    assert level in ["HIGH", "VERY_HIGH"]
    assert "magic byte header" in explanation


@pytest.mark.asyncio
async def test_recovery_cases_list():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/auth/login",
            json={"username": "forensic_analyst", "password": "analystpass123"}
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        cases_res = await client.get("/api/recovery/cases", headers=headers)
        assert cases_res.status_code == 200
        cases = cases_res.json()
        assert len(cases) > 0
        assert cases[0]["case_number"] == "CASE-2026-00127"
