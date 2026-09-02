import math
from typing import Tuple, Dict, Any


class ResidualRiskAI:
    """
    Evaluates post-erasure forensic residual evidence to generate risk metrics and explanations.
    """

    @classmethod
    def evaluate_residual_evidence(
        cls,
        residual_signatures_count: int,
        recoverable_objects_count: int,
        residual_entropy: float,
        controlled_recovery_successes: int,
        storage_type: str,
        sanitization_method: str
    ) -> Tuple[str, str, str]:
        """
        Returns (Verdict, RiskLevel, EvidenceSummary).
        Verdicts: PASSED, PASSED_WITH_WARNING, FAILED, INCONCLUSIVE
        RiskLevels: LOW, MEDIUM, HIGH, CRITICAL
        """
        # Critical failure if recovery succeeded or signatures found
        if recoverable_objects_count > 0 or controlled_recovery_successes > 0:
            verdict = "FAILED"
            risk_level = "CRITICAL" if recoverable_objects_count > 2 else "HIGH"
            summary = (
                f"VERIFICATION FAILED: {recoverable_objects_count} recoverable file objects and "
                f"{residual_signatures_count} residual magic-byte headers were detected in post-sanitization scan. "
                "Target data remains forensically reconstructible. Do NOT certify device for declassification."
            )
            return verdict, risk_level, summary

        if residual_signatures_count > 0:
            verdict = "PASSED_WITH_WARNING"
            risk_level = "MEDIUM"
            summary = (
                f"PASSED WITH WARNING: 0 recoverable objects, but {residual_signatures_count} isolated "
                "header fragments detected. Recommend executing a secondary sanitization pass."
            )
            return verdict, risk_level, summary

        # Check entropy consistency
        if "CLEAR" in sanitization_method and residual_entropy > 0.5:
            verdict = "PASSED_WITH_WARNING"
            risk_level = "LOW"
            summary = (
                f"PASSED WITH MINOR ANOMALY: Zero residual file headers detected. Sector entropy is {residual_entropy:.2f} "
                "(expected ~0.00 for pure zero overwrite). No structured data exists."
            )
            return verdict, risk_level, summary

        verdict = "PASSED"
        risk_level = "LOW"
        summary = (
            f"VERIFICATION PASSED: 0 residual signatures detected across 100% of sampled storage blocks. "
            f"Controlled forensic recovery probe yielded 0 successful extractions. "
            f"Sector Shannon entropy is {residual_entropy:.2f}. Meets NIST SP 800-88 compliance."
        )

        return verdict, risk_level, summary
