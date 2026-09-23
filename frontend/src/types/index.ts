export type Role = 'admin' | 'security_admin' | 'forensic_analyst' | 'auditor' | 'demo_user' | 'employee';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  full_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface StorageDevice {
  id: string;
  name: string;
  device_path: string;
  storage_type: 'HDD' | 'SSD' | 'NVME' | 'VIRTUAL_SANDBOX' | 'USB_FLASH' | 'NETWORK_SHARE';
  filesystem: string;
  total_capacity_bytes: number;
  used_capacity_bytes: number;
  is_sandbox: boolean;
  trim_supported: boolean;
  ftl_aware: boolean;
  health_status: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  metadata_json?: string;
  created_at: string;
}

export interface StorageProfile {
  device: StorageDevice;
  storage_type: string;
  risk_level: string;
  ftl_warning: boolean;
  trim_active: boolean;
  recommended_strategy: string;
  technical_rationale: string;
  compliance_standard?: string;
  ai_confidence: number;
}

export interface RecoveryCandidate {
  id: string;
  case_id: string;
  file_name: string;
  detected_format: string;
  byte_offset: number;
  file_size_bytes: number;
  signature_match_pct: number;
  metadata_quality_pct: number;
  continuity_pct: number;
  structure_validity_pct: number;
  confidence_score: number;
  confidence_level: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  integrity_status: 'PASS' | 'PARTIAL' | 'CORRUPT';
  recovery_status: 'DETECTED' | 'RECOVERING' | 'RECOVERED' | 'FAILED' | 'UNRECOVERABLE';
  ai_explanation?: string;
  recovered_file_path?: string;
  sha256_hash?: string;
  created_at: string;
}

export interface RecoveryCase {
  id: string;
  case_number: string;
  title: string;
  created_by_user_id: string;
  target_device_id: string;
  status: 'CREATED' | 'AUTHORIZED' | 'SCANNING' | 'ANALYZING' | 'RESULTS_READY' | 'RECOVERING' | 'COMPLETED' | 'FAILED';
  total_candidates: number;
  recovered_count: number;
  notes?: string;
  created_at: string;
  candidates?: RecoveryCandidate[];
}

export interface ErasureOperation {
  id: string;
  operation_code: string;
  target_device_id: string;
  target_scope: string;
  storage_type: string;
  sanitization_method: string;
  requested_by_user_id: string;
  approved_by_user_id?: string;
  status: 'CREATED' | 'PENDING_AUTHORIZATION' | 'AUTHORIZED' | 'SANITIZING' | 'VERIFYING' | 'VERIFIED' | 'FAILED';
  passes_completed: number;
  total_passes: number;
  progress_pct: number;
  confirmation_phrase?: string;
  ai_risk_assessment_json?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface VerificationResult {
  id: string;
  erasure_operation_id: string;
  target_device_id: string;
  residual_signatures_count: number;
  recoverable_objects_count: number;
  residual_entropy: number;
  controlled_recovery_successes: number;
  verdict: 'PASSED' | 'PASSED_WITH_WARNING' | 'FAILED' | 'INCONCLUSIVE';
  residual_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence_summary?: string;
  verified_by_user_id?: string;
  verified_at: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id?: string;
  username: string;
  role: string;
  action: string;
  target_resource: string;
  operation_id?: string;
  ip_address: string;
  status: 'SUCCESS' | 'DENIED' | 'FAILED' | 'PENDING';
  details_json?: string;
  sha256_checksum: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  user_id?: string;
  username: string;
  role?: string;
  user_role?: string;
  action?: string;
  action_type: string;
  target_resource: string;
  operation_id?: string;
  ip_address: string;
  status?: string;
  detail?: string;
  details_json?: string;
  sha256_checksum?: string;
  sha256_chain?: string;
}

export interface SecurityReport {
  id: string;
  report_number: string;
  operation_id?: string;
  case_id?: string;
  title: string;
  generated_by_user_id: string;
  report_type: 'ERASURE_CERTIFICATE' | 'RECOVERY_CASE_REPORT' | 'AUDIT_SUMMARY';
  summary_markdown?: string;
  ai_risk_assessment?: string;
  pdf_file_path?: string;
  created_at: string;
}

export interface Report {
  id: string;
  title: string;
  report_type: string;
  status: string;
  generated_at: string;
  generated_by: string;
  sha256_hash?: string;
  standards_covered?: string[];
  operations_covered?: any[];
}

export interface DashboardMetrics {
  total_users: number;
  active_devices: number;
  total_recovery_cases: number;
  total_recovered_files: number;
  total_erasure_ops: number;
  verified_erasure_ops: number;
  failed_verifications: number;
  security_alerts_count: number;
  verification_pass_rate: number;
  recent_operations: Array<{
    id: string;
    action: string;
    username: string;
    role: string;
    target: string;
    status: string;
    timestamp: string;
  }>;
  storage_summary: Array<{
    id: string;
    name: string;
    storage_type: string;
    filesystem: string;
    is_sandbox: boolean;
    total_bytes: number;
    used_bytes: number;
    risk_level: string;
    health: string;
  }>;
}

// ---------------------------------------------------------------------------
// Enterprise Governance & Zero-Trust File Lifecycle Types
// ---------------------------------------------------------------------------

export interface EnterpriseFile {
  id: string;
  original_filename: string;
  stored_filename: string;
  owner_id: string;
  owner_username?: string;
  owner_fullname?: string;
  storage_path: string;
  active_storage_path?: string | null;
  quarantine_storage_path?: string | null;
  source_type: string;
  file_size: number;
  mime_type?: string | null;
  sha256_hash: string;
  status: 'ACTIVE' | 'ADMIN_RECOVERABLE' | 'RECOVERY_REQUESTED' | 'RECOVERY_APPROVED' | 'RECOVERED' | 'PURGE_IN_PROGRESS' | 'PURGED';
  deleted_by?: string | null;
  deleted_at?: string | null;
  retention_expires_at?: string | null;
  retention_hold: boolean;
  recovered_at?: string | null;
  recovered_by?: string | null;
  purged_at?: string | null;
  purged_by?: string | null;
  erasure_method?: string | null;
  erasure_verified?: boolean | null;
  created_at: string;
  updated_at?: string | null;
}

export interface RecoveryRequest {
  id: string;
  file_id: string;
  employee_id: string;
  employee_username?: string;
  filename?: string;
  reason?: string | null;
  requested_at: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
}

export interface AuditBlock {
  id: string;
  index: number;
  timestamp: string;
  event_type: string;
  actor_id?: string | null;
  actor_role?: string | null;
  target_file_id?: string | null;
  target_user_id?: string | null;
  source_ip?: string | null;
  action_details?: string | null;
  audit_log_id?: string | null;
  previous_hash: string;
  hash: string;
}

export interface PurgeResponse {
  file_id: string;
  filename: string;
  status: string;
  method: string;
  verified: boolean;
  verification: any;
  sha256_original: string;
  purged_at?: string | null;
}

export interface ChainVerificationResponse {
  valid: boolean;
  blocks_checked: number;
  error?: string | null;
}

export interface ForensicEvidence {
  file_id: string;
  filename: string;
  file_size: number;
  mime_type?: string | null;
  sha256_hash: string;
  status: string;
  source_type: string;
  owner_id: string;
  detected_type?: string | null;
  magic_bytes?: string | null;
  magic_signature?: string | null;
  recovery_confidence?: number | null;
  source_offset?: number | null;
  sector_info?: string | null;
  recovery_timestamp?: string | null;
  chain_of_custody?: AuditBlock[];
}

export interface SOCDashboardMetrics {
  active_files: number;
  recoverable_files: number;
  pending_recovery_requests: number;
  files_purged: number;
  total_files: number;
  security_events: number;
  audit_chain_status: string;
  audit_blocks_count: number;
  retention_expiring_soon: number;
  recent_events: Array<{
    index: number;
    event_type: string;
    actor_id?: string;
    actor_role?: string;
    target_file_id?: string;
    timestamp?: string;
    hash: string;
  }>;
}
