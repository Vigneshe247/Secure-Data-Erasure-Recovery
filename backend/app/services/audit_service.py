import hashlib
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.models import AuditLog, User


class AuditService:
    @staticmethod
    def _compute_checksum(
        timestamp_str: str,
        username: str,
        action: str,
        target_resource: str,
        status: str,
        details_json: str
    ) -> str:
        payload = f"{timestamp_str}|{username}|{action}|{target_resource}|{status}|{details_json}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @classmethod
    async def log_event(
        cls,
        db: AsyncSession,
        user: Optional[User],
        action: str,
        target_resource: str,
        operation_id: Optional[str] = None,
        ip_address: str = "127.0.0.1",
        status: str = "SUCCESS",
        details: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        now = datetime.now(timezone.utc)
        timestamp_str = now.isoformat()
        username = user.username if user else "SYSTEM"
        role = user.role if user else "system"
        user_id = user.id if user else None
        details_str = json.dumps(details or {}, sort_keys=True)

        checksum = cls._compute_checksum(
            timestamp_str, username, action, target_resource, status, details_str
        )

        audit_entry = AuditLog(
            timestamp=now,
            user_id=user_id,
            username=username,
            role=role,
            action=action,
            target_resource=target_resource,
            operation_id=operation_id,
            ip_address=ip_address,
            status=status,
            details_json=details_str,
            sha256_checksum=checksum,
        )

        db.add(audit_entry)
        await db.commit()
        await db.refresh(audit_entry)
        return audit_entry
