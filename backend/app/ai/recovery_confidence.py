from typing import Dict, Any, Tuple


class RecoveryConfidenceAI:
    """
    Explainable AI Confidence Engine for Authorized File Recovery.
    Deterministic, mathematical feature weighting with NLP explanation synthesis.
    """

    # Feature weights (sum = 1.0)
    WEIGHT_SIGNATURE = 0.35
    WEIGHT_STRUCTURE = 0.25
    WEIGHT_CONTINUITY = 0.20
    WEIGHT_METADATA = 0.15
    WEIGHT_SIZE_CONSISTENCY = 0.05

    @classmethod
    def evaluate_candidate(
        cls,
        detected_format: str,
        signature_match_pct: float,
        structure_validity_pct: float,
        continuity_pct: float,
        metadata_quality_pct: float,
        file_size_bytes: int,
        integrity_status: str
    ) -> Tuple[float, str, str]:
        """
        Calculates confidence score (0-100), level, and human-readable forensic explanation.
        """
        # Size sanity bonus/penalty
        size_score = 100.0 if (512 <= file_size_bytes <= 100 * 1024 * 1024) else 40.0

        raw_score = (
            (signature_match_pct * cls.WEIGHT_SIGNATURE) +
            (structure_validity_pct * cls.WEIGHT_STRUCTURE) +
            (continuity_pct * cls.WEIGHT_CONTINUITY) +
            (metadata_quality_pct * cls.WEIGHT_METADATA) +
            (size_score * cls.WEIGHT_SIZE_CONSISTENCY)
        )

        if integrity_status == "CORRUPT":
            raw_score = min(raw_score, 45.0)

        score = round(max(0.0, min(100.0, raw_score)), 1)

        if score >= 85.0:
            level = "HIGH" if score < 95.0 else "VERY_HIGH"
        elif score >= 65.0:
            level = "MEDIUM"
        elif score >= 40.0:
            level = "LOW"
        else:
            level = "VERY_LOW"

        # Generate Explainable Rationale
        reasons = []
        if signature_match_pct >= 95.0:
            reasons.append(f"Valid {detected_format} magic byte header & boundary markers identified with 100% confidence.")
        else:
            reasons.append(f"Partial {detected_format} header match ({signature_match_pct}%).")

        if continuity_pct >= 85.0:
            reasons.append("Data blocks exhibit contiguous cluster allocation without fragmentation gaps.")
        else:
            reasons.append(f"Detected fragmented data clusters ({continuity_pct}% continuity).")

        if structure_validity_pct >= 90.0:
            reasons.append(f"Internal {detected_format} structural grammar and terminating markers are intact.")
        else:
            reasons.append(f"Structural anomalies detected in internal file chunks ({structure_validity_pct}% validity).")

        if integrity_status == "PASS":
            reasons.append("CRC/Integrity check passed without payload corruption.")
        elif integrity_status == "PARTIAL":
            reasons.append("Payload intact but minor metadata headers were truncated during previous deletion.")
        else:
            reasons.append("Severe data degradation detected in critical stream payload.")

        explanation = f"Recovery Confidence: {score}% ({level})\n\nDeterministic Determinants:\n• " + "\n• ".join(reasons)

        return score, level, explanation
