from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database.session import get_db
from backend.app.models.models import AuditLog, User
from backend.app.schemas.schemas import AuditLogResponse
from backend.app.core.permissions import require_permission, get_current_user

router = APIRouter(prefix="/audit", tags=["Audit System"])


@router.get("", response_model=List[AuditLogResponse])
async def get_audit_logs(
    limit: int = Query(100, le=500),
    action: Optional[str] = None,
    username: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("audit.view"))
):
    query = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)

    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if username:
        query = query.where(AuditLog.username.ilike(f"%{username}%"))

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/export/json")
async def export_audit_logs_json(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("audit.export"))
):
    result = await db.execute(select(AuditLog).order_by(AuditLog.timestamp.desc()))
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "username": log.username,
            "role": log.role,
            "action": log.action,
            "target_resource": log.target_resource,
            "operation_id": log.operation_id,
            "status": log.status,
            "sha256_checksum": log.sha256_checksum,
            "details": log.details_json
        }
        for log in logs
    ]
