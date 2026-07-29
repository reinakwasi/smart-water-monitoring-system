"""Device ownership filters and administrative access auditing."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase


class DataIsolationService:
    """Apply user/device ownership rules consistently at query time."""

    @staticmethod
    async def get_user_device_ids(
        user_id: str,
        db: AsyncIOMotorDatabase,
        active_only: bool = True,
    ) -> List[str]:
        query: Dict[str, Any] = {"user_id": str(user_id)}
        if active_only:
            query["is_active"] = True

        cursor = db.user_device_associations.find(query, {"device_id": 1})
        return [document["device_id"] async for document in cursor]

    @staticmethod
    async def verify_device_ownership(
        user_id: str,
        device_id: str,
        db: AsyncIOMotorDatabase,
        active_only: bool = True,
    ) -> bool:
        query: Dict[str, Any] = {"user_id": str(user_id), "device_id": device_id}
        if active_only:
            query["is_active"] = True
        return await db.user_device_associations.find_one(query, {"_id": 1}) is not None

    @classmethod
    async def build_device_filter(
        cls,
        user_id: str,
        user_role: str,
        db: AsyncIOMotorDatabase,
        device_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if user_role == "admin":
            return {"device_id": device_id} if device_id else {}
        if device_id:
            return {"device_id": device_id}
        device_ids = await cls.get_user_device_ids(user_id, db)
        return {"device_id": {"$in": device_ids}}


async def log_admin_access(
    user_id: str,
    action: str,
    endpoint: str,
    db: AsyncIOMotorDatabase,
    device_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    query_parameters: Optional[Dict[str, Any]] = None,
) -> None:
    """Write an audit record for privileged data access."""
    await db.admin_audit_logs.insert_one(
        {
            "user_id": str(user_id),
            "action": action,
            "endpoint": endpoint,
            "device_ids": [device_id] if device_id else [],
            "timestamp": datetime.utcnow(),
            "ip_address": ip_address,
            "query_parameters": query_parameters or {},
        }
    )


data_isolation_service = DataIsolationService()
