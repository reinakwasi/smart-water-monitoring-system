"""Tests for sensor data ingestion endpoints"""

import pytest
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_sensor_data_endpoint_structure():
    """Test that sensor data endpoint is registered and accepts correct payload"""
    from httpx import ASGITransport
    
    # Create async client
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test with valid payload structure
        payload = {
            "device_id": "ESP32_TEST_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": 7.2,
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 150.0,
            "dissolved_oxygen": 8.5
        }
        
        # Mock the ML service and SHAP service
        with patch('app.api.v1.endpoints.sensor.ml_service') as mock_ml_service, \
             patch('app.api.v1.endpoints.sensor.shap_service') as mock_shap_service, \
             patch('app.api.v1.endpoints.sensor.mongodb') as mock_mongodb:
            
            # Configure mocks
            mock_ml_service.is_ready.return_value = True
            mock_shap_service.is_ready.return_value = True
            
            mock_ml_service.classify_water_quality.return_value = {
                'classification': 'Safe',
                'confidence': 0.92,
                'probabilities': {'Safe': 0.92, 'Warning': 0.05, 'Unsafe': 0.03}
            }
            
            mock_ml_service.predict_contamination_risk.return_value = {
                'risk_score': 0.35,
                'risk_level': 'Low'
            }
            
            mock_shap_service.explain_classification.return_value = {
                'shap_values': {
                    'ph': 0.12,
                    'turbidity': 0.45,
                    'temperature': -0.08,
                    'tds': 0.23,
                    'dissolved_oxygen': -0.15
                },
                'top_factors': [
                    {'feature': 'turbidity', 'shap_value': 0.45, 'direction': 'positive'},
                    {'feature': 'tds', 'shap_value': 0.23, 'direction': 'positive'},
                    {'feature': 'dissolved_oxygen', 'shap_value': -0.15, 'direction': 'negative'}
                ]
            }
            
            mock_shap_service.explain_risk_prediction.return_value = {
                'shap_values': {
                    'ph': 0.05,
                    'turbidity': 0.18,
                    'temperature': -0.03,
                    'tds': 0.10,
                    'dissolved_oxygen': -0.08
                },
                'top_factors': [
                    {'feature': 'turbidity', 'shap_value': 0.18, 'direction': 'positive'},
                    {'feature': 'tds', 'shap_value': 0.10, 'direction': 'positive'},
                    {'feature': 'dissolved_oxygen', 'shap_value': -0.08, 'direction': 'negative'}
                ]
            }
            
            # Mock database
            mock_db = AsyncMock()
            mock_db.sensor_readings.find.return_value.sort.return_value.limit.return_value = AsyncMock()
            mock_db.sensor_readings.find.return_value.sort.return_value.limit.return_value.__aiter__ = AsyncMock(return_value=iter([]))
            
            mock_insert_result = Mock()
            mock_insert_result.inserted_id = "65a1b2c3d4e5f6g7h8i9j0k1"
            mock_db.sensor_readings.insert_one = AsyncMock(return_value=mock_insert_result)
            
            mock_mongodb.get_database.return_value = mock_db
            
            # Make request
            response = await client.post("/api/v1/sensor/sensor-data", json=payload)
            
            # Verify response structure
            assert response.status_code == 201
            data = response.json()
            
            assert data["status"] == "success"
            assert "reading_id" in data
            assert "classification" in data
            assert "risk_prediction" in data
            assert "timestamp" in data
            
            # Verify classification structure
            assert data["classification"]["quality"] == "Safe"
            assert data["classification"]["confidence"] == 0.92
            assert "shap_explanation" in data["classification"]
            
            # Verify risk prediction structure
            assert data["risk_prediction"]["risk_score"] == 0.35
            assert data["risk_prediction"]["risk_level"] == "Low"
            assert "shap_explanation" in data["risk_prediction"]


@pytest.mark.asyncio
async def test_tank_level_endpoint_structure():
    """Test that tank level endpoint is registered and accepts correct payload"""
    from httpx import ASGITransport
    
    # Create async client
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test with valid payload structure
        payload = {
            "device_id": "ESP32_TEST_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "distance_cm": 45.2,
            "tank_height_cm": 200.0
        }
        
        # Mock database
        with patch('app.api.v1.endpoints.sensor.mongodb') as mock_mongodb:
            mock_db = AsyncMock()
            
            mock_insert_result = Mock()
            mock_insert_result.inserted_id = "65a1b2c3d4e5f6g7h8i9j0k2"
            mock_db.tank_readings.insert_one = AsyncMock(return_value=mock_insert_result)
            
            mock_mongodb.get_database.return_value = mock_db
            
            # Make request
            response = await client.post("/api/v1/sensor/tank-level", json=payload)
            
            # Verify response structure
            assert response.status_code == 201
            data = response.json()
            
            assert data["status"] == "success"
            assert "reading_id" in data
            assert "tank_status" in data
            assert "level_percent" in data
            assert "volume_liters" in data
            assert "timestamp" in data
            
            # Verify calculations
            # distance_cm = 45.2, tank_height_cm = 200.0
            # water_height = 200 - 45.2 = 154.8
            # level_percent = (154.8 / 200) * 100 = 77.4%
            assert data["level_percent"] == 77.4
            
            # Tank status should be "Full" (>= 50%)
            assert data["tank_status"] == "Full"
            
            # Volume calculation: π * (50)² * 154.8 / 1000 ≈ 1217.4 liters
            assert data["volume_liters"] > 0


@pytest.mark.asyncio
async def test_tank_level_classification():
    """Test tank status classification logic"""
    from app.api.v1.endpoints.sensor import classify_tank_status, TankStatus
    
    # Test Empty (< 10%)
    assert classify_tank_status(5.0) == TankStatus.EMPTY
    assert classify_tank_status(9.9) == TankStatus.EMPTY
    
    # Test Half_Full (10% <= level < 50%)
    assert classify_tank_status(10.0) == TankStatus.HALF_FULL
    assert classify_tank_status(30.0) == TankStatus.HALF_FULL
    assert classify_tank_status(49.9) == TankStatus.HALF_FULL
    
    # Test Full (50% <= level < 95%)
    assert classify_tank_status(50.0) == TankStatus.FULL
    assert classify_tank_status(75.0) == TankStatus.FULL
    assert classify_tank_status(94.9) == TankStatus.FULL
    
    # Test Overflow (>= 95%)
    assert classify_tank_status(95.0) == TankStatus.OVERFLOW
    assert classify_tank_status(100.0) == TankStatus.OVERFLOW


@pytest.mark.asyncio
async def test_risk_level_classification():
    """Test risk level classification logic"""
    from app.api.v1.endpoints.sensor import classify_risk_level, RiskLevel
    
    # Test Low (< 0.4)
    assert classify_risk_level(0.0) == RiskLevel.LOW
    assert classify_risk_level(0.2) == RiskLevel.LOW
    assert classify_risk_level(0.39) == RiskLevel.LOW
    
    # Test Medium (0.4 <= risk < 0.7)
    assert classify_risk_level(0.4) == RiskLevel.MEDIUM
    assert classify_risk_level(0.5) == RiskLevel.MEDIUM
    assert classify_risk_level(0.69) == RiskLevel.MEDIUM
    
    # Test High (>= 0.7)
    assert classify_risk_level(0.7) == RiskLevel.HIGH
    assert classify_risk_level(0.85) == RiskLevel.HIGH
    assert classify_risk_level(1.0) == RiskLevel.HIGH


@pytest.mark.asyncio
async def test_tank_volume_calculation():
    """Test tank volume calculation"""
    from app.api.v1.endpoints.sensor import calculate_tank_volume
    import math
    
    # Test with 50% level, 200cm height, 100cm diameter
    # Expected: π * (50)² * 100 / 1000 = 785.4 liters
    volume = calculate_tank_volume(50.0, 200.0, 100.0)
    expected = math.pi * (50 ** 2) * 100 / 1000
    assert abs(volume - expected) < 0.1
    
    # Test with 100% level
    volume = calculate_tank_volume(100.0, 200.0, 100.0)
    expected = math.pi * (50 ** 2) * 200 / 1000
    assert abs(volume - expected) < 0.1
    
    # Test with 0% level
    volume = calculate_tank_volume(0.0, 200.0, 100.0)
    assert volume == 0.0


@pytest.mark.asyncio
async def test_sensor_data_validation():
    """Test sensor data validation"""
    from httpx import ASGITransport
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test with invalid pH (> 14)
        payload = {
            "device_id": "ESP32_TEST_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": 15.0,  # Invalid
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 150.0,
            "dissolved_oxygen": 8.5
        }
        
        response = await client.post("/api/v1/sensor/sensor-data", json=payload)
        assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_tank_level_validation():
    """Test tank level validation"""
    from httpx import ASGITransport
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test with distance exceeding tank height
        payload = {
            "device_id": "ESP32_TEST_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "distance_cm": 250.0,  # Exceeds tank height
            "tank_height_cm": 200.0
        }
        
        with patch('app.api.v1.endpoints.sensor.mongodb') as mock_mongodb:
            mock_db = AsyncMock()
            mock_mongodb.get_database.return_value = mock_db
            
            response = await client.post("/api/v1/sensor/tank-level", json=payload)
            assert response.status_code == 400  # Bad request
            assert "exceed" in response.json()["detail"].lower()
