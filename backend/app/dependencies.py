from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongodb import mongodb
from app.config import settings
from app.models.schemas import UserRole
from app.services.auth_service import auth_service
from app.services.device_auth_service import device_auth_service

security = HTTPBearer(auto_error=False)


def _is_expired(expires_at: datetime) -> bool:
    """Compare MongoDB datetimes whether they are naive or timezone-aware."""
    if expires_at.tzinfo is None:
        return expires_at <= datetime.utcnow()
    return expires_at <= datetime.now(timezone.utc)


async def verify_device_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
) -> dict:
    """Authenticate an active ESP32 association and return its identity."""
    if not x_api_key:
        if settings.allow_legacy_device_uploads:
            return {"legacy_upload": True, "is_active": True}
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")

    cursor = db.user_device_associations.find({"is_active": True})
    async for association in cursor:
        api_key_hash = association.get("api_key_hash")
        if not api_key_hash or not device_auth_service.verify_api_key(x_api_key, api_key_hash):
            continue

        expires_at = association.get("api_key_expires_at")
        if expires_at and _is_expired(expires_at):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key expired. Please regenerate.",
            )

        now = datetime.utcnow()
        await db.user_device_associations.update_one(
            {"_id": association["_id"]},
            {"$set": {"last_communication": now, "updated_at": now}},
        )
        association["last_communication"] = now
        return association

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired API key",
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = auth_service.decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email: Optional[str] = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await db.users.find_one({"email": email})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role", "user") != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
) -> Optional[dict]:
    if credentials is None:
        return None
    try:
        payload = auth_service.decode_token(credentials.credentials)
        if payload is None or payload.get("type") != "access" or payload.get("sub") is None:
            return None
        return await db.users.find_one({"email": payload["sub"]})
    except Exception:
        return None
