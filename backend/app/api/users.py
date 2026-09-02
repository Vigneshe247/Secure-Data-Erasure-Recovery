from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database.session import get_db
from backend.app.models.models import User
from backend.app.schemas.schemas import UserResponse, UserCreate, UserUpdate
from backend.app.core.security import get_password_hash
from backend.app.core.permissions import require_permission, get_current_user
from backend.app.services.audit_service import AuditService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.view"))
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=UserResponse)
async def create_user(
    req: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage"))
):
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
        role=req.role,
        full_name=req.full_name,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await AuditService.log_event(
        db=db,
        user=current_user,
        action="USER_CREATED",
        target_resource=user.username,
        status="SUCCESS",
        details={"created_user": user.username, "role": user.role}
    )

    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    req: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage"))
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.email:
        user.email = req.email
    if req.role:
        user.role = req.role
    if req.full_name is not None:
        user.full_name = req.full_name
    if req.is_active is not None:
        user.is_active = req.is_active

    await db.commit()
    await db.refresh(user)

    await AuditService.log_event(
        db=db,
        user=current_user,
        action="USER_UPDATED",
        target_resource=user.username,
        status="SUCCESS",
        details={"updated_fields": req.dict(exclude_unset=True)}
    )

    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage"))
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    username = user.username
    await db.delete(user)
    await db.commit()

    await AuditService.log_event(
        db=db,
        user=current_user,
        action="USER_DELETED",
        target_resource=username,
        status="SUCCESS"
    )

    return {"message": f"User {username} deleted successfully"}
