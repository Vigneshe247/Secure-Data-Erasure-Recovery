"""
Enterprise Pydantic Schemas (Revised)
======================================
Request/response schemas for the Zero-Trust Data Lifecycle governance layer.
Reflects quarantine/active storage separation and state-aware access.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Enterprise File Schemas
# ---------------------------------------------------------------------------

class EnterpriseFileResponse(BaseModel):
    id: str
    original_filename: str
    stored_filename: str
    owner_id: str
    storage_path: str
    active_storage_path: Optional[str] = None
    quarantine_storage_path: Optional[str] = None
    source_type: str = "ENTERPRISE_UPLOAD"
    file_size: int
    mime_type: Optional[str] = None
    sha256_hash: str
    status: str
    deleted_by: Optional[str] = None
    deleted_at: Optional[datetime] = None
    retention_expires_at: Optional[datetime] = None
    retention_hold: bool = False
    recovered_at: Optional[datetime] = None
    recovered_by: Optional[str] = None
    purged_at: Optional[datetime] = None
    purged_by: Optional[str] = None
    erasure_method: Optional[str] = None
    erasure_verified: Optional[bool] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class VaultFileResponse(BaseModel):
    """Extended file response with owner details for the Recovery Vault."""
    id: str
    original_filename: str
    file_size: int
    mime_type: Optional[str] = None
    sha256_hash: str
    status: str
    owner_id: str
    owner_username: Optional[str] = None
    owner_fullname: Optional[str] = None
    deleted_at: Optional[datetime] = None
    retention_expires_at: Optional[datetime] = None
    retention_hold: bool = False
    created_at: datetime


# ---------------------------------------------------------------------------
# Recovery Request Schemas
# ---------------------------------------------------------------------------

class RecoveryRequestCreate(BaseModel):
    reason: Optional[str] = None


class RecoveryRequestResponse(BaseModel):
    id: str
    file_id: str
    employee_id: str
    reason: Optional[str] = None
    requested_at: datetime
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    # Inline file/employee info for admin display
    filename: Optional[str] = None
    employee_username: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ReviewRequestBody(BaseModel):
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Purge Request Schema
# ---------------------------------------------------------------------------

class PurgeRequest(BaseModel):
    method: str = "SIMULATED_SECURE_ERASURE"
    # ZERO_FILL, RANDOM_OVERWRITE, CRYPTO_PURGE, SIMULATED_SECURE_ERASURE


class PurgeResponse(BaseModel):
    file_id: str
    filename: str
    status: str
    method: str
    verified: bool
    verification: Dict[str, Any]
    sha256_original: str
    purged_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Retention Hold Schema
# ---------------------------------------------------------------------------

class RetentionHoldRequest(BaseModel):
    hold: bool


# ---------------------------------------------------------------------------
# Audit Block (Blockchain) Schemas
# ---------------------------------------------------------------------------

class AuditBlockResponse(BaseModel):
    id: str
    index: int
    timestamp: datetime
    event_type: str
    actor_id: Optional[str] = None
    actor_role: Optional[str] = None
    target_file_id: Optional[str] = None
    target_user_id: Optional[str] = None
    source_ip: Optional[str] = None
    action_details: Optional[str] = None
    audit_log_id: Optional[str] = None
    previous_hash: str
    hash: str

    model_config = ConfigDict(from_attributes=True)


class ChainVerificationResponse(BaseModel):
    valid: bool
    blocks_checked: int
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Forensic Evidence Schema
# ---------------------------------------------------------------------------

class ForensicEvidenceResponse(BaseModel):
    file_id: str
    filename: str
    file_size: int
    mime_type: Optional[str] = None
    sha256_hash: str
    status: str
    source_type: str
    owner_id: str
    detected_type: Optional[str] = None
    magic_bytes: Optional[str] = None
    magic_signature: Optional[str] = None
    recovery_confidence: Optional[float] = None
    source_offset: Optional[int] = None
    sector_info: Optional[str] = None
    recovery_timestamp: Optional[str] = None
    chain_of_custody: Optional[List[AuditBlockResponse]] = None


# ---------------------------------------------------------------------------
# SOC Dashboard Metrics (Enterprise-aware)
# ---------------------------------------------------------------------------

class SOCDashboardResponse(BaseModel):
    active_files: int
    recoverable_files: int
    pending_recovery_requests: int
    files_purged: int
    total_files: int
    security_events: int
    audit_chain_status: str  # "VALID" or "INVALID"
    audit_blocks_count: int
    retention_expiring_soon: int  # Files expiring within 7 days
    recent_events: List[Dict[str, Any]]
