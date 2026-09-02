import os
import sys
import json
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.database.session import sync_engine, Base, SyncSessionLocal
from backend.app.models.models import (
    User,
    StorageDevice,
    RecoveryCase,
    RecoveryCandidate,
    ErasureOperation,
    VerificationResult,
    AuditLog,
    SecurityReport
)
from backend.app.core.security import get_password_hash
from backend.app.services.storage_analyzer import StorageAnalyzerService
from backend.app.services.recovery_engine import RecoveryEngineService
from backend.app.services.report_service import ReportService
from backend.app.ai.recovery_confidence import RecoveryConfidenceAI
from backend.app.ai.residual_risk import ResidualRiskAI


def seed_initial_data():
    # Ensure tables exist
    Base.metadata.create_all(bind=sync_engine)

    session = SyncSessionLocal()
    try:
        # 1. Seed 5 Distinct RBAC Users
        users_data = [
            {
                "username": "admin",
                "email": "admin@datashield.sih",
                "password": "adminpassword123",
                "role": "admin",
                "full_name": "Chief Security Architect (Admin)"
            },
            {
                "username": "security_admin",
                "email": "it_sec@datashield.sih",
                "password": "secadminpass123",
                "role": "security_admin",
                "full_name": "IT & Infrastructure SecOps"
            },
            {
                "username": "forensic_analyst",
                "email": "analyst@datashield.sih",
                "password": "analystpass123",
                "role": "forensic_analyst",
                "full_name": "Digital Forensics Lead"
            },
            {
                "username": "auditor",
                "email": "compliance@datashield.sih",
                "password": "auditorpass123",
                "role": "auditor",
                "full_name": "Independent Security Auditor"
            },
            {
                "username": "demo_user",
                "email": "judge@sih2026.gov.in",
                "password": "demouserpass123",
                "role": "demo_user",
                "full_name": "SIH 2026 Evaluation Judge"
            },
        ]

        created_users = {}
        for u in users_data:
            existing = session.query(User).filter_by(username=u["username"]).first()
            if not existing:
                user_obj = User(
                    username=u["username"],
                    email=u["email"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"],
                    full_name=u["full_name"],
                    is_active=True
                )
                session.add(user_obj)
                session.commit()
                session.refresh(user_obj)
                created_users[u["username"]] = user_obj
            else:
                created_users[u["username"]] = existing

        # 2. Seed Storage Devices
        demo_nvme_path = StorageAnalyzerService.ensure_sandbox_image("demo_ssd_sandbox.img", size_mb=32)
        demo_hdd_path = StorageAnalyzerService.ensure_sandbox_image("demo_hdd_sandbox.img", size_mb=16)

        # Write sample binary files into sandbox
        RecoveryEngineService.populate_sandbox_deleted_files(demo_nvme_path)
        RecoveryEngineService.populate_sandbox_deleted_files(demo_hdd_path)

        dev_nvme = session.query(StorageDevice).filter_by(name="Safe Demo Storage A (NVMe Sandbox)").first()
        if not dev_nvme:
            dev_nvme = StorageDevice(
                name="Safe Demo Storage A (NVMe Sandbox)",
                device_path=str(demo_nvme_path),
                storage_type="NVME",
                filesystem="NTFS",
                total_capacity_bytes=32 * 1024 * 1024,
                used_capacity_bytes=18 * 1024 * 1024,
                is_sandbox=True,
                trim_supported=True,
                ftl_aware=True,
                health_status="OPTIMAL",
                risk_level="MEDIUM",
                metadata_json=json.dumps({
                    "controller": "DataShield Virtual NVMe FTL Controller v2.1",
                    "wear_leveling_status": "Active (Dynamic + Static)",
                    "ftl_table_entries": 65536,
                    "over_provisioning_pct": 7.0,
                    "trim_state": "Enabled",
                    "sandbox_mode": True
                })
            )
            session.add(dev_nvme)

        dev_hdd = session.query(StorageDevice).filter_by(name="Safe Demo Storage B (Magnetic HDD Sandbox)").first()
        if not dev_hdd:
            dev_hdd = StorageDevice(
                name="Safe Demo Storage B (Magnetic HDD Sandbox)",
                device_path=str(demo_hdd_path),
                storage_type="HDD",
                filesystem="EXT4",
                total_capacity_bytes=16 * 1024 * 1024,
                used_capacity_bytes=9 * 1024 * 1024,
                is_sandbox=True,
                trim_supported=False,
                ftl_aware=False,
                health_status="HEALTHY",
                risk_level="LOW",
                metadata_json=json.dumps({
                    "rotational_speed_rpm": 7200,
                    "sector_size_bytes": 512,
                    "bad_sectors_count": 0,
                    "wear_leveling_status": "N/A (Magnetic Platter)",
                    "sandbox_mode": True
                })
            )
            session.add(dev_hdd)

        session.commit()
        session.refresh(dev_nvme)
        session.refresh(dev_hdd)

        # 3. Seed Sample Recovery Case & Candidates
        analyst_user = created_users.get("forensic_analyst", created_users["admin"])
        sample_case = session.query(RecoveryCase).filter_by(case_number="CASE-2026-00127").first()
        if not sample_case:
            sample_case = RecoveryCase(
                case_number="CASE-2026-00127",
                title="Authorized Incident Triage: Financial Audit Leak",
                created_by_user_id=analyst_user.id,
                target_device_id=dev_nvme.id,
                status="RESULTS_READY",
                total_candidates=6,
                recovered_count=3,
                notes="Authorized forensic case under SIH-26149 triage guidelines."
            )
            session.add(sample_case)
            session.commit()
            session.refresh(sample_case)

            # Add sample candidate files
            demo_candidates = [
                ("financial_audit_2026.jpg", "JPG", 65536, 4829104, 100.0, 92.0, 95.0, 97.0, "PASS", "RECOVERED"),
                ("infrastructure_diagram.png", "PNG", 262144, 1284920, 100.0, 89.0, 94.0, 98.0, "PASS", "RECOVERED"),
                ("court_subpoena_case_09.pdf", "PDF", 524288, 842100, 100.0, 96.0, 98.0, 99.0, "PASS", "RECOVERED"),
                ("project_specification_sih.docx", "DOCX", 1048576, 2194300, 92.0, 78.0, 82.0, 86.0, "PARTIAL", "DETECTED"),
                ("encrypted_db_backup.zip", "ZIP", 2097152, 14280000, 100.0, 91.0, 93.0, 95.0, "PASS", "DETECTED"),
                ("corrupted_surveillance_frame.jpg", "JPG", 3145728, 394200, 55.0, 28.0, 40.0, 42.0, "CORRUPT", "DETECTED"),
            ]

            for fname, fmt, offset, fsize, sig_p, meta_p, cont_p, struct_p, integ, rec_status in demo_candidates:
                score, level, explanation = RecoveryConfidenceAI.evaluate_candidate(
                    detected_format=fmt,
                    signature_match_pct=sig_p,
                    structure_validity_pct=struct_p,
                    continuity_pct=cont_p,
                    metadata_quality_pct=meta_p,
                    file_size_bytes=fsize,
                    integrity_status=integ
                )
                cand = RecoveryCandidate(
                    case_id=sample_case.id,
                    file_name=fname,
                    detected_format=fmt,
                    byte_offset=offset,
                    file_size_bytes=fsize,
                    signature_match_pct=sig_p,
                    metadata_quality_pct=meta_p,
                    continuity_pct=cont_p,
                    structure_validity_pct=struct_p,
                    confidence_score=score,
                    confidence_level=level,
                    integrity_status=integ,
                    recovery_status=rec_status,
                    ai_explanation=explanation
                )
                session.add(cand)
            session.commit()

        # 4. Seed Completed Sanitization & Verification Operation
        sec_user = created_users.get("security_admin", created_users["admin"])
        admin_user = created_users["admin"]

        sample_op = session.query(ErasureOperation).filter_by(operation_code="ERS-2026-9901").first()
        if not sample_op:
            sample_op = ErasureOperation(
                operation_code="ERS-2026-9901",
                target_device_id=dev_hdd.id,
                target_scope="FREE_SPACE",
                storage_type="HDD",
                sanitization_method="NIST_800_88_CLEAR",
                requested_by_user_id=sec_user.id,
                approved_by_user_id=admin_user.id,
                status="VERIFIED",
                passes_completed=1,
                total_passes=1,
                progress_pct=100.0,
                confirmation_phrase="ERASE SAFE DEMO STORAGE B",
                ai_risk_assessment_json=json.dumps({
                    "storage_type": "HDD",
                    "ftl_aware": False,
                    "compliance": "NIST SP 800-88 Rev. 1 (Clear)",
                    "risk_assessment": "Low risk. Complete magnetic domain alignment achieved."
                }),
                started_at=datetime.now(timezone.utc) - timedelta(hours=2),
                completed_at=datetime.now(timezone.utc) - timedelta(hours=1, minutes=58)
            )
            session.add(sample_op)
            session.commit()
            session.refresh(sample_op)

            sample_verif = VerificationResult(
                erasure_operation_id=sample_op.id,
                target_device_id=dev_hdd.id,
                residual_signatures_count=0,
                recoverable_objects_count=0,
                residual_entropy=0.0000,
                controlled_recovery_successes=0,
                verdict="PASSED",
                residual_risk_level="LOW",
                evidence_summary=(
                    "VERIFICATION PASSED: 0 residual signatures detected across 100% of sampled storage blocks. "
                    "Controlled forensic recovery probe yielded 0 successful extractions. "
                    "Sector Shannon entropy is 0.0000. Meets NIST SP 800-88 compliance."
                ),
                verified_by_user_id=admin_user.id,
            )
            session.add(sample_verif)
            session.commit()

            # Generate ReportLab PDF for this operation
            pdf_path = ReportService.generate_pdf_report(
                report_number="RPT-ERS-20260902-88FA",
                title="Data Sanitization & Forensic Verification Certificate",
                report_type="ERASURE_CERTIFICATE",
                summary_text=sample_verif.evidence_summary,
                metadata_dict={
                    "Operation Code": sample_op.operation_code,
                    "Target Device": dev_hdd.name,
                    "Storage Type": sample_op.storage_type,
                    "Sanitization Method": sample_op.sanitization_method,
                    "Verification Verdict": sample_verif.verdict,
                    "Residual Risk Level": sample_verif.residual_risk_level,
                }
            )

            report_obj = SecurityReport(
                report_number="RPT-ERS-20260902-88FA",
                operation_id=sample_op.id,
                title=f"Sanitization Certificate — {dev_hdd.name}",
                generated_by_user_id=admin_user.id,
                report_type="ERASURE_CERTIFICATE",
                summary_markdown=sample_verif.evidence_summary,
                ai_risk_assessment="Sanitization verified with verdict: PASSED. Residual risk is LOW.",
                pdf_file_path=str(pdf_path)
            )
            session.add(report_obj)
            session.commit()

        # 5. Seed Audit Logs
        if session.query(AuditLog).count() == 0:
            sample_logs = [
                ("admin", "admin", "SYSTEM_INITIALIZED", "DataShield Core", "SUCCESS", {}),
                ("forensic_analyst", "forensic_analyst", "RECOVERY_CASE_CREATED", "CASE-2026-00127", "SUCCESS", {"target": "Safe Demo Storage A"}),
                ("forensic_analyst", "forensic_analyst", "RECOVERY_SCAN_COMPLETED", "Safe Demo Storage A", "SUCCESS", {"candidates_found": 6}),
                ("forensic_analyst", "forensic_analyst", "FILE_RECOVERED_SUCCESSFULLY", "court_subpoena_case_09.pdf", "SUCCESS", {"sha256": "3fa85f64c9d34f..."}),
                ("security_admin", "security_admin", "ERASURE_REQUESTED", "Safe Demo Storage B", "PENDING", {"method": "NIST_800_88_CLEAR"}),
                ("admin", "admin", "ERASURE_APPROVED", "ERS-2026-9901", "SUCCESS", {"approved_by": "admin"}),
                ("security_admin", "security_admin", "ERASURE_SANITIZATION_COMPLETED", "Safe Demo Storage B", "SUCCESS", {"passes": 1}),
                ("admin", "admin", "VERIFICATION_COMPLETED", "Safe Demo Storage B -> PASSED", "SUCCESS", {"verdict": "PASSED", "entropy": 0.0}),
                ("admin", "admin", "SECURITY_REPORT_GENERATED", "RPT-ERS-20260902-88FA", "SUCCESS", {"type": "ERASURE_CERTIFICATE"}),
            ]

            for uname, role, act, target, stat, det in sample_logs:
                ts = datetime.now(timezone.utc).isoformat()
                d_str = json.dumps(det, sort_keys=True)
                payload = f"{ts}|{uname}|{act}|{target}|{stat}|{d_str}"
                chk = hashlib.sha256(payload.encode("utf-8")).hexdigest()

                audit_entry = AuditLog(
                    username=uname,
                    role=role,
                    action=act,
                    target_resource=target,
                    status=stat,
                    details_json=d_str,
                    sha256_checksum=chk
                )
                session.add(audit_entry)
            session.commit()

        print("[+] DataShield Seed Data Successfully Initialized!")
        print("Demo Credentials:")
        print("  1. Administrator:         admin / adminpassword123")
        print("  2. IT/Security Admin:     security_admin / secadminpass123")
        print("  3. Forensic Analyst:      forensic_analyst / analystpass123")
        print("  4. Auditor / Viewer:      auditor / auditorpass123")
        print("  5. SIH Demo User:         demo_user / demouserpass123")

    except Exception as e:
        session.rollback()
        print(f"Error seeding data: {e}")
        raise e
    finally:
        session.close()


if __name__ == "__main__":
    seed_initial_data()
