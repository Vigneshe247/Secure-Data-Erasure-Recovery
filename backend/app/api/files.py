"""
Employee File Management API
=============================
Endpoints for employees to manage their own files within the enterprise lifecycle.
State-aware access: employees cannot download quarantined or purged files.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pathlib import Path

from backend.app.database.session import get_db
from backend.app.models.models import User
from backend.app.models.enterprise_models import EnterpriseFile
from backend.app.schemas.enterprise_schemas import (
    EnterpriseFileResponse,
    RecoveryRequestCreate,
    RecoveryRequestResponse,
)
from backend.app.services.file_lifecycle_service import FileLifecycleService
from backend.app.core.permissions import get_current_user, require_permission
from backend.app.core.config import settings
from backend.app.services.audit_service import AuditService

router = APIRouter(prefix="/files", tags=["Employee File Management"])


@router.get("", response_model=List[EnterpriseFileResponse])
async def list_files(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List files. Employees see only their own files.
    Admin/security_admin see all files.
    """
    if current_user.role in ("admin", "security_admin", "forensic_analyst"):
        result = await db.execute(
            select(EnterpriseFile).order_by(EnterpriseFile.created_at.desc())
        )
        return result.scalars().all()
    else:
        return await FileLifecycleService.get_employee_files(db, current_user.id)


@router.post("", response_model=EnterpriseFileResponse)
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("files.own.upload")),
):
    """Upload a file. Stored in sandbox uploads directory."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    # Size check
    file_data = await file.read()
    if len(file_data) > settings.UPLOAD_MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {settings.UPLOAD_MAX_SIZE // (1024*1024)} MB",
        )

    if len(file_data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    enterprise_file = await FileLifecycleService.upload_file(
        db=db,
        owner=current_user,
        filename=file.filename,
        file_data=file_data,
        mime_type=file.content_type,
    )
    return enterprise_file


@router.get("/{file_id}", response_model=EnterpriseFileResponse)
async def get_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get file metadata. Employees can only see their own files."""
    ef = await db.get(EnterpriseFile, file_id)
    if not ef:
        raise HTTPException(status_code=404, detail="File not found")

    # Employees can only see their own files
    if current_user.role == "employee" and ef.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: You can only view your own files")

    return ef


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Download a file. STATE-AWARE access control:
      Employee: ACTIVE/RECOVERED only. Cannot download quarantined or purged files.
      Admin: Can download any existing file.
    """
    from fastapi.responses import FileResponse

    ef = await db.get(EnterpriseFile, file_id)
    if not ef:
        raise HTTPException(status_code=404, detail="File not found")

    # Employee ownership check
    if current_user.role == "employee" and ef.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: You can only download your own files")

    # State-aware access: PURGED files can never be downloaded by anyone
    if ef.status == "PURGED":
        raise HTTPException(status_code=403, detail="Access denied: File has been permanently purged")
        
    if ef.status == "PURGE_IN_PROGRESS":
        raise HTTPException(status_code=403, detail="Access denied: File is currently being purged")

    # Employee state checks
    if current_user.role == "employee":
        if ef.status != "ACTIVE":
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: File is in '{ef.status}' state. "
                       f"Only ACTIVE files can be downloaded. "
                       f"Contact your administrator for recovery.",
            )

    file_path = Path(ef.storage_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Physical file not found on disk")

    return FileResponse(
        path=str(file_path),
        filename=ef.original_filename,
        media_type=ef.mime_type or "application/octet-stream",
    )


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("files.own.delete")),
):
    """
    Employee soft-deletes a file. Moves to ADMIN_RECOVERABLE state.
    Does NOT permanently erase. File enters the Recovery Vault.
    """
    try:
        ef = await FileLifecycleService.employee_delete(db, file_id, current_user)
        return {
            "message": f"File '{ef.original_filename}' has been moved to the administrator recovery vault.",
            "file_id": ef.id,
            "status": ef.status,
            "retention_expires_at": ef.retention_expires_at.isoformat() if ef.retention_expires_at else None,
        }
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{file_id}/recovery-request", response_model=RecoveryRequestResponse)
async def request_recovery(
    file_id: str,
    body: RecoveryRequestCreate = RecoveryRequestCreate(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("files.own.recovery_request")),
):
    """Employee submits a recovery request for a deleted file."""
    try:
        req = await FileLifecycleService.create_recovery_request(
            db=db, file_id=file_id, employee=current_user, reason=body.reason,
        )
        # Enrich response
        ef = await db.get(EnterpriseFile, req.file_id)
        return RecoveryRequestResponse(
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
            employee_username=current_user.username,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{file_id}/recovery-requests", response_model=List[RecoveryRequestResponse])
async def get_file_recovery_requests(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get recovery requests for a specific file. Employee sees own only."""
    ef = await db.get(EnterpriseFile, file_id)
    if not ef:
        raise HTTPException(status_code=404, detail="File not found")
    if current_user.role == "employee" and ef.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    from sqlalchemy.future import select as sel
    from backend.app.models.enterprise_models import RecoveryRequest
    result = await db.execute(
        sel(RecoveryRequest).where(RecoveryRequest.file_id == file_id)
        .order_by(RecoveryRequest.requested_at.desc())
    )
    requests = result.scalars().all()
    return [
        RecoveryRequestResponse(
            id=r.id, file_id=r.file_id, employee_id=r.employee_id,
            reason=r.reason, requested_at=r.requested_at, status=r.status,
            reviewed_by=r.reviewed_by, reviewed_at=r.reviewed_at,
            review_notes=r.review_notes,
            filename=ef.original_filename,
            employee_username=current_user.username if r.employee_id == current_user.id else None,
        )
        for r in requests
    ]
