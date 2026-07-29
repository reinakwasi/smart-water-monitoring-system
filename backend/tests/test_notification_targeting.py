"""Unit tests for device-owner-only push notification targeting."""

import pytest
import pytest_asyncio

from app.services.notification_service import NotificationService


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    yield


class FindOneCollection:
    def __init__(self, result):
        self.result = result
        self.last_query = None

    async def find_one(self, query):
        self.last_query = query
        return self.result


class FakeDB:
    def __init__(self, association, user):
        self.user_device_associations = FindOneCollection(association)
        self.users = FindOneCollection(user)


@pytest.mark.asyncio
async def test_only_device_owner_token_is_selected():
    db = FakeDB(
        {"device_id": "device-1", "user_id": "owner-1", "is_active": True},
        {
            "_id": "owner-1",
            "is_active": True,
            "push_enabled": True,
            "fcm_token": "owner-token",
            "alert_on_unsafe": True,
        },
    )
    service = NotificationService("test-server-key")
    tokens = await service.get_device_owner_tokens("device-1", db)
    assert tokens == [("owner-token", {
        "alert_on_unsafe": True,
        "alert_on_high_risk": True,
        "alert_on_tank_critical": True,
        "push_enabled": True,
    })]
    assert db.user_device_associations.last_query == {
        "device_id": "device-1",
        "is_active": True,
    }


@pytest.mark.asyncio
async def test_unregistered_device_has_no_notification_target():
    service = NotificationService("test-server-key")
    assert await service.get_device_owner_tokens("missing", FakeDB(None, None)) == []
