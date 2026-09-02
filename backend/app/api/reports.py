from typing import List
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database.session import get_db
from backend.app.models.models import SecurityReport, User
from backend.app.schemas.schemas import SecurityReportResponse
from backend.app.services.report_service import ReportService
from backend.app.core.permissions import require_permission, get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("", response_model=List[SecurityReportResponse])
async def list_security_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view"))
):
    result = await db.execute(select(SecurityReport).order_by(SecurityReport.created_at.desc()))
    return result.scalars().all()


@router.get("/{report_id}", response_model=SecurityReportResponse)
async def get_security_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view"))
):
    report = await db.get(SecurityReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Security report not found")
    return report


@router.post("/erasure/{operation_id}/generate", response_model=SecurityReportResponse)
async def generate_erasure_report(
    operation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.generate"))
):
    try:
        report = await ReportService.create_erasure_report(
            db=db,
            operation_id=operation_id,
            user=current_user
        )
        return report
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/recovery/{case_id}/generate", response_model=SecurityReportResponse)
async def generate_recovery_report(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.generate"))
):
    try:
        report = await ReportService.create_recovery_report(
            db=db,
            case_id=case_id,
            user=current_user
        )
        return report
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{report_id}/pdf")
async def download_report_pdf(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.download"))
):
    report = await db.get(SecurityReport, report_id)
    if not report or not report.pdf_file_path:
        raise HTTPException(status_code=404, detail="Report PDF file not found")

    pdf_path = Path(report.pdf_file_path)
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Physical PDF file missing on disk")

    return FileResponse(
        path=str(pdf_path),
        filename=f"{report.report_number}.pdf",
        media_type="application/pdf"
    )


@router.delete("/{report_id}")
async def delete_security_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.generate"))
):
    """Delete a single security compliance report."""
    report = await db.get(SecurityReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Security report not found")

    if report.pdf_file_path:
        try:
            p = Path(report.pdf_file_path)
            if p.exists():
                p.unlink(missing_ok=True)
        except Exception:
            pass

    rep_num = report.report_number
    await db.delete(report)
    await db.commit()
    return {"message": f"Report {rep_num} deleted"}


@router.delete("")
async def clear_all_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.generate"))
):
    """Delete all security compliance reports."""
    result = await db.execute(select(SecurityReport))
    reports = result.scalars().all()
    count = len(reports)
    for r in reports:
        if r.pdf_file_path:
            try:
                p = Path(r.pdf_file_path)
                if p.exists():
                    p.unlink(missing_ok=True)
            except Exception:
                pass
        await db.delete(r)

    await db.commit()
    return {"message": f"Cleared {count} reports"}

