"""
Admin Vault & Governance API
=============================
Admin-only endpoints for the Zero-Trust Recovery Vault, recovery request management,
secure purge, retention holds, blockchain audit verification, and SOC dashboard.

All endpoints require admin/security_admin role — server-side enforcement.
Even if an employee manually calls these endpoints, access is denied with 403.
"""

from typing import List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from backend.app.database.session import get_db
from backend.app.models.models import User, AuditLog
from backend.app.models.enterprise_models import EnterpriseFile, RecoveryRequest, AuditBlock
from backend.app.schemas.enterprise_schemas import (
    VaultFileResponse,
    RecoveryRequestResponse,
    ReviewRequestBody,
    PurgeRequest,
    PurgeResponse,
    RetentionHoldRequest,
    EnterpriseFileResponse,
    AuditBlockResponse,
    ChainVerificationResponse,
    SOCDashboardResponse,
)
from backend.app.services.file_lifecycle_service import FileLifecycleService
from backend.app.services.blockchain_audit_service import BlockchainAuditService
from backend.app.core.permissions import require_permission, require_role, get_current_user
from backend.app.services.audit_service import AuditService

router = APIRouter(prefix="/admin", tags=["Admin Vault & Governance"])


# ------------------------------------------------------------------
# Recovery Vault (GET /admin/vault)
# ------------------------------------------------------------------

@router.get("/vault", response_model=List[VaultFileResponse])
async def get_recovery_vault(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vault.view")),
):
    """
    List all files in ADMIN_RECOVERABLE or RECOVERY_REQUESTED state.
    This is the Zero-Trust Recovery Vault — employee CANNOT access this.
    """
    vault_files = await FileLifecycleService.get_vault_files(db)

    result = []
    for ef in vault_files:
        # Look up owner info
        owner = await db.get(User, ef.owner_id)
        result.append(VaultFileResponse(
            id=ef.id,
            original_filename=ef.original_filename,
            file_size=ef.file_size,
            mime_type=ef.mime_type,
            sha256_hash=ef.sha256_hash,
            status=ef.status,
            owner_id=ef.owner_id,
            owner_username=owner.username if owner else None,
            owner_fullname=owner.full_name if owner else None,
            deleted_at=ef.deleted_at,
            retention_expires_at=ef.retention_expires_at,
            retention_hold=ef.retention_hold,
            created_at=ef.created_at,
        ))
    return result


# ------------------------------------------------------------------
# Targeted Recovery (POST /admin/recover/{id})
# ------------------------------------------------------------------

@router.post("/recover/{file_id}", response_model=EnterpriseFileResponse)
async def admin_recover_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vault.recover")),
):
    """
    Admin directly recovers a file from quarantine.
    This is ENTERPRISE recovery (quarantine restore), NOT forensic carving.
    """
    try:
        ef = await FileLifecycleService.admin_recover(db, file_id, current_user)
        return ef
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


# ------------------------------------------------------------------
# Secure Purge (POST /admin/purge/{id})
# ------------------------------------------------------------------

@router.post("/purge/{file_id}", response_model=PurgeResponse)
async def admin_purge_file(
    file_id: str,
    body: PurgeRequest = PurgeRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vault.purge")),
):
    """
    Admin permanently purges a file through the secure erasure pipeline:
      Authorization → Erasure Engine → Verification → Audit Block → Certificate → PURGED
    Only operates within SANDBOX_MODE.
    """
    try:
        result = await FileLifecycleService.admin_purge(
            db, file_id, current_user, method=body.method,
        )
        ef = result["file"]
        return PurgeResponse(
            file_id=ef.id,
            filename=ef.original_filename,
            status=ef.status,
            method=result["method"],
            verified=result["verified"],
            verification=result["verification"],
            sha256_original=ef.sha256_hash,
            purged_at=ef.purged_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ------------------------------------------------------------------
# Recovery Requests Management
# ------------------------------------------------------------------

@router.get("/recovery-requests", response_model=List[RecoveryRequestResponse])
async def list_recovery_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vault.recovery_requests")),
):
    """List all pending recovery requests for admin review."""
    requests = await FileLifecycleService.get_pending_requests(db)
    result = []
    for req in requests:
        ef = await db.get(EnterpriseFile, req.file_id)
        emp = await db.get(User, req.employee_id)
        result.append(RecoveryRequestResponse(
            id=req.id,
            file_id=req.file_id,
            employee_id=req.employee_id,
            reason=req.reason,
            requested_at=req.requested_at,
            status=req.status,
            reviewed_by=req.reviewed_by,
            reviewed_at=req.reviewed_at,
            review_notes=req.review_notes,
            filename=ef.original_filename if ef else None,
            employee_username=emp.username if emp else None,
        ))
    return result


@router.post("/recovery-requests/{request_id}/approve", response_model=RecoveryRequestResponse)
async def approve_recovery_request(
    request_id: str,
    body: ReviewRequestBody = ReviewRequestBody(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vault.approve_request")),
):
    """Admin approves a recovery request and restores the file from quarantine."""
    try:
        req = await FileLifecycleService.approve_recovery_request(
            db, request_id, current_user, notes=body.notes,
        )
        ef = await db.get(EnterpriseFile, req.file_id)
        return RecoveryRequestResponse(
            id=req.id, file_id=req.file_id, employee_id=req.employee_id,
            reason=req.reason, requested_at=req.requested_at, status=req.status,
            reviewed_by=req.reviewed_by, reviewed_at=req.reviewed_at,
            review_notes=req.review_notes,
            filename=ef.original_filename if ef else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/recovery-requests/{request_id}/reject", response_model=RecoveryRequestResponse)
async def reject_recovery_request(
    request_id: str,
    body: ReviewRequestBody = ReviewRequestBody(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vault.reject_request")),
):
    """Admin rejects a recovery request."""
    try:
        req = await FileLifecycleService.reject_recovery_request(
            db, request_id, current_user, notes=body.notes,
        )
        ef = await db.get(EnterpriseFile, req.file_id)
        return RecoveryRequestResponse(
            id=req.id, file_id=req.file_id, employee_id=req.employee_id,
            reason=req.reason, requested_at=req.requested_at, status=req.status,
            reviewed_by=req.reviewed_by, reviewed_at=req.reviewed_at,
            review_notes=req.review_notes,
            filename=ef.original_filename if ef else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ------------------------------------------------------------------
# Retention Hold
# ------------------------------------------------------------------

@router.put("/files/{file_id}/hold", response_model=EnterpriseFileResponse)
async def set_retention_hold(
    file_id: str,
    body: RetentionHoldRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vault.recover")),
):
    """Set or unset a retention/legal hold on a file (prevents automated purge)."""
    try:
        ef = await FileLifecycleService.set_retention_hold(db, file_id, current_user, body.hold)
        return ef
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ------------------------------------------------------------------
# Blockchain Audit Verification (GET /admin/audit/verify)
# ------------------------------------------------------------------

@router.get("/audit/verify", response_model=ChainVerificationResponse)
async def verify_audit_chain(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("audit.blockchain.verify")),
):
    """Verify the entire blockchain audit chain integrity."""
    result = await BlockchainAuditService.verify_chain(db)
    return ChainVerificationResponse(**result)


@router.get("/audit/blocks", response_model=List[AuditBlockResponse])
async def list_audit_blocks(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("audit.blockchain.view")),
):
    """List audit blockchain blocks."""
    blocks = await BlockchainAuditService.get_blocks(db, limit=limit)
    return blocks


@router.get("/audit/chain-of-custody/{file_id}", response_model=List[AuditBlockResponse])
async def get_chain_of_custody(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("audit.blockchain.view")),
):
    """Get the ordered chain-of-custody events for a specific file."""
    blocks = await BlockchainAuditService.get_chain_of_custody(db, file_id)
    return blocks


# ------------------------------------------------------------------
# SOC Dashboard Metrics (GET /admin/dashboard/metrics)
# ------------------------------------------------------------------

@router.get("/dashboard/metrics", response_model=SOCDashboardResponse)
async def get_soc_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("dashboard.soc")),
):
    """Enterprise SOC dashboard with governance metrics."""
    now = datetime.now(timezone.utc)

    # File counts by status
    active_count = (await db.execute(
        select(func.count(EnterpriseFile.id)).where(EnterpriseFile.status == "ACTIVE")
    )).scalar() or 0

    recoverable_count = (await db.execute(
        select(func.count(EnterpriseFile.id)).where(
            EnterpriseFile.status.in_(["ADMIN_RECOVERABLE", "RECOVERY_REQUESTED"])
        )
    )).scalar() or 0

    purged_count = (await db.execute(
        select(func.count(EnterpriseFile.id)).where(EnterpriseFile.status == "PURGED")
    )).scalar() or 0

    total_count = (await db.execute(
        select(func.count(EnterpriseFile.id))
    )).scalar() or 0

    pending_requests = (await db.execute(
        select(func.count(RecoveryRequest.id)).where(RecoveryRequest.status == "PENDING")
    )).scalar() or 0

    security_events = (await db.execute(
        select(func.count(AuditLog.id))
    )).scalar() or 0

    # Audit chain status
    chain_result = await BlockchainAuditService.verify_chain(db)
    audit_chain_status = "VALID" if chain_result["valid"] else "INVALID"
    audit_blocks_count = chain_result["blocks_checked"]

    # Retention expiring soon (within 7 days)
    seven_days = now + timedelta(days=7)
    expiring_soon = (await db.execute(
        select(func.count(EnterpriseFile.id)).where(
            EnterpriseFile.status.in_(["ADMIN_RECOVERABLE", "RECOVERY_REQUESTED"]),
            EnterpriseFile.retention_expires_at <= seven_days,
            EnterpriseFile.retention_expires_at > now,
        )
    )).scalar() or 0

    # Recent audit blocks
    recent_blocks = await BlockchainAuditService.get_blocks(db, limit=10)
    recent_events = [
        {
            "index": b.index,
            "event_type": b.event_type,
            "actor_id": b.actor_id,
            "actor_role": b.actor_role,
            "target_file_id": b.target_file_id,
            "timestamp": b.timestamp.isoformat() if b.timestamp else None,
            "hash": b.hash[:16] + "...",
        }
        for b in recent_blocks
    ]

    return SOCDashboardResponse(
        active_files=active_count,
        recoverable_files=recoverable_count,
        pending_recovery_requests=pending_requests,
        files_purged=purged_count,
        total_files=total_count,
        security_events=security_events,
        audit_chain_status=audit_chain_status,
        audit_blocks_count=audit_blocks_count,
        retention_expiring_soon=expiring_soon,
        recent_events=recent_events,
    )
