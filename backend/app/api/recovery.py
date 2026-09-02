import os
from typing import List, Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.app.database.session import get_db
from backend.app.models.models import RecoveryCase, RecoveryCandidate, StorageDevice, User
from backend.app.schemas.schemas import (
    RecoveryCaseCreate,
    RecoveryCaseResponse,
    RecoveryCandidateResponse,
    RecoveryExecuteRequest,
)
from backend.app.services.recovery_engine import RecoveryEngineService
from backend.app.core.permissions import require_permission, get_current_user
from backend.app.services.audit_service import AuditService

router = APIRouter(prefix="/recovery", tags=["File Recovery"])


@router.post("/cases", response_model=RecoveryCaseResponse)
async def create_recovery_case(
    req: RecoveryCaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("recovery.cases.create"))
):
    target = await db.get(StorageDevice, req.target_device_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target storage device not found")

    case_num = f"CASE-{datetime_str()}-{os.urandom(2).hex().upper()}"

    case = RecoveryCase(
        case_number=case_num,
        title=req.title,
        created_by_user_id=current_user.id,
        target_device_id=target.id,
        status="CREATED",
        notes=req.notes
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)

    await AuditService.log_event(
        db=db,
        user=current_user,
        action="RECOVERY_CASE_CREATED",
        target_resource=case.case_number,
        operation_id=case.id,
        status="SUCCESS",
        details={"target_device": target.name, "title": case.title}
    )

    return case


def datetime_str():
    from datetime import datetime
    return datetime.now().strftime("%Y%m%d")


@router.get("/cases", response_model=List[RecoveryCaseResponse])
async def list_recovery_cases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("storage.view"))
):
    result = await db.execute(
        select(RecoveryCase)
        .options(selectinload(RecoveryCase.candidates))
        .order_by(RecoveryCase.created_at.desc())
    )
    return result.scalars().all()


@router.get("/cases/{case_id}", response_model=RecoveryCaseResponse)
async def get_recovery_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("storage.view"))
):
    result = await db.execute(
        select(RecoveryCase)
        .options(selectinload(RecoveryCase.candidates))
        .where(RecoveryCase.id == case_id)
    )
    case = result.scalars().first()
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")
    return case


@router.post("/cases/{case_id}/scan", response_model=List[RecoveryCandidateResponse])
async def run_recovery_scan(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("recovery.scan"))
):
    case = await db.get(RecoveryCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    candidates = await RecoveryEngineService.scan_and_carve_case(
        db=db,
        case=case,
        user=current_user
    )
    return candidates


@router.post("/files/recover", response_model=List[RecoveryCandidateResponse])
async def execute_file_recovery(
    req: RecoveryExecuteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("recovery.execute"))
):
    if not req.candidate_ids:
        raise HTTPException(status_code=400, detail="No candidate IDs provided")

    recovered = await RecoveryEngineService.recover_files(
        db=db,
        candidate_ids=req.candidate_ids,
        user=current_user
    )
    return recovered


@router.get("/files/{candidate_id}/download")
async def download_recovered_file(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("recovery.preview"))
):
    cand = await db.get(RecoveryCandidate, candidate_id)
    if not cand or not cand.recovered_file_path:
        raise HTTPException(status_code=404, detail="Recovered file not found or not yet recovered")

    file_path = Path(cand.recovered_file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Physical payload file missing on disk")

    return FileResponse(
        path=str(file_path),
        filename=cand.file_name,
        media_type="application/octet-stream"
    )


@router.delete("/cases/{case_id}/candidates")
async def clear_all_candidates(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("recovery.scan"))
):
    """Delete all candidate records belonging to a recovery case."""
    case = await db.get(RecoveryCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    result = await db.execute(
        select(RecoveryCandidate).where(RecoveryCandidate.case_id == case_id)
    )
    candidates = result.scalars().all()
    count = len(candidates)
    for cand in candidates:
        await db.delete(cand)

    # Reset case counters
    case.total_candidates = 0
    case.recovered_count = 0
    await db.commit()

    await AuditService.log_event(
        db=db,
        user=current_user,
        action="RECOVERY_CANDIDATES_CLEARED",
        target_resource=f"Case {case.case_number}",
        status="SUCCESS",
        details={"deleted_count": count, "case_id": case_id}
    )
    return {"message": f"Cleared {count} candidates from case {case.case_number}"}


@router.delete("/files/{candidate_id}")
async def delete_candidate(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("recovery.scan"))
):
    """Delete a single recovery candidate record."""
    cand = await db.get(RecoveryCandidate, candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    case = await db.get(RecoveryCase, cand.case_id)
    await db.delete(cand)
    if case and case.total_candidates and case.total_candidates > 0:
        case.total_candidates -= 1
        if cand.recovery_status == "RECOVERED" and case.recovered_count and case.recovered_count > 0:
            case.recovered_count -= 1
    await db.commit()
    return {"message": f"Candidate {cand.file_name} deleted"}


@router.delete("/cases/{case_id}")
async def delete_recovery_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("recovery.cases.create"))
):
    """Delete a forensic recovery case and all its associated candidates."""
    case = await db.get(RecoveryCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    # Delete all associated candidates
    result = await db.execute(
        select(RecoveryCandidate).where(RecoveryCandidate.case_id == case_id)
    )
    candidates = result.scalars().all()
    for cand in candidates:
        await db.delete(cand)

    case_num = case.case_number
    await db.delete(case)
    await db.commit()

    await AuditService.log_event(
        db=db,
        user=current_user,
        action="RECOVERY_CASE_DELETED",
        target_resource=f"Case {case_num}",
        status="SUCCESS",
        details={"deleted_candidates_count": len(candidates), "case_id": case_id}
    )
    return {"message": f"Case {case_num} and its candidates successfully deleted"}


