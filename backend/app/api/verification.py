from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database.session import get_db
from backend.app.models.models import VerificationResult, ErasureOperation, User
from backend.app.schemas.schemas import VerificationStartRequest, VerificationResultResponse
from backend.app.services.verification_engine import VerificationEngineService
from backend.app.core.permissions import require_permission, get_current_user

router = APIRouter(prefix="/verification", tags=["Verification Engine"])


@router.get("", response_model=List[VerificationResultResponse])
async def list_verification_results(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("verification.view"))
):
    result = await db.execute(
        select(VerificationResult).order_by(VerificationResult.verified_at.desc())
    )
    return result.scalars().all()


@router.post("/start", response_model=VerificationResultResponse)
async def run_post_erasure_verification(
    req: VerificationStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("verification.execute"))
):
    try:
        verif = await VerificationEngineService.perform_verification(
            db=db,
            operation_id=req.operation_id,
            user=current_user
        )
        return verif
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{operation_id}", response_model=VerificationResultResponse)
async def get_verification_for_operation(
    operation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("verification.view"))
):
    result = await db.execute(
        select(VerificationResult).where(VerificationResult.erasure_operation_id == operation_id)
    )
    verif = result.scalars().first()
    if not verif:
        raise HTTPException(status_code=404, detail="No verification record found for this operation")
    return verif
