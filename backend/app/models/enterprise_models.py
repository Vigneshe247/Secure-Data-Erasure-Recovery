"""
Enterprise Data Lifecycle & Governance Models
==============================================
Zero-Trust Data Lifecycle: ACTIVE → ADMIN_RECOVERABLE → PURGED
Blockchain-style tamper-evident audit ledger with SHA-256 hash chaining.

Architecture:
  - EnterpriseFile: core file lifecycle (quarantine-based recovery, NOT forensic carving)
  - RecoveryRequest: employee → admin recovery workflow
  - AuditBlock: tamper-evident hash chain (separate from but linked to AuditLog)
"""

import uuid
import hashlib
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    BigInteger,
    Float,
    DateTime,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from backend.app.database.session import Base


def _generate_uuid() -> str:
    return str(uuid.uuid4())


def _utc_now():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enterprise File — Core file lifecycle table
# ---------------------------------------------------------------------------

class EnterpriseFile(Base):
    __tablename__ = "enterprise_files"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    original_filename = Column(String(512), nullable=False)
    stored_filename = Column(String(512), nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # Explicit storage topology: separate active vs quarantine paths
    active_storage_path = Column(String(1024), nullable=True)       # Where the file lives when ACTIVE
    quarantine_storage_path = Column(String(1024), nullable=True)   # Where the file lives when ADMIN_RECOVERABLE
    storage_path = Column(String(1024), nullable=False)             # Current effective path

    # Source classification
    # ENTERPRISE_UPLOAD = employee uploaded file
    # SANDBOX_IMAGE = file from sandbox disk image
    # FORENSIC_CARVE = file recovered via forensic carving
    source_type = Column(String(32), nullable=False, default="ENTERPRISE_UPLOAD")

    file_size = Column(BigInteger, nullable=False, default=0)
    mime_type = Column(String(128), nullable=True)
    sha256_hash = Column(String(64), nullable=False)

    # Lifecycle status
    # Core: ACTIVE, ADMIN_RECOVERABLE, PURGED
    # Extended: RECOVERY_REQUESTED, RECOVERY_APPROVED, RECOVERED, PURGE_IN_PROGRESS, PURGE_VERIFIED
    status = Column(String(32), nullable=False, default="ACTIVE")

    # Deletion tracking
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    retention_expires_at = Column(DateTime, nullable=True)

    # Retention / Legal hold — blocks automated purge when True
    retention_hold = Column(Boolean, default=False)

    # Recovery tracking
    recovered_at = Column(DateTime, nullable=True)
    recovered_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Purge tracking
    purged_at = Column(DateTime, nullable=True)
    purged_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    erasure_method = Column(String(64), nullable=True)
    erasure_verified = Column(Boolean, default=False)

    # Linkage to existing forensic system
    erasure_operation_id = Column(String(36), ForeignKey("erasure_operations.id"), nullable=True)
    verification_result_id = Column(String(36), ForeignKey("verification_results.id"), nullable=True)

    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id], backref="enterprise_files")
    recovery_requests = relationship("RecoveryRequest", back_populates="file", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Recovery Request — Employee requests admin to recover a deleted file
# ---------------------------------------------------------------------------

class RecoveryRequest(Base):
    __tablename__ = "recovery_requests"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    file_id = Column(String(36), ForeignKey("enterprise_files.id"), nullable=False)
    employee_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=True)
    requested_at = Column(DateTime, default=_utc_now)

    # Review status: PENDING, APPROVED, REJECTED
    status = Column(String(32), nullable=False, default="PENDING")
    reviewed_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)

    # Relationships
    file = relationship("EnterpriseFile", back_populates="recovery_requests")
    employee = relationship("User", foreign_keys=[employee_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


# ---------------------------------------------------------------------------
# Audit Block — Blockchain-style tamper-evident hash chain
# ---------------------------------------------------------------------------

class AuditBlock(Base):
    __tablename__ = "audit_blocks"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    index = Column(Integer, nullable=False, unique=True, index=True)
    timestamp = Column(DateTime, default=_utc_now, nullable=False)
    event_type = Column(String(64), nullable=False)
    actor_id = Column(String(36), nullable=True)
    actor_role = Column(String(32), nullable=True)
    target_file_id = Column(String(36), nullable=True)
    target_user_id = Column(String(36), nullable=True)
    source_ip = Column(String(64), default="127.0.0.1")
    action_details = Column(Text, nullable=True)  # Canonical JSON (sorted keys)

    # Link to existing AuditLog for traceability
    audit_log_id = Column(String(36), ForeignKey("audit_logs.id"), nullable=True)

    # Hash chain
    previous_hash = Column(String(64), nullable=False)
    hash = Column(String(64), nullable=False)

    @staticmethod
    def compute_hash(
        index: int,
        timestamp_str: str,
        event_type: str,
        actor_id: str,
        target: str,
        previous_hash: str,
    ) -> str:
        """
        SHA-256( index + timestamp + event + actor + target + previous_hash )
        Deterministic: all inputs must be canonical strings.
        """
        payload = f"{index}{timestamp_str}{event_type}{actor_id}{target}{previous_hash}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
