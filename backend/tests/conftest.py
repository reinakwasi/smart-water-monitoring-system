"""Pytest configuration and fixtures"""

import os
import pytest
from datetime import datetime
import pytest_asyncio
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.db.mongodb import mongodb as mongo_db


@pytest.fixture(scope="session", autouse=True)
def event_loop_policy():
    """Set event loop policy for the test session"""
    import asyncio
    return asyncio.get_event_loop_policy()


@pytest.fixture(scope="function", autouse=True)
def disable_external_email(monkeypatch):
    """Prevent every automated test from contacting the real SMTP server."""
    from app.services.email_service import email_service

    deliveries = []

    def fake_send_email(to_email: str, subject: str, html_content: str) -> bool:
        deliveries.append({"to": to_email, "subject": subject})
        return True

    monkeypatch.setattr(email_service, "send_email", fake_send_email)
    return deliveries


@pytest_asyncio.fixture(scope="function")
async def setup_test_db():
    """Route every test to an isolated database and never touch live data."""
    test_db_name = f"{settings.mongodb_db_name}_test"
    test_mongodb_url = os.getenv("TEST_MONGODB_URL", "mongodb://localhost:27017")
    test_client = AsyncIOMotorClient(
        test_mongodb_url,
        serverSelectionTimeoutMS=1000,
        connectTimeoutMS=1000,
    )
    test_database = test_client[test_db_name]

    try:
        await test_client.admin.command("ping")
    except Exception as e:
        test_client.close()
        pytest.skip(
            f"Test MongoDB is not reachable at {test_mongodb_url}. "
            "Start a local MongoDB instance or set TEST_MONGODB_URL to a dedicated test database. "
            f"Original error: {e}"
        )

    # Preserve any application connection that existed before the test. The
    # API dependency reads these attributes from the shared MongoDB object.
    original_client = mongo_db.client
    original_database = mongo_db.db
    mongo_db.client = test_client
    mongo_db.db = test_database

    await mongo_db._create_indexes()
    collection_names = await test_database.list_collection_names()
    for collection_name in collection_names:
        await test_database[collection_name].delete_many({})

    try:
        yield test_database
    finally:
        try:
            # Clean only the dedicated test database.
            collection_names = await test_database.list_collection_names()
            for collection_name in collection_names:
                await test_database[collection_name].delete_many({})
        except Exception as e:
            print(f"Warning: Could not clean up test database after test: {e}")
        finally:
            # Always restore the shared object, even if test cleanup fails.
            mongo_db.client = original_client
            mongo_db.db = original_database
            test_client.close()


@pytest.fixture
def client(setup_test_db):
    """Create a test client for the FastAPI application"""
    return TestClient(app)


@pytest_asyncio.fixture
async def async_client(setup_test_db):
    """Create an async test client for the FastAPI application"""
    from httpx import ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def db(setup_test_db):
    """Expose the already-isolated database created for this test."""
    yield setup_test_db


@pytest.fixture
def sample_sensor_data():
    """Sample sensor data for testing"""
    return {
        "device_id": "ESP32_TEST_001",
        "timestamp": "2025-01-15T10:30:00Z",
        "ph": 7.2,
        "turbidity_index": 15.5,
        "temperature": 25.3,
        "tds": 150,
    }


@pytest.fixture
def sample_tank_data():
    """Sample tank level data for testing"""
    return {
        "device_id": "ESP32_TEST_001",
        "timestamp": "2025-01-15T10:30:00Z",
        "distance_cm": 45.2,
        "tank_height_cm": 200
    }


@pytest_asyncio.fixture
async def test_user(setup_test_db):
    """Create a test user in the main database"""
    from app.services.auth_service import auth_service

    # Use the main database that the app uses
    db = mongo_db.get_database()

    user_data = {
        "email": "testuser@example.com",
        "password_hash": auth_service.hash_password("testpassword123"),
        "full_name": "Test User",
        "role": "user",
        "is_active": True
    }

    result = await db.users.insert_one(user_data)
    user_data["_id"] = result.inserted_id

    yield user_data

    # Cleanup
    await db.users.delete_one({"_id": result.inserted_id})


@pytest_asyncio.fixture
async def test_admin(setup_test_db):
    """Create a test admin user in the main database"""
    from app.services.auth_service import auth_service

    # Use the main database that the app uses
    db = mongo_db.get_database()

    admin_data = {
        "email": "admin@example.com",
        "password_hash": auth_service.hash_password("adminpassword123"),
        "full_name": "Test Admin",
        "role": "admin",
        "is_active": True
    }

    result = await db.users.insert_one(admin_data)
    admin_data["_id"] = result.inserted_id

    yield admin_data

    # Cleanup
    await db.users.delete_one({"_id": result.inserted_id})


@pytest_asyncio.fixture
async def user_token(test_user):
    """Generate JWT token for test user"""
    from app.services.auth_service import auth_service
    return auth_service.create_access_token({"sub": test_user["email"], "role": test_user["role"]})


@pytest_asyncio.fixture
async def admin_token(test_admin):
    """Generate JWT token for test admin"""
    from app.services.auth_service import auth_service
    return auth_service.create_access_token({"sub": test_admin["email"], "role": test_admin["role"]})


@pytest.fixture
def mongodb():
    """Provide MongoDB instance for tests that need direct database access"""
    return mongo_db


@pytest_asyncio.fixture
async def auth_headers(user_token, test_user):
    """Generate user headers and associate the devices used by status tests."""
    db = mongo_db.get_database()
    now = datetime.utcnow()
    device_ids = ["TEST_DEVICE_001", "TEST_DEVICE_002", "DEVICE_001", "DEVICE_002", "TEST_DEVICE", "ESP32_TEST_001"]
    for device_id in device_ids:
        await db.user_device_associations.update_one(
            {"device_id": device_id},
            {
                "$set": {
                    "user_id": str(test_user["_id"]),
                    "device_name": device_id,
                    "is_active": True,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "device_id": device_id,
                    "registered_at": now,
                },
            },
            upsert=True,
        )
    return {"Authorization": f"Bearer {user_token}"}
