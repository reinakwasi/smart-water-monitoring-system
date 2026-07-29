"""Focused tests for device credentials and ownership isolation."""

import base64
from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from fastapi import HTTPException

from app.config import settings
from app.dependencies import verify_device_api_key
from app.services.data_isolation_service import DataIsolationService
from app.services.device_auth_service import DeviceAuthService


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """These unit tests use in-memory fakes and do not need MongoDB."""
    yield


class AsyncCursor:
    def __init__(self, documents):
        self.documents = documents

    def __aiter__(self):
        async def iterate():
            for document in self.documents:
                yield document
        return iterate()


class FakeAssociations:
    def __init__(self, documents):
        self.documents = documents
        self.last_update = None

    def find(self, query, projection=None):
        matches = []
        for document in self.documents:
            if all(document.get(key) == value for key, value in query.items()):
                matches.append(document)
        return AsyncCursor(matches)

    async def find_one(self, query, projection=None):
        async for document in self.find(query, projection):
            return document
        return None

    async def update_one(self, query, update):
        self.last_update = (query, update)


class FakeDB:
    def __init__(self, associations):
        self.user_device_associations = FakeAssociations(associations)


def test_api_key_generation_has_256_bits_and_is_unique():
    keys = [DeviceAuthService.generate_api_key() for _ in range(100)]
    assert len(set(keys)) == 100
    for key in keys:
        padded = key + "=" * (-len(key) % 4)
        assert len(base64.urlsafe_b64decode(padded)) == 32


def test_api_key_is_stored_as_bcrypt_hash_and_verifies():
    key = DeviceAuthService.generate_api_key()
    hashed = DeviceAuthService.hash_api_key(key)
    assert hashed.startswith(("$2a$12$", "$2b$12$", "$2y$12$"))
    assert key not in hashed
    assert DeviceAuthService.verify_api_key(key, hashed)
    assert not DeviceAuthService.verify_api_key("wrong-key", hashed)


@pytest.mark.asyncio
async def test_data_isolation_returns_only_active_owned_devices():
    db = FakeDB([
        {"_id": 1, "user_id": "u1", "device_id": "d1", "is_active": True},
        {"_id": 2, "user_id": "u1", "device_id": "d2", "is_active": False},
        {"_id": 3, "user_id": "u2", "device_id": "d3", "is_active": True},
    ])
    service = DataIsolationService()
    assert await service.get_user_device_ids("u1", db) == ["d1"]
    assert await service.verify_device_ownership("u1", "d1", db)
    assert not await service.verify_device_ownership("u1", "d3", db)
    assert await service.build_device_filter("admin", "admin", db) == {}
    assert await service.build_device_filter("u1", "user", db) == {
        "device_id": {"$in": ["d1"]}
    }


@pytest.mark.asyncio
async def test_device_api_key_validation_returns_association_and_updates_contact():
    key = DeviceAuthService.generate_api_key()
    association = {
        "_id": 1,
        "user_id": "u1",
        "device_id": "d1",
        "api_key_hash": DeviceAuthService.hash_api_key(key),
        "api_key_expires_at": datetime.utcnow() + timedelta(days=1),
        "is_active": True,
    }
    db = FakeDB([association])
    result = await verify_device_api_key(x_api_key=key, db=db)
    assert result["device_id"] == "d1"
    assert db.user_device_associations.last_update is not None


@pytest.mark.asyncio
async def test_device_api_key_allows_legacy_upload_when_enabled():
    previous = settings.allow_legacy_device_uploads
    settings.allow_legacy_device_uploads = True
    try:
        result = await verify_device_api_key(x_api_key=None, db=FakeDB([]))
    finally:
        settings.allow_legacy_device_uploads = previous

    assert result["legacy_upload"] is True


@pytest.mark.asyncio
async def test_device_api_key_rejects_missing_invalid_and_expired_keys():
    previous = settings.allow_legacy_device_uploads
    settings.allow_legacy_device_uploads = False
    try:
        with pytest.raises(HTTPException) as missing:
            await verify_device_api_key(x_api_key=None, db=FakeDB([]))
    finally:
        settings.allow_legacy_device_uploads = previous

    assert missing.value.status_code == 401
    assert missing.value.detail == "Missing API key"

    with pytest.raises(HTTPException) as invalid:
        await verify_device_api_key(x_api_key="invalid", db=FakeDB([]))
    assert invalid.value.status_code == 401

    key = DeviceAuthService.generate_api_key()
    expired_db = FakeDB([{
        "_id": 1,
        "device_id": "d1",
        "api_key_hash": DeviceAuthService.hash_api_key(key),
        "api_key_expires_at": datetime.utcnow() - timedelta(seconds=1),
        "is_active": True,
    }])
    with pytest.raises(HTTPException) as expired:
        await verify_device_api_key(x_api_key=key, db=expired_db)
    assert expired.value.status_code == 401
    assert "expired" in expired.value.detail.lower()
