from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.security import decode_access_token
from backend.app.database.session import get_db
from backend.app.models.models import User

security_scheme = HTTPBearer(auto_error=False)

# Granular Role-Based Permissions Matrix
ROLE_PERMISSIONS = {
    "admin": {
        "storage.view", "storage.analyze",
        "recovery.cases.create", "recovery.scan", "recovery.preview", "recovery.execute",
        "erasure.analyze", "erasure.request", "erasure.approve", "erasure.execute",
        "verification.view", "verification.execute",
        "audit.view", "audit.export",
        "reports.view", "reports.generate", "reports.download",
        "users.view", "users.manage",
        "system.settings",
    },
    "security_admin": {
        "storage.view", "storage.analyze",
        "recovery.cases.create", "recovery.scan", "recovery.preview", "recovery.execute",
        "erasure.analyze", "erasure.request", "erasure.approve", "erasure.execute",
        "verification.view", "verification.execute",
        "audit.view", "audit.export",
        "reports.view", "reports.generate", "reports.download",
        "users.view",
    },
    "forensic_analyst": {
        "storage.view", "storage.analyze",
        "recovery.cases.create", "recovery.scan", "recovery.preview", "recovery.execute",
        # Explicitly NO destructive erasure execution permissions
        "verification.view",
        "audit.view",
        "reports.view", "reports.generate", "reports.download",
    },
    "auditor": {
        "storage.view",
        "recovery.preview",
        "verification.view",
        "audit.view", "audit.export",
        "reports.view", "reports.download",
    },
    "demo_user": {
        "storage.view", "storage.analyze",
        "recovery.cases.create", "recovery.scan", "recovery.preview", "recovery.execute",
        "erasure.analyze", "erasure.request", "erasure.approve", "erasure.execute",
        "verification.view", "verification.execute",
        "audit.view",
        "reports.view", "reports.generate", "reports.download",
    }
}


async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(auth.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user


def require_permission(permission: str):
    """
    Dependency factory to check if current user has the required granular permission.
    """
    async def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        user_permissions = ROLE_PERMISSIONS.get(current_user.role, set())
        if permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Operation requires '{permission}' permission for role '{current_user.role}'.",
            )
        return current_user

    return permission_checker
