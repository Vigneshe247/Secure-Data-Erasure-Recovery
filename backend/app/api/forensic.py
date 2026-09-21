"""
Forensic Evidence API
=====================
Endpoints for viewing forensic evidence about files.
Uses the existing file metadata + blockchain chain-of-custody.
Does NOT invoke forensic carving — that's the existing /recovery/cases path.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path

from backend.app.database.session import get_db
from backend.app.models.models import User
from backend.app.models.enterprise_models import EnterpriseFile
from backend.app.schemas.enterprise_schemas import ForensicEvidenceResponse, AuditBlockResponse
from backend.app.services.blockchain_audit_service import BlockchainAuditService
from backend.app.core.permissions import require_permission

# Magic byte signatures for file type detection
MAGIC_SIGNATURES = {
    "application/pdf": {"bytes": "25 50 44 46", "signature": "%PDF", "type": "PDF"},
    "image/jpeg": {"bytes": "FF D8 FF", "signature": "JFIF/EXIF", "type": "JPEG"},
    "image/png": {"bytes": "89 50 4E 47 0D 0A 1A 0A", "signature": "PNG", "type": "PNG"},
    "application/zip": {"bytes": "50 4B 03 04", "signature": "PK (ZIP)", "type": "ZIP"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        "bytes": "50 4B 03 04", "signature": "PK (DOCX/ZIP)", "type": "DOCX"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
        "bytes": "50 4B 03 04", "signature": "PK (XLSX/ZIP)", "type": "XLSX"
    },
    "text/plain": {"bytes": "N/A", "signature": "Plain Text", "type": "TXT"},
}

router = APIRouter(prefix="/forensics", tags=["Forensic Evidence"])


@router.get("/evidence/{file_id}", response_model=ForensicEvidenceResponse)
async def get_forensic_evidence(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("forensics.evidence")),
):
    """
    Get forensic evidence for a file: magic bytes, SHA-256, type detection,
    recovery confidence, and chain-of-custody history.
    """
    ef = await db.get(EnterpriseFile, file_id)
    if not ef:
        raise HTTPException(status_code=404, detail="File not found")

    # Detect file type from mime_type and actual magic bytes
    magic_info = MAGIC_SIGNATURES.get(ef.mime_type, {
        "bytes": "N/A", "signature": "Unknown", "type": ef.mime_type or "Unknown"
    })

    # Try to read actual magic bytes from the file
    actual_magic = None
    file_path = Path(ef.quarantine_storage_path or ef.storage_path)
    if file_path.exists():
        try:
            with open(file_path, "rb") as f:
                header = f.read(16)
            actual_magic = " ".join(f"{b:02X}" for b in header[:8])
        except Exception:
            pass

    # Recovery confidence based on file status and source type
    if ef.source_type == "ENTERPRISE_UPLOAD":
        if ef.status in ("ACTIVE", "RECOVERED"):
            confidence = 100.0
        elif ef.status in ("ADMIN_RECOVERABLE", "RECOVERY_REQUESTED"):
            confidence = 99.0  # File is intact in quarantine
        elif ef.status == "PURGED":
            confidence = 0.0
        else:
            confidence = 50.0
    else:
        confidence = 85.0  # Forensic-carved files have lower certainty

    # Chain of custody
    custody_blocks = await BlockchainAuditService.get_chain_of_custody(db, file_id)
    custody_response = [
        AuditBlockResponse(
            id=b.id, index=b.index, timestamp=b.timestamp, event_type=b.event_type,
            actor_id=b.actor_id, actor_role=b.actor_role,
            target_file_id=b.target_file_id, target_user_id=b.target_user_id,
            source_ip=b.source_ip, action_details=b.action_details,
            audit_log_id=b.audit_log_id,
            previous_hash=b.previous_hash, hash=b.hash,
        )
        for b in custody_blocks
    ]

    return ForensicEvidenceResponse(
        file_id=ef.id,
        filename=ef.original_filename,
        file_size=ef.file_size,
        mime_type=ef.mime_type,
        sha256_hash=ef.sha256_hash,
        status=ef.status,
        source_type=ef.source_type,
        owner_id=ef.owner_id,
        detected_type=magic_info.get("type"),
        magic_bytes=actual_magic or magic_info.get("bytes"),
        magic_signature=magic_info.get("signature"),
        recovery_confidence=confidence,
        source_offset=0,  # Enterprise files start at offset 0 (not carved from disk)
        sector_info=f"Sandbox Storage: {ef.source_type}",
        recovery_timestamp=ef.created_at.isoformat() if ef.created_at else None,
        chain_of_custody=custody_response,
    )
