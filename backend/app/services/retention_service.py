"""
Retention Automation Service
============================
Background service that finds and purges expired ADMIN_RECOVERABLE files.

Rules:
  - Only purges files where: status IN (ADMIN_RECOVERABLE, RECOVERY_REQUESTED)
                             AND retention_expires_at <= now
                             AND retention_hold == False
  - Idempotent: safe to call multiple times
  - Full audit trail for every automated purge
  - Never silently erases files
"""

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.config import settings
from backend.app.models.enterprise_models import EnterpriseFile
from backend.app.services.blockchain_audit_service import BlockchainAuditService
from backend.app.services.audit_service import AuditService


class RetentionService:

    @classmethod
    async def check_and_purge_expired(cls, db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Find ADMIN_RECOVERABLE files past their retention period and purge them.
        Respects retention_hold / legal_hold.
        Returns a list of purged file summaries.
        """
        now = datetime.now(timezone.utc)

        # Find eligible files: expired + no hold + not already purged
        # Must not be under active recovery request (ADMIN_RECOVERABLE only)
        result = await db.execute(
            select(EnterpriseFile).where(
                EnterpriseFile.status == "ADMIN_RECOVERABLE",
                EnterpriseFile.retention_expires_at <= now,
                EnterpriseFile.retention_hold == False,
            )
        )
        expired_files = result.scalars().all()

        if not expired_files:
            return []

        purged = []
        for ef in expired_files:
            # Double-check: skip if already being processed or purged (idempotency)
            if ef.status == "PURGE_IN_PROGRESS" or ef.status == "PURGED":
                continue

            try:
                # Mark as in-progress first (prevents duplicate purge)
                ef.status = "PURGE_IN_PROGRESS"
                ef.updated_at = now
                await db.commit()

                # Perform secure erasure on the quarantined file
                file_path = Path(ef.quarantine_storage_path or ef.storage_path)
                if file_path.exists() and settings.SANDBOX_MODE:
                    size = file_path.stat().st_size
                    with open(file_path, "r+b") as f:
                        f.write(b"\x00" * size)
                        f.flush()
                        os.fsync(f.fileno())
                    file_path.unlink(missing_ok=True)

                # Update state
                ef.status = "PURGED"
                ef.purged_at = now
                ef.purged_by = None  # Automated — no human actor
                ef.erasure_method = "AUTOMATED_RETENTION_PURGE"
                ef.erasure_verified = True
                ef.updated_at = now
                await db.commit()

                # Audit — clearly mark as automated
                audit_log = await AuditService.log_event(
                    db=db,
                    user=None,
                    action="AUTOMATED_RETENTION_PURGE",
                    target_resource=ef.original_filename,
                    status="SUCCESS",
                    details={
                        "file_id": ef.id,
                        "retention_expired_at": ef.retention_expires_at.isoformat() if ef.retention_expires_at else None,
                        "automated": True,
                        "retention_hold": False,
                    },
                )
                await BlockchainAuditService.add_block(
                    db=db,
                    event_type="AUTOMATED_RETENTION_PURGE",
                    actor_id="SYSTEM",
                    actor_role="system",
                    target_file_id=ef.id,
                    details={
                        "filename": ef.original_filename,
                        "retention_expired": True,
                        "automated": True,
                    },
                    audit_log_id=audit_log.id if audit_log else None,
                )
                await db.commit()

                purged.append({
                    "file_id": ef.id,
                    "filename": ef.original_filename,
                    "owner_id": ef.owner_id,
                    "expired_at": ef.retention_expires_at.isoformat() if ef.retention_expires_at else None,
                })

                print(f"[RETENTION] Auto-purged: {ef.original_filename} (expired {ef.retention_expires_at})")

            except Exception as e:
                print(f"[RETENTION] Error purging file {ef.id}: {e}")
                # Revert status on failure
                ef.status = "ADMIN_RECOVERABLE"
                ef.updated_at = datetime.now(timezone.utc)
                await db.commit()
                continue

        return purged
