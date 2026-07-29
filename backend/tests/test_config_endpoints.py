"""Tests for configuration and calibration endpoints"""

import pytest
from fastapi import status
from datetime import datetime
from httpx import AsyncClient, ASGITransport
from app.main import app

# These endpoint tests create their own HTTP clients, so connect the isolated
# database explicitly instead of making database setup global to every unit test.
pytestmark = pytest.mark.usefixtures("setup_test_db")



# Configuration Endpoint Tests

@pytest.mark.asyncio
async def test_get_thresholds():
    """Test GET /config/thresholds returns project threshold configuration"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/config/thresholds")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify all parameters are present
        assert "tds" in data
        assert "turbidity_index" in data
        assert "temperature" in data
        assert "ph" in data

        # Verify TDS bands structure
        assert len(data["tds"]) == 5
        assert data["tds"][0] == {"min": 0, "max": 300, "band": "Excellent"}
        assert data["tds"][1] == {"min": 300, "max": 600, "band": "Good"}
        assert data["tds"][2] == {"min": 600, "max": 900, "band": "Fair"}
        assert data["tds"][3] == {"min": 900, "max": 1200, "band": "Poor"}
        assert data["tds"][4]["min"] == 1200
        assert data["tds"][4]["band"] == "Unacceptable"

        # Verify Turbidity bands structure
        assert len(data["turbidity_index"]) == 4
        assert data["turbidity_index"][0] == {"min": 0, "max": 1, "band": "Excellent"}
        assert data["turbidity_index"][1] == {"min": 1, "max": 5, "band": "Acceptable"}
        assert data["turbidity_index"][2] == {"min": 5, "max": 50, "band": "Poor"}
        assert data["turbidity_index"][3]["min"] == 50
        assert data["turbidity_index"][3]["band"] == "Unsafe"

        # Verify Temperature bands structure
        assert len(data["temperature"]) == 3
        assert data["temperature"][0]["max"] == 15
        assert data["temperature"][0]["band"] == "Cold"
        assert data["temperature"][1] == {"min": 15, "max": 30, "band": "Normal"}
        assert data["temperature"][2]["min"] == 30
        assert data["temperature"][2]["band"] == "Warm"

        # Verify pH bands structure
        assert len(data["ph"]) == 3
        assert data["ph"][0] == {"min": 0, "max": 6.5, "band": "Acidic/Unsafe"}
        assert data["ph"][1] == {"min": 6.5, "max": 8.5, "band": "Good"}
        assert data["ph"][2] == {"min": 8.5, "max": 14, "band": "Alkaline/Unsafe"}


@pytest.mark.asyncio
async def test_get_config_without_auth():
    """Test GET /config without authentication returns 401"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/config")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_config_with_user_role(user_token):
    """Test GET /config with user role returns 403"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {user_token}"}
        response = await client.get("/api/v1/config", headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "admin" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_config_with_admin_role(admin_token):
    """Test GET /config with admin role returns configuration"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = await client.get("/api/v1/config", headers=headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify structure
        assert "sensor_polling_interval_seconds" in data
        assert "quality_thresholds" in data
        assert "risk_thresholds" in data
        assert "tank_dimensions" in data

        # Verify default values
        assert data["sensor_polling_interval_seconds"] == 30
        assert "ph" in data["quality_thresholds"]
        assert "turbidity_index" in data["quality_thresholds"]
        assert "temperature" in data["quality_thresholds"]
        assert "tds" in data["quality_thresholds"]
        # Note: dissolved_oxygen was removed from quality thresholds

        # Verify risk thresholds
        assert data["risk_thresholds"]["low_max"] == 0.4
        assert data["risk_thresholds"]["medium_max"] == 0.7

        # Verify tank dimensions
        assert data["tank_dimensions"]["height_cm"] == 200.0
        assert data["tank_dimensions"]["diameter_cm"] == 100.0
        assert data["tank_dimensions"]["capacity_liters"] == 1570.8


@pytest.mark.asyncio
async def test_update_config_without_auth():
    """Test PUT /config without authentication returns 401"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        update_data = {
            "sensor_polling_interval_seconds": 60
        }
        response = await client.put("/api/v1/config", json=update_data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_update_config_with_user_role(user_token):
    """Test PUT /config with user role returns 403"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {user_token}"}
        update_data = {
            "sensor_polling_interval_seconds": 60
        }
        response = await client.put("/api/v1/config", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_update_config_polling_interval(admin_token):
    """Test updating sensor polling interval"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        update_data = {
            "sensor_polling_interval_seconds": 60
        }

        response = await client.put("/api/v1/config", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["status"] == "success"
        assert "updated_at" in data

        # Verify update was applied
        response = await client.get("/api/v1/config", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["sensor_polling_interval_seconds"] == 60


@pytest.mark.asyncio
async def test_update_config_quality_thresholds(admin_token):
    """Test updating quality thresholds"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        update_data = {
            "quality_thresholds": {
                "ph": {
                    "safe_min": 6.0,
                    "safe_max": 9.0,
                    "unsafe_min": 5.0,
                    "unsafe_max": 10.0
                }
            }
        }

        response = await client.put("/api/v1/config", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK

        # Verify update was applied
        response = await client.get("/api/v1/config", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        ph_thresholds = response.json()["quality_thresholds"]["ph"]
        assert ph_thresholds["safe_min"] == 6.0
        assert ph_thresholds["safe_max"] == 9.0


@pytest.mark.asyncio
async def test_update_config_risk_thresholds(admin_token):
    """Test updating risk thresholds"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        update_data = {
            "risk_thresholds": {
                "low_max": 0.3,
                "medium_max": 0.6
            }
        }

        response = await client.put("/api/v1/config", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK

        # Verify update was applied
        response = await client.get("/api/v1/config", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        risk_thresholds = response.json()["risk_thresholds"]
        assert risk_thresholds["low_max"] == 0.3
        assert risk_thresholds["medium_max"] == 0.6


@pytest.mark.asyncio
async def test_update_config_tank_dimensions(admin_token):
    """Test updating tank dimensions"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        update_data = {
            "tank_dimensions": {
                "height_cm": 250.0,
                "diameter_cm": 120.0,
                "capacity_liters": 2827.4
            }
        }

        response = await client.put("/api/v1/config", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK

        # Verify update was applied
        response = await client.get("/api/v1/config", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        tank_dims = response.json()["tank_dimensions"]
        assert tank_dims["height_cm"] == 250.0
        assert tank_dims["diameter_cm"] == 120.0
        assert tank_dims["capacity_liters"] == 2827.4


@pytest.mark.asyncio
async def test_update_config_invalid_polling_interval(admin_token):
    """Test updating with invalid polling interval returns 422"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}

        # Too low
        update_data = {"sensor_polling_interval_seconds": 5}
        response = await client.put("/api/v1/config", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Too high
        update_data = {"sensor_polling_interval_seconds": 500}
        response = await client.put("/api/v1/config", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_update_config_invalid_risk_thresholds(admin_token):
    """Test updating with invalid risk thresholds returns 422"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}

        # medium_max <= low_max
        update_data = {
            "risk_thresholds": {
                "low_max": 0.5,
                "medium_max": 0.4
            }
        }
        response = await client.put("/api/v1/config", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_update_config_invalid_quality_thresholds(admin_token):
    """Test updating with invalid quality thresholds returns 400"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}

        # safe_min < unsafe_min
        update_data = {
            "quality_thresholds": {
                "ph": {
                    "safe_min": 4.0,
                    "safe_max": 9.0,
                    "unsafe_min": 5.0,
                    "unsafe_max": 10.0
                }
            }
        }
        response = await client.put("/api/v1/config", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "safe_min must be >= unsafe_min" in response.json()["detail"]


# Calibration Endpoint Tests

@pytest.mark.asyncio
async def test_calibrate_sensor_without_auth():
    """Test POST /config/calibration without authentication returns 401"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        calibration_data = {
            "device_id": "ESP32_001",
            "sensor_type": "ph",
            "reference_value": 7.0,
            "current_reading": 7.3
        }
        response = await client.post("/api/v1/config/calibration", json=calibration_data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_calibrate_sensor_with_user_role(user_token):
    """Test POST /config/calibration with user role returns 403"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {user_token}"}
        calibration_data = {
            "device_id": "ESP32_001",
            "sensor_type": "ph",
            "reference_value": 7.0,
            "current_reading": 7.3
        }
        response = await client.post("/api/v1/config/calibration", json=calibration_data, headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_calibrate_ph_sensor(admin_token):
    """Test calibrating pH sensor"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        calibration_data = {
            "device_id": "ESP32_001",
            "sensor_type": "ph",
            "reference_value": 7.0,
            "current_reading": 7.3
        }

        response = await client.post("/api/v1/config/calibration", json=calibration_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["status"] == "success"
        assert abs(data["calibration_offset"] - (-0.3)) < 0.01  # 7.0 - 7.3, allow floating point tolerance
        assert data["device_id"] == "ESP32_001"
        assert data["sensor_type"] == "ph"
        assert "applied_at" in data


@pytest.mark.asyncio
async def test_calibrate_turbidity_sensor(admin_token):
    """Test calibrating turbidity sensor"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        calibration_data = {
            "device_id": "ESP32_002",
            "sensor_type": "turbidity_index",
            "reference_value": 10.0,
            "current_reading": 12.5
        }

        response = await client.post("/api/v1/config/calibration", json=calibration_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["calibration_offset"] == -2.5  # 10.0 - 12.5
        assert data["sensor_type"] == "turbidity_index"


@pytest.mark.asyncio
async def test_calibrate_temperature_sensor(admin_token):
    """Test calibrating temperature sensor"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        calibration_data = {
            "device_id": "ESP32_003",
            "sensor_type": "temperature",
            "reference_value": 25.0,
            "current_reading": 24.5
        }

        response = await client.post("/api/v1/config/calibration", json=calibration_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["calibration_offset"] == 0.5  # 25.0 - 24.5
        assert data["sensor_type"] == "temperature"


@pytest.mark.asyncio
async def test_calibrate_tds_sensor(admin_token):
    """Test calibrating TDS sensor"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        calibration_data = {
            "device_id": "ESP32_004",
            "sensor_type": "tds",
            "reference_value": 150.0,
            "current_reading": 155.0
        }

        response = await client.post("/api/v1/config/calibration", json=calibration_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["calibration_offset"] == -5.0  # 150.0 - 155.0
        assert data["sensor_type"] == "tds"


@pytest.mark.asyncio
async def test_calibrate_dissolved_oxygen_sensor(admin_token):
    """Test calibrating dissolved oxygen sensor returns 422 (not a valid sensor type)"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        calibration_data = {
            "device_id": "ESP32_005",
            "sensor_type": "dissolved_oxygen",
            "reference_value": 8.0,
            "current_reading": 7.8
        }

        response = await client.post("/api/v1/config/calibration", json=calibration_data, headers=headers)
        # dissolved_oxygen is not a valid sensor type anymore (removed from system)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_calibrate_sensor_excessive_offset(admin_token):
    """Test calibration with excessive offset returns 400"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}

        # pH offset > 2.0
        calibration_data = {
            "device_id": "ESP32_006",
            "sensor_type": "ph",
            "reference_value": 7.0,
            "current_reading": 10.0
        }

        response = await client.post("/api/v1/config/calibration", json=calibration_data, headers=headers)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "offset too large" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_calibrate_sensor_creates_device_if_not_exists(admin_token, mongodb):
    """Test calibration creates device document if it doesn't exist"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        new_device_id = "ESP32_NEW_DEVICE"

        # Use async database access
        db = mongodb.get_database()

        # Ensure device doesn't exist
        await db.sensor_devices.delete_one({"device_id": new_device_id})

        calibration_data = {
            "device_id": new_device_id,
            "sensor_type": "ph",
            "reference_value": 7.0,
            "current_reading": 7.2
        }

        response = await client.post("/api/v1/config/calibration", json=calibration_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK

        # Verify device was created
        device = await db.sensor_devices.find_one({"device_id": new_device_id})
        assert device is not None
        assert abs(device["calibration"]["ph_offset"] - (-0.2)) < 0.01  # Allow floating point tolerance


@pytest.mark.asyncio
async def test_calibrate_sensor_updates_existing_device(admin_token, mongodb):
    """Test calibration updates existing device calibration"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        device_id = "ESP32_EXISTING"

        # Use async database access
        db = mongodb.get_database()

        # Create device with initial calibration
        await db.sensor_devices.delete_one({"device_id": device_id})
        await db.sensor_devices.insert_one({
            "device_id": device_id,
            "device_name": "Test Device",
            "calibration": {
                "ph_offset": 0.0,
                "turbidity_index_offset": 0.0,
                "temperature_offset": 0.0,
                "tds_offset": 0.0,
                "dissolved_oxygen_offset": 0.0
            },
            "is_online": True,
            "last_communication": datetime.utcnow(),
            "registered_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })

        # Apply calibration
        calibration_data = {
            "device_id": device_id,
            "sensor_type": "ph",
            "reference_value": 7.0,
            "current_reading": 7.5
        }

        response = await client.post("/api/v1/config/calibration", json=calibration_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK

        # Verify calibration was updated
        device = await db.sensor_devices.find_one({"device_id": device_id})
        assert device["calibration"]["ph_offset"] == -0.5
        # Other offsets should remain unchanged
        assert device["calibration"]["turbidity_index_offset"] == 0.0
