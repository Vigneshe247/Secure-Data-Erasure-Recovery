from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database.session import get_db
from backend.app.models.models import ErasureOperation, StorageDevice, User
from backend.app.schemas.schemas import (
    ErasureAnalyzeRequest,
    ErasureRecommendationResponse,
    ErasureRequestCreate,
    ErasureApproveRequest,
    ErasureExecuteRequest,
    ErasureOperationResponse,
)
from backend.app.services.erasure_engine import ErasureEngineService
from backend.app.services.storage_analyzer import StorageAnalyzerService
from backend.app.core.permissions import require_permission, get_current_user
from backend.app.services.audit_service import AuditService

router = APIRouter(prefix="/erasure", tags=["Secure Erasure"])


@router.post("/analyze", response_model=ErasureRecommendationResponse)
async def analyze_erasure_strategy(
    req: ErasureAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("erasure.analyze"))
):
    device = await db.get(StorageDevice, req.device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Target device not found")

    is_flash = device.storage_type.upper() in ["SSD", "NVME"]
    if is_flash:
        rec_method = "NIST_800_88_PURGE"
        method_desc = "Cryptographic scramble & Flash Translation Layer block sanitize to prevent wear-leveling recovery."
        compliance = "NIST SP 800-88 Rev. 1 (Purge) / ISO/IEC 27040"
        ftl_notes = "Standard overwrites miss over-provisioned NAND flash blocks. Crypto-purge enforces controller-level sanitization."
        risk_level = "MEDIUM" if device.is_sandbox else "HIGH"
    else:
        rec_method = "NIST_800_88_CLEAR"
        method_desc = "Single/multi-pass magnetic track overwrite with deterministic read-back verification."
        compliance = "NIST SP 800-88 Rev. 1 (Clear) / DoD 5220.22-M"
        ftl_notes = "Direct LBA-to-magnetic platter mapping is predictable and suitable for overwrite passes."
        risk_level = "LOW" if device.is_sandbox else "MEDIUM"

    return {
        "device_id": device.id,
        "device_name": device.name,
        "storage_type": device.storage_type,
        "filesystem": device.filesystem,
        "risk_level": risk_level,
        "recommended_method": rec_method,
        "method_description": method_desc,
        "estimated_duration_sec": 45,
        "ftl_impact_notes": ftl_notes,
        "compliance_standard": compliance,
        "ai_risk_score": 0.88 if is_flash else 0.42
    }


@router.post("/request", response_model=ErasureOperationResponse)
async def request_erasure_operation(
    req: ErasureRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("erasure.request"))
):
    try:
        op = await ErasureEngineService.request_erasure(
            db=db,
            target_device_id=req.target_device_id,
            target_scope=req.target_scope,
            sanitization_method=req.sanitization_method,
            user=current_user,
            notes=req.notes
        )
        return op
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/approve", response_model=ErasureOperationResponse)
async def approve_erasure_operation(
    req: ErasureApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("erasure.approve"))
):
    try:
        op = await ErasureEngineService.approve_erasure(
            db=db,
            operation_id=req.operation_id,
            approver=current_user,
            notes=req.approval_notes
        )
        return op
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/execute", response_model=ErasureOperationResponse)
async def execute_erasure_operation(
    req: ErasureExecuteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("erasure.execute"))
):
    try:
        op = await ErasureEngineService.execute_erasure(
            db=db,
            operation_id=req.operation_id,
            confirmation_phrase=req.confirmation_phrase,
            user=current_user
        )
        return op
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/operations", response_model=List[ErasureOperationResponse])
async def list_erasure_operations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("storage.view"))
):
    result = await db.execute(select(ErasureOperation).order_by(ErasureOperation.created_at.desc()))
    return result.scalars().all()


@router.get("/{operation_id}", response_model=ErasureOperationResponse)
async def get_erasure_operation(
    operation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("storage.view"))
):
    op = await db.get(ErasureOperation, operation_id)
    if not op:
        raise HTTPException(status_code=404, detail="Erasure operation not found")
    return op
