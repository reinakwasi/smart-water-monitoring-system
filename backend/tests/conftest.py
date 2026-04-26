"""Pytest configuration and fixtures"""

import pytest
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


@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_test_db():
    """Setup database connection for all tests"""
    await mongo_db.connect()
    
    # Clean up test data before each test
    db = mongo_db.get_database()
    try:
        # Drop all collections in the test database to ensure clean state
        collection_names = await db.list_collection_names()
        for collection_name in collection_names:
            await db[collection_name].delete_many({})
    except Exception as e:
        print(f"Warning: Could not clean up test database before test: {e}")
    
    yield
    
    # Clean up test data after each test
    try:
        collection_names = await db.list_collection_names()
        for collection_name in collection_names:
            await db[collection_name].delete_many({})
    except Exception as e:
        print(f"Warning: Could not clean up test database after test: {e}")
    
    await mongo_db.disconnect()


@pytest.fixture
def client():
    """Create a test client for the FastAPI application"""
    return TestClient(app)


@pytest_asyncio.fixture
async def async_client():
    """Create an async test client for the FastAPI application"""
    from httpx import ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def db():
    """Create a test database connection"""
    # Use a test database
    test_db_name = f"{settings.mongodb_db_name}_test"
    client = AsyncIOMotorClient(settings.mongodb_url)
    database = client[test_db_name]
    
    yield database
    
    # Cleanup: Instead of dropping database (not allowed in Atlas free tier),
    # drop all collections in the test database
    try:
        collection_names = await database.list_collection_names()
        for collection_name in collection_names:
            await database[collection_name].drop()
    except Exception as e:
        print(f"Warning: Could not clean up test database: {e}")
    finally:
        client.close()


@pytest.fixture
def sample_sensor_data():
    """Sample sensor data for testing"""
    return {
        "device_id": "ESP32_TEST_001",
        "timestamp": "2025-01-15T10:30:00Z",
        "ph": 7.2,
        "turbidity": 15.5,
        "temperature": 25.3,
        "tds": 150,
        "dissolved_oxygen": 8.5
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
async def test_user():
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
async def test_admin():
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
async def auth_headers(user_token):
    """Generate authorization headers for authenticated requests"""
    return {"Authorization": f"Bearer {user_token}"}
