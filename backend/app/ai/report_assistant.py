from typing import Dict, Any, Optional


class ReportAssistantAI:
    """
    Transforms structured forensic and sanitization evidence into human-readable executive summaries.
    Adheres strictly to deterministic data without hallucination.
    """

    @staticmethod
    def generate_erasure_narrative(
        operation_code: str,
        target_name: str,
        storage_type: str,
        method: str,
        verdict: str,
        residual_signatures: int,
        entropy: float,
        residual_risk: str,
        user_name: str,
        timestamp_str: str
    ) -> str:
        return f"""# DataShield Security Sanitization & Verification Report

**Operation ID**: `{operation_code}`  
**Target Resource**: `{target_name}`  
**Storage Architecture**: `{storage_type}`  
**Sanitization Protocol**: `{method}`  
**Operator / Authorizer**: `{user_name}`  
**Timestamp**: `{timestamp_str}`  

---

### Executive Summary
A controlled data sanitization lifecycle was executed on target media **{target_name}** under standard **{method}**. Post-sanitization independent verification was conducted to inspect for residual data blocks, filesystem metadata remnants, and recoverable object signatures.

### Forensic Verification Findings
* **Verification Decision**: **{verdict}**
* **Residual Signatures Detected**: `{residual_signatures}`
* **Sector Shannon Entropy**: `{entropy:.4f}`
* **Residual Declassification Risk**: `{residual_risk}`

### Storage Awareness & Compliance Notes
{"The Flash Translation Layer (FTL) wear-leveling characteristics of flash storage were addressed via cryptographic purge parameters." if storage_type in ["SSD", "NVME"] else "Magnetic domain realignment verified across all accessible physical sectors."}

### Recommendation
{"Target device is certified sanitized and safe for hardware declassification / repurposing according to NIST SP 800-88 Rev. 1 guidelines." if verdict == "PASSED" else "Do NOT release device. Secondary physical sanitization or physical degaussing is required."}
"""

    @staticmethod
    def generate_recovery_narrative(
        case_number: str,
        title: str,
        target_name: str,
        candidates_found: int,
        recovered_count: int,
        analyst_name: str,
        timestamp_str: str
    ) -> str:
        return f"""# DataShield Authorized File Recovery Investigation Report

**Case Number**: `{case_number}`  
**Case Title**: {title}  
**Investigated Target**: `{target_name}`  
**Forensic Analyst**: `{analyst_name}`  
**Date of Investigation**: `{timestamp_str}`  

---

### Investigation Overview
Authorized forensic deleted-file recovery was initiated to identify unallocated and deleted data blocks. Deep file carving was performed using deterministic magic-byte boundary analysis and fragment continuity validation.

### Key Forensic Findings
* **Deleted Candidate Objects Detected**: `{candidates_found}`
* **Successfully Extracted & Validated Files**: `{recovered_count}`
* **Integrity Validation**: All recovered payloads were hashed with SHA-256 for chain-of-custody tracking.

### Chain of Custody & Evidence Store
All extracted objects have been deposited into the secure DataShield evidence vault with cryptographic checksums recorded in the immutable audit trail.
"""
