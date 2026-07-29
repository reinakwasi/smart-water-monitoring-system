"""Test for parameter_classifications in status endpoint (Task 3.3)"""

import pytest
from datetime import datetime
from fastapi import status as http_status


@pytest.mark.asyncio
async def test_current_status_includes_parameter_classifications(async_client, auth_headers, mongodb):
    """
    Test that current status endpoint includes parameter_classifications

    Requirements: 6.5-6.6
    Task: 3.3 - Update current status endpoint to include parameter_classifications
    """
    # Get database instance
    db = mongodb.get_database()

    # Insert test sensor reading WITH parameter_classifications
    sensor_reading = {
        "device_id": "TEST_DEVICE_001",
        "timestamp": datetime.utcnow(),
        "ph": 7.2,
        "turbidity_index": 15.5,
        "temperature": 22.3,
        "tds": 274.0,
        "dissolved_oxygen": 8.5,
        "classification": "Safe",
        "classification_confidence": 0.92,
        "risk_score": 0.35,
        "risk_level": "Low",
        "parameter_classifications": {
            "ph": "Excellent",
            "turbidity_index": "Good",
            "temperature": "Excellent",
            "tds": "Good"
        },
        "classification_shap_values": {
            "ph": 0.12,
            "turbidity_index": 0.45,
            "temperature": -0.08,
            "tds": 0.23,
            "dissolved_oxygen": -0.15
        },
        "risk_shap_values": {
            "ph": 0.05,
            "turbidity_index": 0.18,
            "temperature": -0.03,
            "tds": 0.10,
            "dissolved_oxygen": -0.08
        },
        "created_at": datetime.utcnow()
    }
    await db.sensor_readings.insert_one(sensor_reading)

    # Insert test tank reading
    tank_reading = {
        "device_id": "TEST_DEVICE_001",
        "timestamp": datetime.utcnow(),
        "distance_cm": 45.2,
        "tank_height_cm": 200.0,
        "level_percent": 77.4,
        "volume_liters": 1215.8,
        "tank_status": "Full",
        "created_at": datetime.utcnow()
    }
    await db.tank_readings.insert_one(tank_reading)

    # Make request
    response = await async_client.get("/api/v1/status/current-status", headers=auth_headers)

    # Assertions
    assert response.status_code == http_status.HTTP_200_OK
    data = response.json()

    # Check water quality status includes parameter_classifications
    assert "water_quality" in data
    assert "parameter_classifications" in data["water_quality"]

    # Verify parameter_classifications structure
    param_classifications = data["water_quality"]["parameter_classifications"]
    assert "ph" in param_classifications
    assert "turbidity_index" in param_classifications
    assert "temperature" in param_classifications
    assert "tds" in param_classifications

    # Verify values match what we stored
    assert param_classifications["ph"] == "Excellent"
    assert param_classifications["turbidity_index"] == "Good"
    assert param_classifications["temperature"] == "Excellent"
    assert param_classifications["tds"] == "Good"


@pytest.mark.asyncio
async def test_current_status_backward_compatibility_without_classifications(async_client, auth_headers, mongodb):
    """
    Test backward compatibility when parameter_classifications are not present in database

    Requirements: 6.5-6.6
    Task: 3.3 - Ensure backward compatibility with existing response structure
    """
    # Clear the status cache to prevent interference from previous tests
    from app.api.v1.endpoints.status import _status_cache
    _status_cache["data"] = None
    _status_cache["timestamp"] = None

    # Get database instance
    db = mongodb.get_database()

    # Insert test sensor reading WITHOUT parameter_classifications (old format)
    sensor_reading = {
        "device_id": "TEST_DEVICE_002",
        "timestamp": datetime.utcnow(),
        "ph": 7.0,
        "turbidity_index": 10.0,
        "temperature": 24.0,
        "tds": 150.0,
        "dissolved_oxygen": 8.0,
        "classification": "Safe",
        "classification_confidence": 0.90,
        "risk_score": 0.30,
        "risk_level": "Low",
        "classification_shap_values": {},
        "risk_shap_values": {},
        "created_at": datetime.utcnow()
    }
    await db.sensor_readings.insert_one(sensor_reading)

    # Insert test tank reading
    tank_reading = {
        "device_id": "TEST_DEVICE_002",
        "timestamp": datetime.utcnow(),
        "distance_cm": 50.0,
        "tank_height_cm": 200.0,
        "level_percent": 75.0,
        "volume_liters": 1178.1,
        "tank_status": "Full",
        "created_at": datetime.utcnow()
    }
    await db.tank_readings.insert_one(tank_reading)

    # Make request
    response = await async_client.get("/api/v1/status/current-status", headers=auth_headers)

    # Assertions
    assert response.status_code == http_status.HTTP_200_OK
    data = response.json()

    # Check water quality status includes parameter_classifications (even if empty)
    assert "water_quality" in data
    assert "parameter_classifications" in data["water_quality"]

    # Verify parameter_classifications structure exists with empty strings for backward compatibility
    param_classifications = data["water_quality"]["parameter_classifications"]
    assert "ph" in param_classifications
    assert "turbidity_index" in param_classifications
    assert "temperature" in param_classifications
    assert "tds" in param_classifications

    # Values should be empty strings when not present in database
    assert param_classifications["ph"] == ""
    assert param_classifications["turbidity_index"] == ""
    assert param_classifications["temperature"] == ""
    assert param_classifications["tds"] == ""
