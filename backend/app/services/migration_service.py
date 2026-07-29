"""Utilities for associating existing devices and historical data with users."""

from datetime import datetime
from typing import Any, Dict, Iterable, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.device_auth_service import device_auth_service


class MigrationService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    @staticmethod
    def _user_query(user_id: str) -> Dict[str, Any]:
        choices: list[Dict[str, Any]] = [{"_id": user_id}]
        if ObjectId.is_valid(user_id):
            choices.append({"_id": ObjectId(user_id)})
        return {"$or": choices}

    async def bulk_import_associations(
        self,
        associations: Iterable[Dict[str, Any]],
        registered_by: str = "migration",
    ) -> Dict[str, Any]:
        imported = 0
        skipped = 0
        errors = []
        api_keys: Dict[str, str] = {}

        for row_number, item in enumerate(associations, start=1):
            user_id = str(item.get("user_id", "")).strip()
            device_id = str(item.get("device_id", "")).strip()
            device_name = str(item.get("device_name", "")).strip()
            if not user_id or not device_id or not device_name:
                skipped += 1
                errors.append({"row": row_number, "device_id": device_id, "error": "Missing required field"})
                continue
            if await self.db.users.find_one(self._user_query(user_id), {"_id": 1}) is None:
                skipped += 1
                errors.append({"row": row_number, "device_id": device_id, "error": "User not found"})
                continue
            if await self.db.user_device_associations.find_one({"device_id": device_id}, {"_id": 1}):
                skipped += 1
                errors.append({"row": row_number, "device_id": device_id, "error": "Device already registered"})
                continue

            api_key = device_auth_service.generate_api_key()
            now = datetime.utcnow()
            document = {
                "user_id": user_id,
                "device_id": device_id,
                "device_name": device_name,
                "location": item.get("location") or None,
                "api_key_hash": device_auth_service.hash_api_key(api_key),
                "api_key_created_at": now,
                "api_key_expires_at": None,
                "last_communication": None,
                "is_active": True,
                "registered_at": now,
                "registered_by": str(registered_by),
                "updated_at": now,
            }
            await self.db.user_device_associations.insert_one(document)
            await self.db.api_key_audit_logs.insert_one(
                {
                    "device_id": device_id,
                    "user_id": user_id,
                    "action": "generated",
                    "timestamp": now,
                    "performed_by": str(registered_by),
                    "ip_address": None,
                    "user_agent": "migration",
                }
            )
            api_keys[device_id] = api_key
            imported += 1

        return {"imported": imported, "skipped": skipped, "errors": errors, "api_keys": api_keys}

    async def assign_orphaned_data(
        self,
        device_id: str,
        user_id: str,
        admin_user_id: str,
        device_name: Optional[str] = None,
        location: Optional[str] = None,
    ) -> Dict[str, Any]:
        result = await self.bulk_import_associations(
            [{
                "user_id": user_id,
                "device_id": device_id,
                "device_name": device_name or device_id,
                "location": location,
            }],
            registered_by=admin_user_id,
        )
        if result["imported"] != 1:
            raise ValueError(result["errors"][0]["error"])
        return {
            "device_id": device_id,
            "user_id": str(user_id),
            "api_key": result["api_keys"][device_id],
        }
