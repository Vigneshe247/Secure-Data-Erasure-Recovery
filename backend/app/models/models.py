import uuid
from datetime import datetime, timezone
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


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(128), unique=True, index=True, nullable=False)
    hashed_password = Column(String(256), nullable=False)
    role = Column(String(32), nullable=False, default="demo_user")
    # Roles: admin, security_admin, forensic_analyst, auditor, demo_user
    full_name = Column(String(128), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    recovery_cases = relationship("RecoveryCase", back_populates="creator")
    audit_logs = relationship("AuditLog", back_populates="user")


class StorageDevice(Base):
    __tablename__ = "storage_devices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(128), nullable=False)
    device_path = Column(String(256), nullable=False)
    storage_type = Column(String(32), nullable=False)  # HDD, SSD, NVME, VIRTUAL_SANDBOX
    filesystem = Column(String(32), nullable=False)     # NTFS, EXT4, FAT32, exFAT, APFS
    total_capacity_bytes = Column(BigInteger, nullable=False)
    used_capacity_bytes = Column(BigInteger, nullable=False)
    is_sandbox = Column(Boolean, default=False)
    trim_supported = Column(Boolean, default=False)
    ftl_aware = Column(Boolean, default=True)
    health_status = Column(String(32), default="HEALTHY")
    risk_level = Column(String(16), default="LOW")
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    recovery_cases = relationship("RecoveryCase", back_populates="target_device")
    erasure_operations = relationship("ErasureOperation", back_populates="target_device")


class RecoveryCase(Base):
    __tablename__ = "recovery_cases"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_number = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(256), nullable=False)
    created_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    target_device_id = Column(String(36), ForeignKey("storage_devices.id"), nullable=False)
    status = Column(String(32), nullable=False, default="CREATED")
    # States: CREATED, AUTHORIZED, SCANNING, ANALYZING, RESULTS_READY, RECOVERING, COMPLETED, FAILED, CANCELLED
    total_candidates = Column(Integer, default=0)
    recovered_count = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    creator = relationship("User", back_populates="recovery_cases")
    target_device = relationship("StorageDevice", back_populates="recovery_cases")
    candidates = relationship("RecoveryCandidate", back_populates="case", cascade="all, delete-orphan")


class RecoveryCandidate(Base):
    __tablename__ = "recovery_candidates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("recovery_cases.id"), nullable=False)
    file_name = Column(String(256), nullable=False)
    detected_format = Column(String(16), nullable=False)  # JPG, PNG, PDF, DOCX, ZIP, MP4
    byte_offset = Column(BigInteger, nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    signature_match_pct = Column(Float, default=100.0)
    metadata_quality_pct = Column(Float, default=80.0)
    continuity_pct = Column(Float, default=90.0)
    structure_validity_pct = Column(Float, default=95.0)
    confidence_score = Column(Float, default=90.0)
    confidence_level = Column(String(16), default="HIGH")  # VERY_LOW, LOW, MEDIUM, HIGH, VERY_HIGH
    integrity_status = Column(String(32), default="PASS")  # PASS, PARTIAL, CORRUPT
    recovery_status = Column(String(32), default="DETECTED")  # DETECTED, RECOVERING, RECOVERED, FAILED
    ai_explanation = Column(Text, nullable=True)
    recovered_file_path = Column(String(512), nullable=True)
    sha256_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    case = relationship("RecoveryCase", back_populates="candidates")


class ErasureOperation(Base):
    __tablename__ = "erasure_operations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    operation_code = Column(String(64), unique=True, index=True, nullable=False)
    target_device_id = Column(String(36), ForeignKey("storage_devices.id"), nullable=False)
    target_scope = Column(String(64), default="FREE_SPACE")  # FULL_DISK, PARTITION, FILE_OBJECTS, FREE_SPACE
    storage_type = Column(String(32), nullable=False)
    sanitization_method = Column(String(64), nullable=False)
    # Methods: NIST_800_88_CLEAR, NIST_800_88_PURGE, DOD_5220_22_M, CRYPTO_SHRED, FTL_BLOCK_ERASE, SECURE_OVERWRITE_1PASS
    requested_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    approved_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    status = Column(String(32), nullable=False, default="CREATED")
    # States: CREATED, ANALYZING, PENDING_AUTHORIZATION, AUTHORIZED, SANITIZING, VERIFYING, VERIFIED, FAILED, CANCELLED
    passes_completed = Column(Integer, default=0)
    total_passes = Column(Integer, default=1)
    progress_pct = Column(Float, default=0.0)
    confirmation_phrase = Column(String(64), nullable=True)
    ai_risk_assessment_json = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    target_device = relationship("StorageDevice", back_populates="erasure_operations")
    verification_result = relationship("VerificationResult", back_populates="erasure_operation", uselist=False)


class VerificationResult(Base):
    __tablename__ = "verification_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    erasure_operation_id = Column(String(36), ForeignKey("erasure_operations.id"), nullable=False)
    target_device_id = Column(String(36), ForeignKey("storage_devices.id"), nullable=False)
    residual_signatures_count = Column(Integer, default=0)
    recoverable_objects_count = Column(Integer, default=0)
    residual_entropy = Column(Float, default=0.0)
    controlled_recovery_successes = Column(Integer, default=0)
    verdict = Column(String(32), nullable=False)
    # Verdicts: PASSED, PASSED_WITH_WARNING, FAILED, INCONCLUSIVE
    residual_risk_level = Column(String(16), default="LOW")  # LOW, MEDIUM, HIGH, CRITICAL
    evidence_summary = Column(Text, nullable=True)
    verified_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, default=utc_now)

    # Relationships
    erasure_operation = relationship("ErasureOperation", back_populates="verification_result")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    timestamp = Column(DateTime, default=utc_now, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    username = Column(String(64), nullable=False)
    role = Column(String(32), nullable=False)
    action = Column(String(64), index=True, nullable=False)
    target_resource = Column(String(128), nullable=False)
    operation_id = Column(String(36), nullable=True)
    ip_address = Column(String(64), default="127.0.0.1")
    status = Column(String(32), nullable=False, default="SUCCESS")  # SUCCESS, DENIED, FAILED, PENDING
    details_json = Column(Text, nullable=True)
    sha256_checksum = Column(String(64), nullable=False)

    # Relationships
    user = relationship("User", back_populates="audit_logs")


class SecurityReport(Base):
    __tablename__ = "security_reports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    report_number = Column(String(64), unique=True, index=True, nullable=False)
    operation_id = Column(String(36), ForeignKey("erasure_operations.id"), nullable=True)
    case_id = Column(String(36), ForeignKey("recovery_cases.id"), nullable=True)
    title = Column(String(256), nullable=False)
    generated_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    report_type = Column(String(32), nullable=False)  # ERASURE_CERTIFICATE, RECOVERY_CASE_REPORT, AUDIT_SUMMARY
    summary_markdown = Column(Text, nullable=True)
    ai_risk_assessment = Column(Text, nullable=True)
    pdf_file_path = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=utc_now)
