from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# --- Auth & User Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "demo_user"
    full_name: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Storage Schemas ---
class StorageDeviceResponse(BaseModel):
    id: str
    name: str
    device_path: str
    storage_type: str  # HDD, SSD, NVME, VIRTUAL_SANDBOX
    filesystem: str
    total_capacity_bytes: int
    used_capacity_bytes: int
    is_sandbox: bool
    trim_supported: bool
    ftl_aware: bool
    health_status: str
    risk_level: str
    metadata_json: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StorageAnalyzeRequest(BaseModel):
    device_id: str


class StorageProfileResponse(BaseModel):
    device: StorageDeviceResponse
    storage_type: str
    risk_level: str
    ftl_warning: bool
    trim_active: bool
    recommended_strategy: str
    technical_rationale: str
    ai_confidence: float


# --- Recovery Schemas ---
class RecoveryCaseCreate(BaseModel):
    title: str
    target_device_id: str
    notes: Optional[str] = None


class RecoveryCandidateResponse(BaseModel):
    id: str
    case_id: str
    file_name: str
    detected_format: str
    byte_offset: int
    file_size_bytes: int
    signature_match_pct: float
    metadata_quality_pct: float
    continuity_pct: float
    structure_validity_pct: float
    confidence_score: float
    confidence_level: str
    integrity_status: str
    recovery_status: str
    ai_explanation: Optional[str] = None
    recovered_file_path: Optional[str] = None
    sha256_hash: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecoveryCaseResponse(BaseModel):
    id: str
    case_number: str
    title: str
    created_by_user_id: str
    target_device_id: str
    status: str
    total_candidates: int
    recovered_count: int
    notes: Optional[str] = None
    created_at: datetime
    candidates: Optional[List[RecoveryCandidateResponse]] = None

    model_config = ConfigDict(from_attributes=True)


class RecoveryExecuteRequest(BaseModel):
    candidate_ids: List[str]


# --- Erasure Schemas ---
class ErasureAnalyzeRequest(BaseModel):
    device_id: str
    target_scope: str = "FREE_SPACE"  # FULL_DISK, PARTITION, FILE_OBJECTS, FREE_SPACE


class ErasureRecommendationResponse(BaseModel):
    device_id: str
    device_name: str
    storage_type: str
    filesystem: str
    risk_level: str
    recommended_method: str
    method_description: str
    estimated_duration_sec: int
    ftl_impact_notes: str
    compliance_standard: str  # NIST SP 800-88 Rev. 1 / DoD 5220.22-M
    ai_risk_score: float


class ErasureRequestCreate(BaseModel):
    target_device_id: str
    target_scope: str = "FREE_SPACE"
    sanitization_method: str
    notes: Optional[str] = None


class ErasureApproveRequest(BaseModel):
    operation_id: str
    approval_notes: Optional[str] = None


class ErasureExecuteRequest(BaseModel):
    operation_id: str
    confirmation_phrase: str


class ErasureOperationResponse(BaseModel):
    id: str
    operation_code: str
    target_device_id: str
    target_scope: str
    storage_type: str
    sanitization_method: str
    requested_by_user_id: str
    approved_by_user_id: Optional[str] = None
    status: str
    passes_completed: int
    total_passes: int
    progress_pct: float
    confirmation_phrase: Optional[str] = None
    ai_risk_assessment_json: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FileShredRequest(BaseModel):
    target_path: Optional[str] = None
    method: str = "dod3"
    passes: Optional[int] = 3
    wipe_slack: bool = True
    zero_inode: bool = True
    obfuscate_name: bool = True
    verify_entropy: bool = True
    audit_note: Optional[str] = None
    raw_payload: Optional[str] = None
    data_format: Optional[str] = "plaintext"


class FileShredResponse(BaseModel):
    success: bool
    target_path: str
    target_type: str
    original_size_bytes: int
    passes_executed: int
    method_name: str
    deleted_from_disk: bool
    verified_entropy: float
    sha256_hash: str
    message: str
    telemetry_logs: List[str]


# --- Verification Schemas ---
class VerificationStartRequest(BaseModel):
    operation_id: str


class VerificationResultResponse(BaseModel):
    id: str
    erasure_operation_id: str
    target_device_id: str
    residual_signatures_count: int
    recoverable_objects_count: int
    residual_entropy: float
    controlled_recovery_successes: int
    verdict: str  # PASSED, PASSED_WITH_WARNING, FAILED, INCONCLUSIVE
    residual_risk_level: str
    evidence_summary: Optional[str] = None
    verified_by_user_id: Optional[str] = None
    verified_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Audit Schemas ---
class AuditLogResponse(BaseModel):
    id: str
    timestamp: datetime
    user_id: Optional[str] = None
    username: str
    role: str
    action: str
    target_resource: str
    operation_id: Optional[str] = None
    ip_address: str
    status: str
    details_json: Optional[str] = None
    sha256_checksum: str

    model_config = ConfigDict(from_attributes=True)


# --- Report Schemas ---
class SecurityReportResponse(BaseModel):
    id: str
    report_number: str
    operation_id: Optional[str] = None
    case_id: Optional[str] = None
    title: str
    generated_by_user_id: str
    report_type: str
    summary_markdown: Optional[str] = None
    ai_risk_assessment: Optional[str] = None
    pdf_file_path: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Dashboard Overview Schemas ---
class DashboardMetricsResponse(BaseModel):
    total_users: int
    active_devices: int
    total_recovery_cases: int
    total_recovered_files: int
    total_erasure_ops: int
    verified_erasure_ops: int
    failed_verifications: int
    security_alerts_count: int
    verification_pass_rate: float
    recent_operations: List[Dict[str, Any]]
    storage_summary: List[Dict[str, Any]]
