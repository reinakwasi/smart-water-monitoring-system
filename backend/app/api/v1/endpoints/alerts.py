"""Authenticated alert history and read-state endpoints."""

from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongodb import mongodb
from app.dependencies import get_current_user


router = APIRouter(prefix="/alerts", tags=["Alerts"])


def _serialize_alert(document: dict) -> dict:
    """Convert a MongoDB alert record into the mobile API shape."""
    return {
        "alert_id": str(document["_id"]),
        "notification_type": document.get("notification_type", "system"),
        "device_id": document.get("device_id"),
        "title": document.get("title", "AquaGuard alert"),
        "message": document.get("body", ""),
        "severity": document.get("severity", document.get("priority", "normal")),
        "is_read": document.get("is_read", False),
        "created_at": document.get("sent_at", document.get("created_at", datetime.utcnow())),
        "related_reading_id": document.get("related_reading_id"),
        "delivery_status": document.get("delivery_status", "in_app"),
    }


@router.get("")
async def list_alerts(
    unread_only: bool = Query(False),
    limit: int = Query(100, ge=1, le=250),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
):
    """Return alert history belonging only to the authenticated user."""
    user_id = str(current_user["_id"])
    query = {"user_id": user_id}
    if unread_only:
        query["is_read"] = False

    cursor = db.notification_logs.find(query).sort("sent_at", -1).limit(limit)
    alerts = [_serialize_alert(document) async for document in cursor]
    unread_count = await db.notification_logs.count_documents(
        {"user_id": user_id, "is_read": False}
    )
    return {"alerts": alerts, "total": len(alerts), "unread_count": unread_count}


@router.patch("/read-all")
async def mark_all_alerts_read(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
):
    """Mark all alerts for the current user as read."""
    result = await db.notification_logs.update_many(
        {"user_id": str(current_user["_id"]), "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}},
    )
    return {"status": "success", "updated_count": result.modified_count}


@router.patch("/{alert_id}/read")
async def mark_alert_read(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
):
    """Mark one owned alert as read."""
    if not ObjectId.is_valid(alert_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    result = await db.notification_logs.update_one(
        {"_id": ObjectId(alert_id), "user_id": str(current_user["_id"])},
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return {"status": "success", "alert_id": alert_id}
