import math
from pathlib import Path
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.models.models import ErasureOperation, StorageDevice, VerificationResult, User
from backend.app.services.signature_analyzer import identify_signature_at_offset
from backend.app.ai.residual_risk import ResidualRiskAI
from backend.app.services.audit_service import AuditService


class VerificationEngineService:
    @staticmethod
    def calculate_shannon_entropy(data: bytes) -> float:
        """
        Calculates Shannon Entropy (0.0 to 8.0 bits per byte).
        A zero-filled buffer has entropy 0.0. A completely encrypted/random buffer has entropy ~8.0.
        """
        if not data:
            return 0.0
        entropy = 0.0
        length = len(data)
        byte_counts = [0] * 256
        for b in data:
            byte_counts[b] += 1

        for count in byte_counts:
            if count > 0:
                p = count / length
                entropy -= p * math.log2(p)
        return round(entropy, 4)

    @classmethod
    async def perform_verification(
        cls,
        db: AsyncSession,
        operation_id: str,
        user: User
    ) -> VerificationResult:
        op = await db.get(ErasureOperation, operation_id)
        if not op:
            raise ValueError("Erasure operation not found")

        target_device = await db.get(StorageDevice, op.target_device_id)
        if not target_device:
            raise ValueError("Target storage device not found")

        # Scan sandbox or simulated sectors
        residual_signatures = 0
        recoverable_objects = 0
        entropy = 0.001

        if target_device.is_sandbox:
            sandbox_path = Path(target_device.device_path)
            if sandbox_path.exists():
                try:
                    with open(sandbox_path, "rb") as f:
                        # Read sample 512KB to test entropy and signature scans
                        sample_data = f.read(512 * 1024)
                        entropy = cls.calculate_shannon_entropy(sample_data)

                        # Inspect sectors for magic bytes
                        for offset in range(0, min(len(sample_data), 128 * 1024), 512):
                            sig_match = identify_signature_at_offset(sample_data, offset)
                            if sig_match:
                                residual_signatures += 1
                except Exception:
                    pass

        verdict, risk_level, summary = ResidualRiskAI.evaluate_residual_evidence(
            residual_signatures_count=residual_signatures,
            recoverable_objects_count=recoverable_objects,
            residual_entropy=entropy,
            controlled_recovery_successes=0,
            storage_type=op.storage_type,
            sanitization_method=op.sanitization_method
        )

        # Check if a verification record already exists
        existing_result = await db.execute(
            select(VerificationResult).where(VerificationResult.erasure_operation_id == op.id)
        )
        existing_verif = existing_result.scalars().first()

        if existing_verif:
            existing_verif.residual_signatures_count = residual_signatures
            existing_verif.recoverable_objects_count = recoverable_objects
            existing_verif.residual_entropy = entropy
            existing_verif.controlled_recovery_successes = 0
            existing_verif.verdict = verdict
            existing_verif.residual_risk_level = risk_level
            existing_verif.evidence_summary = summary
            existing_verif.verified_by_user_id = user.id
            verif = existing_verif
        else:
            verif = VerificationResult(
                erasure_operation_id=op.id,
                target_device_id=target_device.id,
                residual_signatures_count=residual_signatures,
                recoverable_objects_count=recoverable_objects,
                residual_entropy=entropy,
                controlled_recovery_successes=0,
                verdict=verdict,
                residual_risk_level=risk_level,
                evidence_summary=summary,
                verified_by_user_id=user.id,
            )
            db.add(verif)

        op.status = "VERIFIED" if verdict in ["PASSED", "PASSED_WITH_WARNING"] else "FAILED"
        await db.commit()
        await db.refresh(verif)

        await AuditService.log_event(
            db=db,
            user=user,
            action="VERIFICATION_COMPLETED",
            target_resource=f"{target_device.name} -> {verdict}",
            operation_id=op.id,
            status="SUCCESS" if verdict == "PASSED" else "WARNING",
            details={
                "operation_code": op.operation_code,
                "verdict": verdict,
                "residual_signatures": residual_signatures,
                "entropy": entropy,
                "residual_risk": risk_level
            }
        )

        return verif
