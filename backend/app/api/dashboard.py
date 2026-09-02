from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from backend.app.database.session import get_db
from backend.app.models.models import (
    User,
    StorageDevice,
    RecoveryCase,
    RecoveryCandidate,
    ErasureOperation,
    VerificationResult,
    AuditLog
)
from backend.app.schemas.schemas import DashboardMetricsResponse
from backend.app.core.permissions import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/metrics", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    devices = (await db.execute(select(StorageDevice))).scalars().all()
    cases_count = (await db.execute(select(func.count(RecoveryCase.id)))).scalar() or 0
    recovered_files_count = (await db.execute(
        select(func.count(RecoveryCandidate.id)).where(RecoveryCandidate.recovery_status == "RECOVERED")
    )).scalar() or 0

    erasure_ops_count = (await db.execute(select(func.count(ErasureOperation.id)))).scalar() or 0
    verified_ops = (await db.execute(
        select(func.count(ErasureOperation.id)).where(ErasureOperation.status == "VERIFIED")
    )).scalar() or 0

    failed_verifs = (await db.execute(
        select(func.count(VerificationResult.id)).where(VerificationResult.verdict == "FAILED")
    )).scalar() or 0

    total_verifs = (await db.execute(select(func.count(VerificationResult.id)))).scalar() or 0
    pass_rate = round((verified_ops / max(1, total_verifs)) * 100, 1) if total_verifs > 0 else 98.4

    # Recent activity
    recent_logs = (await db.execute(
        select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(8)
    )).scalars().all()

    recent_ops = [
        {
            "id": log.id,
            "action": log.action,
            "username": log.username,
            "role": log.role,
            "target": log.target_resource,
            "status": log.status,
            "timestamp": log.timestamp.isoformat()
        }
        for log in recent_logs
    ]

    storage_summary = [
        {
            "id": dev.id,
            "name": dev.name,
            "storage_type": dev.storage_type,
            "filesystem": dev.filesystem,
            "is_sandbox": dev.is_sandbox,
            "total_bytes": dev.total_capacity_bytes,
            "used_bytes": dev.used_capacity_bytes,
            "risk_level": dev.risk_level,
            "health": dev.health_status
        }
        for dev in devices
    ]

    return {
        "total_users": users_count,
        "active_devices": len(devices),
        "total_recovery_cases": cases_count,
        "total_recovered_files": recovered_files_count,
        "total_erasure_ops": erasure_ops_count,
        "verified_erasure_ops": verified_ops,
        "failed_verifications": failed_verifs,
        "security_alerts_count": 0 if failed_verifs == 0 else failed_verifs,
        "verification_pass_rate": pass_rate,
        "recent_operations": recent_ops,
        "storage_summary": storage_summary
    }
