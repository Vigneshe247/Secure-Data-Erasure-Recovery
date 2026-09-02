from typing import Dict, Any


class AIRiskEngine:
    """
    Assists security administrators in evaluating storage architectures and assigning risk profiles.
    """

    @classmethod
    def assess_device_risk(
        cls,
        storage_type: str,
        filesystem: str,
        total_capacity_bytes: int,
        used_capacity_bytes: int,
        trim_supported: bool,
        is_sandbox: bool
    ) -> Dict[str, Any]:
        """
        Calculates storage risk, recommended handling, and reasoning.
        """
        is_flash = storage_type.upper() in ["SSD", "NVME"]
        used_pct = (used_capacity_bytes / max(1, total_capacity_bytes)) * 100

        if is_sandbox:
            risk_score = 0.15
            risk_level = "LOW"
            recommendation = "Safe isolated sandbox environment for demonstration and protocol validation."
            reason = "Virtual disk image isolated from host operating system."
        elif is_flash:
            risk_score = 0.75
            risk_level = "HIGH"
            recommendation = "Enforce Cryptographic Erase (NIST SP 800-88 Purge) with FTL block sanitization."
            reason = (
                "Flash memory controllers utilize dynamic block allocation and wear-leveling. "
                "Standard logical overwrites fail to sanitize hidden over-provisioned cells."
            )
        else:
            risk_score = 0.35
            risk_level = "MEDIUM" if used_pct > 80 else "LOW"
            recommendation = "Standard multi-pass magnetic overwrite (NIST SP 800-88 Clear or DoD 5220.22-M)."
            reason = "Magnetic media responds deterministically to direct sector overwrites."

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "recommendation": recommendation,
            "reason": reason,
            "confidence": 0.95
        }
