"""Tests for status and historical data endpoints"""

import pytest
from datetime import datetime, timedelta
from fastapi import status as http_status
from bson import ObjectId


class TestCurrentStatusEndpoint:
    """Tests for GET /api/v1/status/current-status endpoint"""
    
    @pytest.mark.asyncio
    async def test_get_current_status_success(self, async_client, auth_headers, mongodb):
        """Test successful retrieval of current status"""
        # Get database instance
        db = mongodb.get_database()
        
        # Insert test sensor reading
        sensor_reading = {
            "device_id": "TEST_DEVICE_001",
            "timestamp": datetime.utcnow(),
            "ph": 7.2,
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 150.0,
            "dissolved_oxygen": 8.5,
            "classification": "Safe",
            "classification_confidence": 0.92,
            "risk_score": 0.35,
            "risk_level": "Low",
            "classification_shap_values": {
                "ph": 0.12,
                "turbidity": 0.45,
                "temperature": -0.08,
                "tds": 0.23,
                "dissolved_oxygen": -0.15
            },
            "risk_shap_values": {
                "ph": 0.05,
                "turbidity": 0.18,
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
        
        # Check water quality status
        assert "water_quality" in data
        assert data["water_quality"]["classification"] == "Safe"
        assert data["water_quality"]["confidence"] == 0.92
        assert "parameters" in data["water_quality"]
        assert data["water_quality"]["parameters"]["ph"] == 7.2
        assert data["water_quality"]["parameters"]["turbidity"] == 15.5
        assert "shap_explanation" in data["water_quality"]
        
        # Check contamination risk status
        assert "contamination_risk" in data
        assert data["contamination_risk"]["risk_score"] == 0.35
        assert data["contamination_risk"]["risk_level"] == "Low"
        assert "shap_explanation" in data["contamination_risk"]
        
        # Check tank status
        assert "tank_status" in data
        assert data["tank_status"]["status"] == "Full"
        assert data["tank_status"]["level_percent"] == 77.4
        assert data["tank_status"]["volume_liters"] == 1215.8
    
    @pytest.mark.asyncio
    async def test_get_current_status_with_device_filter(self, async_client, auth_headers, mongodb):
        """Test current status with device_id filter"""
        # Get database instance
        db = mongodb.get_database()
        
        # Insert readings for multiple devices
        device1_sensor = {
            "device_id": "DEVICE_001",
            "timestamp": datetime.utcnow(),
            "ph": 7.0,
            "turbidity": 10.0,
            "temperature": 24.0,
            "tds": 140.0,
            "dissolved_oxygen": 8.0,
            "classification": "Safe",
            "classification_confidence": 0.90,
            "risk_score": 0.30,
            "risk_level": "Low",
            "classification_shap_values": {},
            "risk_shap_values": {},
            "created_at": datetime.utcnow()
        }
        
        device2_sensor = {
            "device_id": "DEVICE_002",
            "timestamp": datetime.utcnow(),
            "ph": 6.5,
            "turbidity": 20.0,
            "temperature": 26.0,
            "tds": 200.0,
            "dissolved_oxygen": 7.5,
            "classification": "Warning",
            "classification_confidence": 0.85,
            "risk_score": 0.55,
            "risk_level": "Medium",
            "classification_shap_values": {},
            "risk_shap_values": {},
            "created_at": datetime.utcnow()
        }
        
        await db.sensor_readings.insert_many([device1_sensor, device2_sensor])
        
        # Insert tank readings
        device1_tank = {
            "device_id": "DEVICE_001",
            "timestamp": datetime.utcnow(),
            "distance_cm": 50.0,
            "tank_height_cm": 200.0,
            "level_percent": 75.0,
            "volume_liters": 1178.1,
            "tank_status": "Full",
            "created_at": datetime.utcnow()
        }
        
        device2_tank = {
            "device_id": "DEVICE_002",
            "timestamp": datetime.utcnow(),
            "distance_cm": 100.0,
            "tank_height_cm": 200.0,
            "level_percent": 50.0,
            "volume_liters": 785.4,
            "tank_status": "Half_Full",
            "created_at": datetime.utcnow()
        }
        
        await db.tank_readings.insert_many([device1_tank, device2_tank])
        
        # Request status for DEVICE_002
        response = await async_client.get(
            "/api/v1/status/current-status?device_id=DEVICE_002",
            headers=auth_headers
        )
        
        # Assertions
        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        
        # Should return DEVICE_002 data
        assert data["water_quality"]["classification"] == "Warning"
        assert data["water_quality"]["parameters"]["ph"] == 6.5
        assert data["contamination_risk"]["risk_level"] == "Medium"
        assert data["tank_status"]["status"] == "Half_Full"
    
    @pytest.mark.asyncio
    async def test_get_current_status_no_data(self, async_client, auth_headers, mongodb):
        """Test current status when no data exists"""
        # Make request without inserting any data
        response = await async_client.get("/api/v1/status/current-status", headers=auth_headers)
        
        # Assertions
        assert response.status_code == http_status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "detail" in data
        assert "No sensor data available" in data["detail"]
    
    @pytest.mark.asyncio
    async def test_get_current_status_unauthorized(self, async_client, mongodb):
        """Test current status without authentication"""
        # Get database instance
        db = mongodb.get_database()
        
        # Insert test data
        sensor_reading = {
            "device_id": "TEST_DEVICE",
            "timestamp": datetime.utcnow(),
            "ph": 7.0,
            "turbidity": 10.0,
            "temperature": 24.0,
            "tds": 140.0,
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
        
        tank_reading = {
            "device_id": "TEST_DEVICE",
            "timestamp": datetime.utcnow(),
            "distance_cm": 50.0,
            "tank_height_cm": 200.0,
            "level_percent": 75.0,
            "volume_liters": 1178.1,
            "tank_status": "Full",
            "created_at": datetime.utcnow()
        }
        await db.tank_readings.insert_one(tank_reading)
        
        # Make request without auth headers
        response = await async_client.get("/api/v1/status/current-status")
        
        # Assertions
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.asyncio
    async def test_get_current_status_caching(self, async_client, auth_headers, mongodb):
        """Test that current status is cached for 30 seconds"""
        # Get database instance
        db = mongodb.get_database()
        
        # Insert initial data
        sensor_reading = {
            "device_id": "TEST_DEVICE",
            "timestamp": datetime.utcnow(),
            "ph": 7.0,
            "turbidity": 10.0,
            "temperature": 24.0,
            "tds": 140.0,
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
        
        tank_reading = {
            "device_id": "TEST_DEVICE",
            "timestamp": datetime.utcnow(),
            "distance_cm": 50.0,
            "tank_height_cm": 200.0,
            "level_percent": 75.0,
            "volume_liters": 1178.1,
            "tank_status": "Full",
            "created_at": datetime.utcnow()
        }
        await db.tank_readings.insert_one(tank_reading)
        
        # First request
        response1 = await async_client.get("/api/v1/status/current-status", headers=auth_headers)
        assert response1.status_code == http_status.HTTP_200_OK
        data1 = response1.json()
        
        # Update data in database
        await db.sensor_readings.update_one(
            {"device_id": "TEST_DEVICE"},
            {"$set": {"classification": "Warning", "ph": 6.0}}
        )
        
        # Second request (should return cached data)
        response2 = await async_client.get("/api/v1/status/current-status", headers=auth_headers)
        assert response2.status_code == http_status.HTTP_200_OK
        data2 = response2.json()
        
        # Should still show old data due to caching
        assert data2["water_quality"]["classification"] == "Safe"
        assert data2["water_quality"]["parameters"]["ph"] == 7.0


class TestHistoricalDataEndpoint:
    """Tests for GET /api/v1/status/historical-data endpoint"""
    
    @pytest.mark.asyncio
    async def test_get_historical_data_success(self, async_client, auth_headers, mongodb):
        """Test successful retrieval of historical data"""
        # Get database instance
        db = mongodb.get_database()
        
        # Insert test sensor readings
        now = datetime.utcnow()
        sensor_readings = []
        
        for i in range(5):
            reading = {
                "device_id": "TEST_DEVICE",
                "timestamp": now - timedelta(hours=i),
                "ph": 7.0 + (i * 0.1),
                "turbidity": 10.0 + (i * 2.0),
                "temperature": 24.0 + (i * 0.5),
                "tds": 140.0 + (i * 5.0),
                "dissolved_oxygen": 8.0 - (i * 0.1),
                "classification": "Safe",
                "classification_confidence": 0.90,
                "risk_score": 0.30 + (i * 0.05),
                "risk_level": "Low",
                "classification_shap_values": {},
                "risk_shap_values": {},
                "created_at": datetime.utcnow()
            }
            sensor_readings.append(reading)
        
        await db.sensor_readings.insert_many(sensor_readings)
        
        # Insert tank readings
        tank_readings = []
        for i in range(5):
            reading = {
                "device_id": "TEST_DEVICE",
                "timestamp": now - timedelta(hours=i),
                "distance_cm": 50.0 + (i * 5.0),
                "tank_height_cm": 200.0,
                "level_percent": 75.0 - (i * 2.5),
                "volume_liters": 1178.1 - (i * 39.3),
                "tank_status": "Full",
                "created_at": datetime.utcnow()
            }
            tank_readings.append(reading)
        
        await db.tank_readings.insert_many(tank_readings)
        
        # Make request
        start_date = (now - timedelta(hours=6)).isoformat()
        end_date = now.isoformat()
        
        response = await async_client.get(
            f"/api/v1/status/historical-data?start_date={start_date}&end_date={end_date}",
            headers=auth_headers
        )
        
        # Assertions
        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        
        assert "data" in data
        assert "count" in data
        assert data["count"] == 5
        assert len(data["data"]) == 5
        
        # Check first data point
        first_point = data["data"][0]
        assert "timestamp" in first_point
        assert "parameters" in first_point
        assert "classification" in first_point
        assert "risk_score" in first_point
        assert "tank_level_percent" in first_point
        
        # Check parameters
        assert "ph" in first_point["parameters"]
        assert "turbidity" in first_point["parameters"]
        assert "temperature" in first_point["parameters"]
        assert "tds" in first_point["parameters"]
        assert "dissolved_oxygen" in first_point["parameters"]
    
    @pytest.mark.asyncio
    async def test_get_historical_data_with_parameter_filter(self, async_client, auth_headers, mongodb):
        """Test historical data with parameter filter"""
        # Get database instance
        db = mongodb.get_database()
        
        # Insert test data
        now = datetime.utcnow()
        sensor_reading = {
            "device_id": "TEST_DEVICE",
            "timestamp": now,
            "ph": 7.2,
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 150.0,
            "dissolved_oxygen": 8.5,
            "classification": "Safe",
            "classification_confidence": 0.92,
            "risk_score": 0.35,
            "risk_level": "Low",
            "classification_shap_values": {},
            "risk_shap_values": {},
            "created_at": datetime.utcnow()
        }
        await db.sensor_readings.insert_one(sensor_reading)
        
        # Request with pH filter
        start_date = (now - timedelta(hours=1)).isoformat()
        end_date = (now + timedelta(hours=1)).isoformat()
        
        response = await async_client.get(
            f"/api/v1/status/historical-data?start_date={start_date}&end_date={end_date}&parameter=ph",
            headers=auth_headers
        )
        
        # Assertions
        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        
        assert data["count"] == 1
        first_point = data["data"][0]
        
        # Should only contain pH parameter
        assert "ph" in first_point["parameters"]
        assert len(first_point["parameters"]) == 1
        assert first_point["parameters"]["ph"] == 7.2
    
    @pytest.mark.asyncio
    async def test_get_historical_data_with_device_filter(self, async_client, auth_headers, mongodb):
        """Test historical data with device_id filter"""
        # Get database instance
        db = mongodb.get_database()
        
        # Insert data for multiple devices
        now = datetime.utcnow()
        
        device1_reading = {
            "device_id": "DEVICE_001",
            "timestamp": now,
            "ph": 7.0,
            "turbidity": 10.0,
            "temperature": 24.0,
            "tds": 140.0,
            "dissolved_oxygen": 8.0,
            "classification": "Safe",
            "classification_confidence": 0.90,
            "risk_score": 0.30,
            "risk_level": "Low",
            "classification_shap_values": {},
            "risk_shap_values": {},
            "created_at": datetime.utcnow()
        }
        
        device2_reading = {
            "device_id": "DEVICE_002",
            "timestamp": now,
            "ph": 6.5,
            "turbidity": 20.0,
            "temperature": 26.0,
            "tds": 200.0,
            "dissolved_oxygen": 7.5,
            "classification": "Warning",
            "classification_confidence": 0.85,
            "risk_score": 0.55,
            "risk_level": "Medium",
            "classification_shap_values": {},
            "risk_shap_values": {},
            "created_at": datetime.utcnow()
        }
        
        await db.sensor_readings.insert_many([device1_reading, device2_reading])
        
        # Request data for DEVICE_001 only
        start_date = (now - timedelta(hours=1)).isoformat()
        end_date = (now + timedelta(hours=1)).isoformat()
        
        response = await async_client.get(
            f"/api/v1/status/historical-data?start_date={start_date}&end_date={end_date}&device_id=DEVICE_001",
            headers=auth_headers
        )
        
        # Assertions
        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        
        assert data["count"] == 1
        assert data["data"][0]["parameters"]["ph"] == 7.0
        assert data["data"][0]["classification"] == "Safe"
    
    @pytest.mark.asyncio
    async def test_get_historical_data_with_limit(self, async_client, auth_headers, mongodb):
        """Test historical data with limit parameter"""
        # Get database instance
        db = mongodb.get_database()
        
        # Insert 10 readings
        now = datetime.utcnow()
        sensor_readings = []
        
        for i in range(10):
            reading = {
                "device_id": "TEST_DEVICE",
                "timestamp": now - timedelta(hours=i),
                "ph": 7.0,
                "turbidity": 10.0,
                "temperature": 24.0,
                "tds": 140.0,
                "dissolved_oxygen": 8.0,
                "classification": "Safe",
                "classification_confidence": 0.90,
                "risk_score": 0.30,
                "risk_level": "Low",
                "classification_shap_values": {},
                "risk_shap_values": {},
                "created_at": datetime.utcnow()
            }
            sensor_readings.append(reading)
        
        await db.sensor_readings.insert_many(sensor_readings)
        
        # Request with limit=5
        start_date = (now - timedelta(hours=12)).isoformat()
        end_date = now.isoformat()
        
        response = await async_client.get(
            f"/api/v1/status/historical-data?start_date={start_date}&end_date={end_date}&limit=5",
            headers=auth_headers
        )
        
        # Assertions
        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        
        assert data["count"] == 5
        assert len(data["data"]) == 5
    
    @pytest.mark.asyncio
    async def test_get_historical_data_invalid_date_range(self, async_client, auth_headers, mongodb):
        """Test historical data with invalid date range"""
        now = datetime.utcnow()
        start_date = now.isoformat()
        end_date = (now - timedelta(hours=1)).isoformat()  # End before start
        
        response = await async_client.get(
            f"/api/v1/status/historical-data?start_date={start_date}&end_date={end_date}",
            headers=auth_headers
        )
        
        # Assertions
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "detail" in data
        assert "start_date must be before end_date" in data["detail"]
    
    @pytest.mark.asyncio
    async def test_get_historical_data_invalid_parameter(self, async_client, auth_headers, mongodb):
        """Test historical data with invalid parameter filter"""
        now = datetime.utcnow()
        start_date = (now - timedelta(hours=1)).isoformat()
        end_date = now.isoformat()
        
        response = await async_client.get(
            f"/api/v1/status/historical-data?start_date={start_date}&end_date={end_date}&parameter=invalid_param",
            headers=auth_headers
        )
        
        # Assertions
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "detail" in data
        assert "Invalid parameter" in data["detail"]
    
    @pytest.mark.asyncio
    async def test_get_historical_data_unauthorized(self, async_client, mongodb):
        """Test historical data without authentication"""
        now = datetime.utcnow()
        start_date = (now - timedelta(hours=1)).isoformat()
        end_date = now.isoformat()
        
        response = await async_client.get(
            f"/api/v1/status/historical-data?start_date={start_date}&end_date={end_date}"
        )
        
        # Assertions
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.asyncio
    async def test_get_historical_data_missing_required_params(self, async_client, auth_headers, mongodb):
        """Test historical data without required parameters"""
        # Missing both start_date and end_date
        response = await async_client.get("/api/v1/status/historical-data", headers=auth_headers)
        
        # Assertions
        assert response.status_code == http_status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_get_historical_data_empty_result(self, async_client, auth_headers, mongodb):
        """Test historical data when no data exists in range"""
        now = datetime.utcnow()
        start_date = (now - timedelta(days=30)).isoformat()
        end_date = (now - timedelta(days=29)).isoformat()
        
        response = await async_client.get(
            f"/api/v1/status/historical-data?start_date={start_date}&end_date={end_date}",
            headers=auth_headers
        )
        
        # Assertions
        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        
        assert data["count"] == 0
        assert len(data["data"]) == 0
