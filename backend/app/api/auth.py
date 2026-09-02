from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database.session import get_db
from backend.app.models.models import User
from backend.app.schemas.schemas import LoginRequest, Token, UserResponse
from backend.app.core.security import verify_password, create_access_token
from backend.app.core.permissions import get_current_user, ROLE_PERMISSIONS
from backend.app.services.audit_service import AuditService

router = APIRouter(prefix="/auth", tags=["Authentication"])


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
