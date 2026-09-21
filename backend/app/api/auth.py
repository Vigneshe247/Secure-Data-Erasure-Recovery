import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database.session import get_db
from backend.app.models.models import User
from backend.app.schemas.schemas import LoginRequest, FirebaseLoginRequest, Token, UserResponse, UserCreate
from backend.app.core.security import verify_password, create_access_token, get_password_hash
from backend.app.core.permissions import get_current_user, ROLE_PERMISSIONS
from backend.app.core.firebase import sync_user_to_firestore, verify_firebase_token
from backend.app.services.audit_service import AuditService

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _build_firestore_user_doc(user: User) -> dict:
    """Build the user document to sync to Firestore."""
    return {
        "uid": str(user.id),
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "role": user.role,
        "full_name": user.full_name or user.username,
        "is_active": user.is_active,
        "last_login": datetime.now(timezone.utc).isoformat(),
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/login", response_model=Token)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalars().first()

    if not user or not verify_password(req.password, user.hashed_password):
        await AuditService.log_event(
            db=db,
            user=None,
            action="USER_LOGIN_FAILED",
            target_resource=req.username,
            status="FAILED",
            details={"attempted_username": req.username}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    access_token = create_access_token(subject=user.id, role=user.role)

    await AuditService.log_event(
        db=db,
        user=user,
        action="USER_LOGIN_SUCCESS",
        target_resource=user.username,
        status="SUCCESS",
        details={"role": user.role}
    )

    # Sync user profile to Firestore (non-blocking background task)
    asyncio.ensure_future(sync_user_to_firestore(_build_firestore_user_doc(user)))

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/register", response_model=UserResponse)
async def register(req: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where((User.username == req.username) | (User.email == req.email)))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )

    user = User(
        username=req.username,
        email=req.email,
        hashed_password=get_password_hash(req.password),
        role=req.role or "employee",
        full_name=req.full_name or req.username,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await AuditService.log_event(
        db=db,
        user=user,
        action="USER_REGISTERED",
        target_resource=user.username,
        status="SUCCESS",
        details={"role": user.role}
    )

    # Sync new user to Firestore (non-blocking)
    user_doc = _build_firestore_user_doc(user)
    user_doc["last_login"] = None  # Not logged in yet at registration time
    asyncio.ensure_future(sync_user_to_firestore(user_doc))

    return user


@router.post("/firebase-login", response_model=Token)
async def firebase_login(
    req: FirebaseLoginRequest = None,
    db: AsyncSession = Depends(get_db),
    x_firebase_token: str = Header(None, alias="X-Firebase-Token")
):
    """
    Accepts a Firebase ID token (from the frontend after signInWithEmailAndPassword),
    verifies it, and returns a DataShield local JWT + user info.
    This enables pure Firebase Auth flow where the frontend handles the sign-in
    and passes the ID token to the backend.
    """
    token_str = (req.id_token if req and req.id_token else None) or x_firebase_token
    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firebase ID token is required in request body or X-Firebase-Token header"
        )

    fb_payload = verify_firebase_token(token_str)
    if not fb_payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase ID token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = fb_payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firebase token does not contain an email address"
        )

    # Look up the user in our DB by email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        # Auto-provision user from Firebase (first-time Firebase login)
        username = email.split("@")[0]
        # Ensure username uniqueness
        existing_un = await db.execute(select(User).where(User.username == username))
        if existing_un.scalars().first():
            username = f"{username}_{fb_payload.get('uid', '')[:6]}"

        role = "employee"
        if "admin" in email.lower():
            role = "admin"

        user = User(
            username=username,
            email=email,
            hashed_password="FIREBASE_AUTH_MANAGED",  # Managed by Firebase, not local
            role=role,
            full_name=fb_payload.get("name") or username,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        await AuditService.log_event(
            db=db,
            user=user,
            action="USER_AUTO_PROVISIONED_VIA_FIREBASE",
            target_resource=user.username,
            status="SUCCESS",
            details={"firebase_uid": fb_payload.get("uid"), "email": email}
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    access_token = create_access_token(subject=user.id, role=user.role)

    await AuditService.log_event(
        db=db,
        user=user,
        action="USER_LOGIN_VIA_FIREBASE",
        target_resource=user.username,
        status="SUCCESS",
        details={"role": user.role, "firebase_uid": fb_payload.get("uid")}
    )

    # Sync user to Firestore with Firebase UID
    user_doc = _build_firestore_user_doc(user)
    user_doc["firebase_uid"] = fb_payload.get("uid")
    asyncio.ensure_future(sync_user_to_firestore(user_doc))

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    permissions = list(ROLE_PERMISSIONS.get(current_user.role, set()))
    return {
        "user": UserResponse.from_orm(current_user),
        "permissions": permissions
    }


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await AuditService.log_event(
        db=db,
        user=current_user,
        action="USER_LOGOUT",
        target_resource=current_user.username,
        status="SUCCESS"
    )
    return {"message": "Successfully logged out"}
