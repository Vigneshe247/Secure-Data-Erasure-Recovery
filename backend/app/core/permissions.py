from typing import List, Optional
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.security import decode_access_token
from backend.app.core.firebase import verify_firebase_token
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
    x_firebase_token: Optional[str] = Header(None, alias="X-Firebase-Token"),
    db: AsyncSession = Depends(get_db)
) -> User:
    raw_token = None
    if auth and auth.credentials:
        raw_token = auth.credentials
    elif x_firebase_token:
        raw_token = x_firebase_token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Try decoding as local JWT
    payload = decode_access_token(raw_token)
    if payload and "sub" in payload:
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

    # 2. Try verifying as Firebase ID Token
    fb_payload = verify_firebase_token(raw_token)
    if not fb_payload and x_firebase_token and x_firebase_token != raw_token:
        fb_payload = verify_firebase_token(x_firebase_token)

    if fb_payload:
        email = fb_payload.get("email") or f"{fb_payload.get('uid', 'firebase_user')}@firebase.datashield"
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        if not user:
            role = "admin" if ("admin" in email.lower()) else "forensic_analyst"
            username = email.split("@")[0]
            existing_un = await db.execute(select(User).where(User.username == username))
            if existing_un.scalars().first():
                username = f"{username}_{fb_payload.get('uid', '')[:4]}"

            user = User(
                username=username,
                email=email,
                hashed_password="FIREBASE_AUTH_MANAGED",
                role=role,
                full_name=fb_payload.get("name") or username,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated",
            )
        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )


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
