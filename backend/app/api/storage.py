from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database.session import get_db
from backend.app.models.models import StorageDevice, User
from backend.app.schemas.schemas import StorageDeviceResponse, StorageAnalyzeRequest, StorageProfileResponse
from backend.app.services.storage_analyzer import StorageAnalyzerService
from backend.app.core.permissions import require_permission, get_current_user
from backend.app.services.audit_service import AuditService

router = APIRouter(prefix="/storage", tags=["Storage Analyzer"])


@router.get("/devices", response_model=List[StorageDeviceResponse])
async def list_storage_devices(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("storage.view"))
):
    devices = await StorageAnalyzerService.get_or_create_devices(db)
    return devices


@router.get("/{device_id}", response_model=StorageDeviceResponse)
async def get_storage_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("storage.view"))
):
    device = await db.get(StorageDevice, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Storage device not found")
    return device


@router.post("/analyze", response_model=StorageProfileResponse)
async def analyze_storage(
    req: StorageAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("storage.analyze"))
):
    device = await db.get(StorageDevice, req.device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Storage device not found")

    analysis = StorageAnalyzerService.analyze_storage_profile(device)

    await AuditService.log_event(
        db=db,
        user=current_user,
        action="STORAGE_ANALYSIS_EXECUTED",
        target_resource=device.name,
        operation_id=device.id,
        status="SUCCESS",
        details={
            "storage_type": device.storage_type,
            "recommended_strategy": analysis["recommended_strategy"],
            "ftl_warning": analysis["ftl_warning"]
        }
    )

    return {
        "device": device,
        "storage_type": analysis["storage_type"],
        "risk_level": analysis["risk_level"],
        "ftl_warning": analysis["ftl_warning"],
        "trim_active": analysis["trim_active"],
        "recommended_strategy": analysis["recommended_strategy"],
        "technical_rationale": analysis["technical_rationale"],
        "ai_confidence": analysis["ai_confidence"]
    }
