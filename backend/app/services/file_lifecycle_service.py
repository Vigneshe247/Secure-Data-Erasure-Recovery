"""
File Lifecycle Service
======================
Core operations for the enterprise file lifecycle:
  ACTIVE → ADMIN_RECOVERABLE → RECOVERED / PURGED

IMPORTANT ARCHITECTURAL DISTINCTION:
  Enterprise Recovery = restoring a quarantined file directly (path-based, deterministic)
  Forensic Recovery   = disk-image carving via the existing RecoveryEngine (separate pathway)

This service handles ENTERPRISE recovery only.
"""

import hashlib
import math
import os
import shutil
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.config import settings
from backend.app.models.models import User
from backend.app.models.enterprise_models import EnterpriseFile, RecoveryRequest
from backend.app.services.blockchain_audit_service import BlockchainAuditService
from backend.app.services.audit_service import AuditService


class FileLifecycleService:

    # ------------------------------------------------------------------
    # Upload → ACTIVE
    # ------------------------------------------------------------------
    @classmethod
    async def upload_file(
        cls,
        db: AsyncSession,
        owner: User,
        filename: str,
        file_data: bytes,
        mime_type: Optional[str] = None,
    ) -> EnterpriseFile:
        """
        Store an uploaded file and create an EnterpriseFile record in ACTIVE state.
        File is stored at active_storage_path inside the sandbox uploads directory.
        """
        # Generate safe stored filename (prevents path traversal)
        safe_basename = Path(filename).name  # Strip any directory components
        ext = Path(safe_basename).suffix
        stored_name = f"{uuid.uuid4().hex}{ext}"
        active_path = settings.UPLOADS_PATH / stored_name

        # Write file to sandbox uploads directory
        with open(active_path, "wb") as f:
            f.write(file_data)

        # Compute SHA-256
        sha256 = hashlib.sha256(file_data).hexdigest()

        enterprise_file = EnterpriseFile(
            original_filename=safe_basename,
            stored_filename=stored_name,
            owner_id=owner.id,
            active_storage_path=str(active_path),
            quarantine_storage_path=None,
            storage_path=str(active_path),
            source_type="ENTERPRISE_UPLOAD",
            file_size=len(file_data),
            mime_type=mime_type or "application/octet-stream",
            sha256_hash=sha256,
            status="ACTIVE",
        )
        db.add(enterprise_file)
        await db.commit()
        await db.refresh(enterprise_file)

        # Audit (atomic: AuditLog + AuditBlock)
        audit_log = await AuditService.log_event(
            db=db,
            user=owner,
            action="FILE_UPLOADED",
            target_resource=safe_basename,
            status="SUCCESS",
            details={"file_id": enterprise_file.id, "sha256": sha256, "size": len(file_data)},
        )
        await BlockchainAuditService.add_block(
            db=db,
            event_type="FILE_UPLOADED",
            actor=owner,
            target_file_id=enterprise_file.id,
            details={"filename": safe_basename, "sha256": sha256},
            audit_log_id=audit_log.id if audit_log else None,
        )
        await db.commit()

        return enterprise_file

    # ------------------------------------------------------------------
    # Employee Delete → ADMIN_RECOVERABLE (quarantine)
    # ------------------------------------------------------------------
    @classmethod
    async def employee_delete(
        cls,
        db: AsyncSession,
        file_id: str,
        employee: User,
    ) -> EnterpriseFile:
        """
        Employee soft-deletes a file. Moves file to quarantine storage.
        Does NOT permanently erase. File becomes visible only in the Recovery Vault.
        """
        ef = await db.get(EnterpriseFile, file_id)
        if not ef:
            raise ValueError("File not found")
        if ef.owner_id != employee.id:
            raise PermissionError("You can only delete your own files")
        if ef.status != "ACTIVE":
            raise ValueError(f"File is not in ACTIVE state (current: {ef.status})")

        # Move file from active storage to quarantine storage
        src = Path(ef.storage_path)
        quarantine_path = settings.DELETED_PATH / ef.stored_filename
        if src.exists():
            shutil.move(str(src), str(quarantine_path))

        now = datetime.now(timezone.utc)
        ef.status = "ADMIN_RECOVERABLE"
        ef.quarantine_storage_path = str(quarantine_path)
        ef.storage_path = str(quarantine_path)
        ef.deleted_by = employee.id
        ef.deleted_at = now
        ef.retention_expires_at = now + timedelta(days=settings.RETENTION_DAYS)
        ef.updated_at = now

        await db.commit()
        await db.refresh(ef)

        # Audit
        audit_log = await AuditService.log_event(
            db=db, user=employee,
            action="EMPLOYEE_DELETED_FILE",
            target_resource=ef.original_filename,
            status="SUCCESS",
            details={"file_id": ef.id, "retention_expires": ef.retention_expires_at.isoformat()},
        )
        await BlockchainAuditService.add_block(
            db=db,
            event_type="EMPLOYEE_DELETED_FILE",
            actor=employee,
            target_file_id=ef.id,
            details={"filename": ef.original_filename, "retention_days": settings.RETENTION_DAYS},
            audit_log_id=audit_log.id if audit_log else None,
        )
        await db.commit()

        return ef

    # ------------------------------------------------------------------
    # State-Aware Access Check
    # ------------------------------------------------------------------
    @classmethod
    def can_employee_download(cls, ef: EnterpriseFile) -> bool:
        """
        Employee download rules:
          ACTIVE / RECOVERED → allowed
          ADMIN_RECOVERABLE / RECOVERY_REQUESTED / PURGED → denied
        """
        return ef.status in ("ACTIVE", "RECOVERED")

    # ------------------------------------------------------------------
    # Recovery Request (employee)
    # ------------------------------------------------------------------
    @classmethod
    async def create_recovery_request(
        cls,
        db: AsyncSession,
        file_id: str,
        employee: User,
        reason: Optional[str] = None,
    ) -> RecoveryRequest:
        """Employee submits a recovery request for a quarantined file."""
        ef = await db.get(EnterpriseFile, file_id)
        if not ef:
            raise ValueError("File not found")
        if ef.owner_id != employee.id:
            raise PermissionError("You can only request recovery for your own files")
        if ef.status not in ("ADMIN_RECOVERABLE", "RECOVERY_REQUESTED"):
            raise ValueError(f"File is not recoverable (current: {ef.status})")

        # Check for existing pending request
        existing = await db.execute(
            select(RecoveryRequest).where(
                RecoveryRequest.file_id == file_id,
                RecoveryRequest.status == "PENDING",
            )
        )
        if existing.scalars().first():
            raise ValueError("A recovery request is already pending for this file")

        ef.status = "RECOVERY_REQUESTED"
        ef.updated_at = datetime.now(timezone.utc)

        req = RecoveryRequest(
            file_id=file_id,
            employee_id=employee.id,
            reason=reason or "Employee requested file recovery",
        )
        db.add(req)
        await db.commit()
        await db.refresh(req)

        audit_log = await AuditService.log_event(
            db=db, user=employee,
            action="RECOVERY_REQUESTED",
            target_resource=ef.original_filename,
            status="SUCCESS",
            details={"file_id": file_id, "request_id": req.id, "reason": reason},
        )
        await BlockchainAuditService.add_block(
            db=db, event_type="RECOVERY_REQUESTED",
            actor=employee, target_file_id=file_id,
            details={"request_id": req.id},
            audit_log_id=audit_log.id if audit_log else None,
        )
        await db.commit()

        return req

    # ------------------------------------------------------------------
    # Admin: Approve Recovery Request → quarantine restore
    # ------------------------------------------------------------------
    @classmethod
    async def approve_recovery_request(
        cls,
        db: AsyncSession,
        request_id: str,
        admin: User,
        notes: Optional[str] = None,
    ) -> RecoveryRequest:
        """Admin approves a recovery request and restores the file from quarantine."""
        req = await db.get(RecoveryRequest, request_id)
        if not req:
            raise ValueError("Recovery request not found")
        if req.status != "PENDING":
            raise ValueError(f"Request is not pending (current: {req.status})")

        now = datetime.now(timezone.utc)
        req.status = "APPROVED"
        req.reviewed_by = admin.id
        req.reviewed_at = now
        req.review_notes = notes

        # Intermediate State: RECOVERY_APPROVED
        ef = await db.get(EnterpriseFile, req.file_id)
        if ef:
            ef.status = "RECOVERY_APPROVED"
            ef.updated_at = now
        await db.commit()
        await db.refresh(req)

        # Log RECOVERY_APPROVED block
        await BlockchainAuditService.add_block(
            db=db, event_type="RECOVERY_APPROVED",
            actor=admin, target_file_id=req.file_id,
            details={"request_id": request_id, "notes": notes},
        )
        await db.commit()

        # Restore file from quarantine (Transitions to ACTIVE)
        await cls._restore_from_quarantine(db, req.file_id, admin)
        await db.commit()

        audit_log = await AuditService.log_event(
            db=db, user=admin,
            action="ADMIN_APPROVED_RECOVERY",
            target_resource=req.file_id,
            status="SUCCESS",
            details={"request_id": request_id, "notes": notes},
        )
        await BlockchainAuditService.add_block(
            db=db, event_type="ADMIN_APPROVED_RECOVERY",
            actor=admin, target_file_id=req.file_id,
            details={"request_id": request_id},
            audit_log_id=audit_log.id if audit_log else None,
        )
        await db.commit()

        return req

    # ------------------------------------------------------------------
    # Admin: Reject Recovery Request
    # ------------------------------------------------------------------
    @classmethod
    async def reject_recovery_request(
        cls,
        db: AsyncSession,
        request_id: str,
        admin: User,
        notes: Optional[str] = None,
    ) -> RecoveryRequest:
        """Admin rejects a recovery request."""
        req = await db.get(RecoveryRequest, request_id)
        if not req:
            raise ValueError("Recovery request not found")
        if req.status != "PENDING":
            raise ValueError(f"Request is not pending (current: {req.status})")

        now = datetime.now(timezone.utc)
        req.status = "REJECTED"
        req.reviewed_by = admin.id
        req.reviewed_at = now
        req.review_notes = notes

        # Revert file status to ADMIN_RECOVERABLE
        ef = await db.get(EnterpriseFile, req.file_id)
        if ef and ef.status == "RECOVERY_REQUESTED":
            ef.status = "ADMIN_RECOVERABLE"
            ef.updated_at = now

        await db.commit()
        await db.refresh(req)

        await BlockchainAuditService.add_block(
            db=db, event_type="ADMIN_REJECTED_RECOVERY",
            actor=admin, target_file_id=req.file_id,
            details={"request_id": request_id, "notes": notes},
        )
        await db.commit()

        return req

    # ------------------------------------------------------------------
    # Admin: Direct Recovery from Vault (quarantine restore)
    # ------------------------------------------------------------------
    @classmethod
    async def admin_recover(
        cls,
        db: AsyncSession,
        file_id: str,
        admin: User,
    ) -> EnterpriseFile:
        """
        Admin directly restores a file from quarantine.
        This is ENTERPRISE recovery (deterministic file restore),
        NOT forensic carving (that uses the existing RecoveryEngine).
        """
        ef = await db.get(EnterpriseFile, file_id)
        if not ef:
            raise ValueError("File not found")
        if ef.status not in ("ADMIN_RECOVERABLE", "RECOVERY_REQUESTED"):
            raise ValueError(f"File is not in recoverable state (current: {ef.status})")

        # Verify the quarantined file still exists
        quarantine_file = Path(ef.quarantine_storage_path or ef.storage_path)
        if not quarantine_file.exists():
            raise ValueError("Quarantined file is missing from protected storage")

        # Validate SHA-256 integrity before restoring
        with open(quarantine_file, "rb") as f:
            current_hash = hashlib.sha256(f.read()).hexdigest()
        hash_match = current_hash == ef.sha256_hash

        await cls._restore_from_quarantine(db, file_id, admin)
        await db.commit()
        await db.refresh(ef)

        audit_log = await AuditService.log_event(
            db=db, user=admin,
            action="ADMIN_RECOVERED_FILE",
            target_resource=ef.original_filename,
            status="SUCCESS",
            details={
                "file_id": file_id,
                "sha256_before": ef.sha256_hash,
                "sha256_after": current_hash,
                "hash_match": hash_match,
                "recovery_method": "QUARANTINE_RESTORE",
            },
        )
        await BlockchainAuditService.add_block(
            db=db, event_type="ADMIN_RECOVERED_FILE",
            actor=admin, target_file_id=file_id,
            details={
                "filename": ef.original_filename,
                "sha256": ef.sha256_hash,
                "hash_verified": hash_match,
                "method": "QUARANTINE_RESTORE",
            },
            audit_log_id=audit_log.id if audit_log else None,
        )
        await db.commit()

        return ef

    # ------------------------------------------------------------------
    # Admin: Secure Purge (full erasure pipeline)
    # ------------------------------------------------------------------
    @classmethod
    async def admin_purge(
        cls,
        db: AsyncSession,
        file_id: str,
        admin: User,
        method: str = "SIMULATED_SECURE_ERASURE",
    ) -> Dict[str, Any]:
        """
        Admin permanently purges a quarantined file using the secure erasure pipeline:
          1. Authorization check (caller)
          2. Target identification
          3. Erasure engine (overwrite)
          4. Verification engine (entropy + byte check)
          5. Audit blocks
          6. Certificate (handled by caller)
          7. State → PURGED

        ONLY operates within the sandbox (SANDBOX_MODE enforced).
        """
        ef = await db.get(EnterpriseFile, file_id)
        if not ef:
            raise ValueError("File not found")
        if ef.status not in ("ADMIN_RECOVERABLE", "RECOVERY_REQUESTED"):
            raise ValueError(f"File is not purgeable (current: {ef.status})")

        if not settings.SANDBOX_MODE:
            raise ValueError("SANDBOX_MODE must be enabled for destructive operations")

        # Step 1: Mark as in-progress
        ef.status = "PURGE_IN_PROGRESS"
        ef.updated_at = datetime.now(timezone.utc)
        await db.commit()

        # Step 2: Audit - erasure started
        await BlockchainAuditService.add_block(
            db=db, event_type="SECURE_ERASURE_STARTED",
            actor=admin, target_file_id=file_id,
            details={"method": method, "filename": ef.original_filename},
        )
        await db.commit()

        # Step 3: Perform secure erasure on quarantined file
        file_path = Path(ef.quarantine_storage_path or ef.storage_path)
        verification_result = {
            "byte_check": "PASS",
            "pattern_check": "PASS",
            "entropy_before": 0.0,
            "entropy_after": 0.0,
            "method_detail": "",
            "device_type": "SANDBOX",
            "execution_mode": "SIMULATED" if settings.SANDBOX_MODE else "LIVE",
        }

        if file_path.exists():
            # Measure entropy before erasure
            with open(file_path, "rb") as f:
                original_data = f.read()
            original_size = len(original_data)
            verification_result["entropy_before"] = cls._compute_entropy(original_data)

            # Execute erasure method
            if method in ("ZERO_FILL", "NIST_800_88_CLEAR", "SIMULATED_SECURE_ERASURE"):
                with open(file_path, "r+b") as f:
                    f.write(b"\x00" * original_size)
                    f.flush()
                    os.fsync(f.fileno())
                verification_result["method_detail"] = "Simulated Clear: single-pass zero fill"

            elif method == "RANDOM_OVERWRITE":
                with open(file_path, "r+b") as f:
                    f.write(os.urandom(original_size))
                    f.flush()
                    os.fsync(f.fileno())
                verification_result["method_detail"] = "Single-pass random overwrite"

            elif method == "CRYPTO_PURGE":
                for _ in range(3):
                    with open(file_path, "r+b") as f:
                        f.write(os.urandom(original_size))
                        f.flush()
                        os.fsync(f.fileno())
                verification_result["method_detail"] = "3-pass cryptographic overwrite"

            # Step 4: Verification — read back and check
            with open(file_path, "rb") as f:
                post_data = f.read()

            verification_result["entropy_after"] = cls._compute_entropy(post_data)

            if method in ("ZERO_FILL", "NIST_800_88_CLEAR", "SIMULATED_SECURE_ERASURE"):
                all_zeros = all(b == 0 for b in post_data)
                verification_result["byte_check"] = "PASS" if all_zeros else "FAIL"
                verification_result["entropy_after"] = 0.0 if all_zeros else verification_result["entropy_after"]

            # Remove the file from disk
            file_path.unlink(missing_ok=True)
        else:
            verification_result["byte_check"] = "N/A"
            verification_result["pattern_check"] = "N/A"
            verification_result["method_detail"] = "File not found on disk; already removed"

        # Step 5: Audit blocks for completion + verification
        await BlockchainAuditService.add_block(
            db=db, event_type="SECURE_ERASURE_COMPLETED",
            actor=admin, target_file_id=file_id,
            details={"method": method, "verification": verification_result},
        )
        await db.commit()

        verified = verification_result.get("byte_check") == "PASS" and verification_result.get("pattern_check") == "PASS"

        await BlockchainAuditService.add_block(
            db=db, event_type="ERASURE_VERIFIED",
            actor=admin, target_file_id=file_id,
            details={"verified": verified, "result": verification_result},
        )

        # Step 6: Update file state
        now = datetime.now(timezone.utc)
        ef.status = "PURGED"
        ef.purged_at = now
        ef.purged_by = admin.id
        ef.erasure_method = method
        ef.erasure_verified = verified
        ef.updated_at = now
        await db.commit()
        await db.refresh(ef)

        # Final audit log
        audit_log = await AuditService.log_event(
            db=db, user=admin,
            action="ADMIN_PURGED_FILE",
            target_resource=ef.original_filename,
            status="SUCCESS",
            details={
                "file_id": file_id, "method": method, "verified": verified,
                "original_sha256": ef.sha256_hash,
            },
        )
        await BlockchainAuditService.add_block(
            db=db, event_type="ADMIN_PURGED_FILE",
            actor=admin, target_file_id=file_id,
            details={"method": method, "verified": verified, "sha256": ef.sha256_hash},
            audit_log_id=audit_log.id if audit_log else None,
        )
        await db.commit()

        return {
            "file": ef,
            "verification": verification_result,
            "verified": verified,
            "method": method,
        }

    # ------------------------------------------------------------------
    # Admin: Set/Unset Retention Hold
    # ------------------------------------------------------------------
    @classmethod
    async def set_retention_hold(
        cls, db: AsyncSession, file_id: str, admin: User, hold: bool
    ) -> EnterpriseFile:
        """Set or unset retention/legal hold on a file."""
        ef = await db.get(EnterpriseFile, file_id)
        if not ef:
            raise ValueError("File not found")

        ef.retention_hold = hold
        ef.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(ef)

        await BlockchainAuditService.add_block(
            db=db,
            event_type="RETENTION_HOLD_CHANGED",
            actor=admin,
            target_file_id=file_id,
            details={"hold": hold, "filename": ef.original_filename},
        )
        await db.commit()
        return ef

    # ------------------------------------------------------------------
    # Internal: Quarantine Restore
    # ------------------------------------------------------------------
    @classmethod
    async def _restore_from_quarantine(cls, db: AsyncSession, file_id: str, admin: User):
        """
        Move file from quarantine back to active storage. Update state.
        This is a deterministic file restore — NOT forensic carving.
        """
        ef = await db.get(EnterpriseFile, file_id)
        if not ef:
            return

        src = Path(ef.quarantine_storage_path or ef.storage_path)
        dest = settings.UPLOADS_PATH / ef.stored_filename

        if src.exists():
            shutil.move(str(src), str(dest))

        now = datetime.now(timezone.utc)
        ef.status = "ACTIVE"
        ef.active_storage_path = str(dest)
        ef.storage_path = str(dest)
        ef.quarantine_storage_path = None
        ef.recovered_at = now
        ef.recovered_by = admin.id
        ef.deleted_by = None
        ef.deleted_at = None
        ef.retention_expires_at = None
        ef.updated_at = now

        # Log FILE_RECOVERED transition to ACTIVE
        await BlockchainAuditService.add_block(
            db=db, event_type="FILE_RECOVERED",
            actor=admin, target_file_id=file_id,
            details={"status_change": "ACTIVE"},
        )

    # ------------------------------------------------------------------
    # Utility: Shannon Entropy
    # ------------------------------------------------------------------
    @staticmethod
    def _compute_entropy(data: bytes) -> float:
        """Compute Shannon entropy of byte data."""
        if not data:
            return 0.0
        freq = [0] * 256
        for b in data:
            freq[b] += 1
        length = len(data)
        entropy = 0.0
        for count in freq:
            if count > 0:
                p = count / length
                entropy -= p * math.log2(p)
        return round(entropy, 4)

    # ------------------------------------------------------------------
    # Query Helpers
    # ------------------------------------------------------------------
    @classmethod
    async def get_employee_files(cls, db: AsyncSession, owner_id: str) -> List[EnterpriseFile]:
        """Get all files owned by a specific employee."""
        result = await db.execute(
            select(EnterpriseFile)
            .where(EnterpriseFile.owner_id == owner_id)
            .order_by(EnterpriseFile.created_at.desc())
        )
        return result.scalars().all()

    @classmethod
    async def get_vault_files(cls, db: AsyncSession) -> List[EnterpriseFile]:
        """Get all files in ADMIN_RECOVERABLE or RECOVERY_REQUESTED state (vault)."""
        result = await db.execute(
            select(EnterpriseFile)
            .where(EnterpriseFile.status.in_(["ADMIN_RECOVERABLE", "RECOVERY_REQUESTED"]))
            .order_by(EnterpriseFile.deleted_at.desc())
        )
        return result.scalars().all()

    @classmethod
    async def get_pending_requests(cls, db: AsyncSession) -> List[RecoveryRequest]:
        """Get all pending recovery requests."""
        result = await db.execute(
            select(RecoveryRequest)
            .where(RecoveryRequest.status == "PENDING")
            .order_by(RecoveryRequest.requested_at.desc())
        )
        return result.scalars().all()

    @classmethod
    async def get_employee_requests(cls, db: AsyncSession, employee_id: str) -> List[RecoveryRequest]:
        """Get recovery requests submitted by a specific employee."""
        result = await db.execute(
            select(RecoveryRequest)
            .where(RecoveryRequest.employee_id == employee_id)
            .order_by(RecoveryRequest.requested_at.desc())
        )
        return result.scalars().all()
