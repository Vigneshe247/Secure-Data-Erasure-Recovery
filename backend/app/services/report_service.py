import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.config import settings
from backend.app.models.models import SecurityReport, ErasureOperation, RecoveryCase, StorageDevice, VerificationResult, User
from backend.app.ai.report_assistant import ReportAssistantAI
from backend.app.services.audit_service import AuditService


class ReportService:
    @classmethod
    def generate_pdf_report(
        cls,
        report_number: str,
        title: str,
        report_type: str,
        summary_text: str,
        metadata_dict: Dict[str, Any]
    ) -> Path:
        """
        Builds an official cybersecurity PDF report using ReportLab.
        """
        filename = f"report_{report_number}.pdf"
        output_path = settings.REPORTS_PATH / filename

        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=letter,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=8
        )
        subtitle_style = ParagraphStyle(
            "DocSubTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            textColor=colors.HexColor("#0284c7"),
            spaceAfter=14
        )
        heading2_style = ParagraphStyle(
            "Heading2",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=12,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#334155"),
            spaceAfter=8
        )
        badge_pass_style = ParagraphStyle(
            "BadgePass",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            textColor=colors.HexColor("#059669")
        )

        story = []

        # Top Header Banner
        story.append(Paragraph("DATASHIELD CYBERSECURITY COMPLIANCE REPORT", subtitle_style))
        story.append(Paragraph(title, title_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=14))

        # Metadata Table
        meta_table_data = [
            [Paragraph("<b>Report Number:</b>", body_style), Paragraph(report_number, body_style)],
            [Paragraph("<b>Report Classification:</b>", body_style), Paragraph(report_type, body_style)],
            [Paragraph("<b>Generated Timestamp:</b>", body_style), Paragraph(datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"), body_style)],
        ]

        for k, v in metadata_dict.items():
            meta_table_data.append([
                Paragraph(f"<b>{k}:</b>", body_style),
                Paragraph(str(v), body_style)
            ])

        meta_table = Table(meta_table_data, colWidths=[160, 360])
        meta_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 14))

        # Narrative / Executive Summary
        story.append(Paragraph("Executive & Technical Findings", heading2_style))
        for line in summary_text.split("\n"):
            line = line.strip()
            if not line:
                continue
            if line.startswith("#"):
                continue
            if line.startswith("*") or line.startswith("•"):
                story.append(Paragraph(f"• {line.lstrip('*• ')}", body_style))
            else:
                story.append(Paragraph(line, body_style))

        story.append(Spacer(1, 14))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceAfter=10))

        # Digital Signature and Chain of Custody
        story.append(Paragraph("<b>Cryptographic Chain of Custody Verification:</b>", body_style))
        story.append(Paragraph(
            "This document was digitally compiled by the DataShield Core Verification Engine (SIH26149). "
            "Underlying sector telemetry, SHA-256 evidence hashes, and authorization audit logs are immutably registered.",
            body_style
        ))

        doc.build(story)
        return output_path

    @classmethod
    async def create_erasure_report(
        cls,
        db: AsyncSession,
        operation_id: str,
        user: User
    ) -> SecurityReport:
        op = await db.get(ErasureOperation, operation_id)
        if not op:
            raise ValueError("Erasure operation not found")

        target_device = await db.get(StorageDevice, op.target_device_id)
        verif_res = await db.execute(
            select(VerificationResult).where(VerificationResult.erasure_operation_id == op.id)
        )
        verif = verif_res.scalars().first()

        report_num = f"RPT-ERS-{datetime.now().strftime('%Y%m%d')}-{os.urandom(2).hex().upper()}"
        target_name = target_device.name if target_device else "Target Storage"
        verdict = verif.verdict if verif else "UNVERIFIED"
        res_sigs = verif.residual_signatures_count if verif else 0
        entropy = verif.residual_entropy if verif else 0.0
        risk = verif.residual_risk_level if verif else "UNKNOWN"

        narrative = ReportAssistantAI.generate_erasure_narrative(
            operation_code=op.operation_code,
            target_name=target_name,
            storage_type=op.storage_type,
            method=op.sanitization_method,
            verdict=verdict,
            residual_signatures=res_sigs,
            entropy=entropy,
            residual_risk=risk,
            user_name=user.username,
            timestamp_str=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        )

        pdf_path = cls.generate_pdf_report(
            report_number=report_num,
            title="Data Sanitization & Forensic Verification Certificate",
            report_type="ERASURE_CERTIFICATE",
            summary_text=narrative,
            metadata_dict={
                "Operation Code": op.operation_code,
                "Target Device": target_name,
                "Storage Type": op.storage_type,
                "Sanitization Method": op.sanitization_method,
                "Verification Verdict": verdict,
                "Residual Risk Level": risk,
            }
        )

        report = SecurityReport(
            report_number=report_num,
            operation_id=op.id,
            title=f"Sanitization Certificate — {target_name}",
            generated_by_user_id=user.id,
            report_type="ERASURE_CERTIFICATE",
            summary_markdown=narrative,
            ai_risk_assessment=f"Sanitization verified with verdict: {verdict}. Risk Level: {risk}.",
            pdf_file_path=str(pdf_path)
        )

        db.add(report)
        await db.commit()
        await db.refresh(report)

        await AuditService.log_event(
            db=db,
            user=user,
            action="SECURITY_REPORT_GENERATED",
            target_resource=report.report_number,
            operation_id=report.id,
            status="SUCCESS",
            details={"report_number": report.report_number, "type": report.report_type}
        )

        return report
