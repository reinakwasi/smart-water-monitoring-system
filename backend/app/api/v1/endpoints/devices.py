"""Device registration, credential lifecycle, and configuration endpoints."""

from datetime import datetime
from typing import Any, Dict, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.db.mongodb import mongodb
from app.dependencies import get_current_user, require_admin
from app.models.schemas import (
    DeviceConfigUpdateRequest,
    DeviceInfo,
    DeviceListResponse,
    DeviceRegistrationRequest,
    DeviceRegistrationResponse,
)
from app.services.data_isolation_service import data_isolation_service
from app.services.device_auth_service import device_auth_service

router = APIRouter(prefix="/devices", tags=["devices"])
admin_router = APIRouter(prefix="/admin/devices", tags=["admin devices"])


def _user_id(user: dict) -> str:
    return str(user["_id"])


def _target_user_query(user_id: str) -> Dict[str, Any]:
    candidates: list[Dict[str, Any]] = [{"_id": user_id}]
    if ObjectId.is_valid(user_id):
        candidates.append({"_id": ObjectId(user_id)})
    return {"$or": candidates}


async def _audit_key_event(
    db: AsyncIOMotorDatabase,
    association: dict,
    action: str,
    performed_by: str,
    request: Optional[Request] = None,
) -> None:
    await db.api_key_audit_logs.insert_one(
        {
            "device_id": association["device_id"],
            "user_id": association["user_id"],
            "action": action,
            "timestamp": datetime.utcnow(),
            "performed_by": performed_by,
            "ip_address": request.client.host if request and request.client else None,
            "user_agent": request.headers.get("user-agent") if request else None,
        }
    )


async def _get_accessible_association(
    device_id: str,
    current_user: dict,
    db: AsyncIOMotorDatabase,
) -> dict:
    association = await db.user_device_associations.find_one(
        {"device_id": device_id, "is_active": True}
    )
    if association is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    if current_user.get("role") != "admin" and association.get("user_id") != _user_id(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device does not belong to your account",
        )
    return association


@router.post("/register", response_model=DeviceRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register_device(
    device: DeviceRegistrationRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
):
    actor_id = _user_id(current_user)
    if device.target_user_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can register a device for another user",
        )
    target_user_id = device.target_user_id or actor_id
    if await db.users.find_one(_target_user_query(target_user_id), {"_id": 1}) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found")
    if await db.user_device_associations.find_one({"user_id": str(target_user_id), "is_active": True}, {"_id": 1}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account already has an ESP32 registered. Remove it before adding another.",
        )
    if await db.user_device_associations.find_one({"device_id": device.device_id}, {"_id": 1}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Device ID is already registered")

    api_key = device_auth_service.generate_api_key()
    now = datetime.utcnow()
    association = {
        "user_id": str(target_user_id),
        "device_id": device.device_id,
        "device_name": device.device_name,
        "location": device.location,
        "api_key_hash": device_auth_service.hash_api_key(api_key),
        "api_key_created_at": now,
        "api_key_expires_at": None,
        "last_communication": None,
        "is_active": True,
        "registered_at": now,
        "registered_by": actor_id,
        "updated_at": now,
    }
    try:
        await db.user_device_associations.insert_one(association)
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Device ID is already registered")
    await _audit_key_event(db, association, "generated", actor_id, request)
    return DeviceRegistrationResponse(
        device_id=device.device_id,
        device_name=device.device_name,
        api_key=api_key,
        user_id=str(target_user_id),
        registered_at=now,
    )


@router.get("/list", response_model=DeviceListResponse)
async def list_devices(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
):
    cursor = db.user_device_associations.find(
        {"user_id": _user_id(current_user), "is_active": True}
    ).sort("registered_at", -1)
    devices = [DeviceInfo(**document) async for document in cursor]
    return DeviceListResponse(devices=devices, count=len(devices))


@router.delete("/{device_id}/unregister")
async def unregister_device(
    device_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
):
    association = await _get_accessible_association(device_id, current_user, db)
    now = datetime.utcnow()
    await db.user_device_associations.update_one(
        {"_id": association["_id"]}, {"$set": {"is_active": False, "updated_at": now}}
    )
    await _audit_key_event(db, association, "invalidated", _user_id(current_user), request)
    return {"status": "success", "device_id": device_id, "message": "Device unregistered"}


@router.post("/{device_id}/regenerate-key")
async def regenerate_device_key(
    device_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
):
    association = await _get_accessible_association(device_id, current_user, db)
    api_key = device_auth_service.generate_api_key()
    now = datetime.utcnow()
    await db.user_device_associations.update_one(
        {"_id": association["_id"]},
        {"$set": {
            "api_key_hash": device_auth_service.hash_api_key(api_key),
            "api_key_created_at": now,
            "updated_at": now,
        }},
    )
    await _audit_key_event(db, association, "regenerated", _user_id(current_user), request)
    return {
        "status": "success",
        "device_id": device_id,
        "api_key": api_key,
        "message": "API key regenerated. Save it now; it will not be shown again.",
    }


@router.get("/{device_id}/config")
async def get_device_config(
    device_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
):
    association = await _get_accessible_association(device_id, current_user, db)
    sensor_device = await db.sensor_devices.find_one({"device_id": device_id}) or {}
    return {
        "device_id": device_id,
        "device_name": association["device_name"],
        "location": association.get("location"),
        "calibration": sensor_device.get("calibration", {}),
        "api_key_expires_at": association.get("api_key_expires_at"),
    }


@router.patch("/{device_id}/config")
async def update_device_config(
    device_id: str,
    update: DeviceConfigUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
):
    association = await _get_accessible_association(device_id, current_user, db)
    if update.calibration is not None and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update calibration",
        )

    changes = update.model_dump(exclude_unset=True, exclude={"calibration"})
    changes["updated_at"] = datetime.utcnow()
    await db.user_device_associations.update_one({"_id": association["_id"]}, {"$set": changes})
    if update.calibration is not None:
        await db.sensor_devices.update_one(
            {"device_id": device_id},
            {"$set": {"calibration": update.calibration, "updated_at": changes["updated_at"]}},
            upsert=True,
        )
    return {"status": "success", "device_id": device_id, "updated_at": changes["updated_at"]}


@admin_router.post("/bulk-import")
async def bulk_import_devices(
    associations: list[Dict[str, Any]],
    admin_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
):
    from app.services.migration_service import MigrationService

    return await MigrationService(db).bulk_import_associations(
        associations, registered_by=_user_id(admin_user)
    )
