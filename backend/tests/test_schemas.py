"""Tests for Pydantic schemas validation"""

import pytest
from datetime import datetime
from pydantic import ValidationError

from app.models.schemas import (
    SensorDataRequest,
    TankLevelRequest,
    WaterQualityClassification,
    RiskLevel,
    TankStatus,
)


class TestSensorDataRequest:
    """Test SensorDataRequest validation"""
    
    def test_valid_sensor_data(self):
        """Test valid sensor data passes validation"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": 7.2,
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 150.0,
            "dissolved_oxygen": 8.5
        }
        
        request = SensorDataRequest(**data)
        
        assert request.device_id == "ESP32_001"
        assert request.ph == 7.2
        assert request.turbidity == 15.5
        assert request.temperature == 25.3
        assert request.tds == 150.0
        assert request.dissolved_oxygen == 8.5
    
    def test_ph_out_of_range_low(self):
        """Test pH below 0 is rejected (Requirement 1.9)"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": -1.0,
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 150.0,
            "dissolved_oxygen": 8.5
        }
        
        with pytest.raises(ValidationError) as exc_info:
            SensorDataRequest(**data)
        
        assert "ph" in str(exc_info.value)
    
    def test_ph_out_of_range_high(self):
        """Test pH above 14 is rejected (Requirement 1.9)"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": 15.0,
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 150.0,
            "dissolved_oxygen": 8.5
        }
        
        with pytest.raises(ValidationError) as exc_info:
            SensorDataRequest(**data)
        
        assert "ph" in str(exc_info.value)
    
    def test_turbidity_out_of_range(self):
        """Test turbidity above 3000 is rejected (Requirement 1.9)"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": 7.2,
            "turbidity": 3500.0,
            "temperature": 25.3,
            "tds": 150.0,
            "dissolved_oxygen": 8.5
        }
        
        with pytest.raises(ValidationError) as exc_info:
            SensorDataRequest(**data)
        
        assert "turbidity" in str(exc_info.value)
    
    def test_temperature_out_of_range(self):
        """Test temperature outside -55 to 125°C is rejected (Requirement 1.9)"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": 7.2,
            "turbidity": 15.5,
            "temperature": 150.0,
            "tds": 150.0,
            "dissolved_oxygen": 8.5
        }
        
        with pytest.raises(ValidationError) as exc_info:
            SensorDataRequest(**data)
        
        assert "temperature" in str(exc_info.value)
    
    def test_tds_out_of_range(self):
        """Test TDS above 1000 is rejected (Requirement 1.9)"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": 7.2,
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 1500.0,
            "dissolved_oxygen": 8.5
        }
        
        with pytest.raises(ValidationError) as exc_info:
            SensorDataRequest(**data)
        
        assert "tds" in str(exc_info.value)
    
    def test_dissolved_oxygen_out_of_range(self):
        """Test dissolved oxygen above 20 is rejected (Requirement 1.9)"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": 7.2,
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 150.0,
            "dissolved_oxygen": 25.0
        }
        
        with pytest.raises(ValidationError) as exc_info:
            SensorDataRequest(**data)
        
        assert "dissolved_oxygen" in str(exc_info.value)
    
    def test_ph_precision_rounding(self):
        """Test pH is rounded to ±0.1 precision (Requirement 1.1)"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": 7.234,
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 150.0,
            "dissolved_oxygen": 8.5
        }
        
        request = SensorDataRequest(**data)
        assert request.ph == 7.2
    
    def test_tds_precision_rounding(self):
        """Test TDS is rounded to ±10 ppm precision (Requirement 1.4)"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": 7.2,
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 150.7,
            "dissolved_oxygen": 8.5
        }
        
        request = SensorDataRequest(**data)
        assert request.tds == 151.0


class TestTankLevelRequest:
    """Test TankLevelRequest validation"""
    
    def test_valid_tank_level(self):
        """Test valid tank level data passes validation"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "distance_cm": 45.2,
            "tank_height_cm": 200.0
        }
        
        request = TankLevelRequest(**data)
        
        assert request.device_id == "ESP32_001"
        assert request.distance_cm == 45.2
        assert request.tank_height_cm == 200.0
    
    def test_distance_precision_rounding(self):
        """Test distance is rounded to ±2 cm precision (Requirement 2.1)"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "distance_cm": 45.234,
            "tank_height_cm": 200.0
        }
        
        request = TankLevelRequest(**data)
        assert request.distance_cm == 45.2
    
    def test_negative_distance_rejected(self):
        """Test negative distance is rejected"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "distance_cm": -10.0,
            "tank_height_cm": 200.0
        }
        
        with pytest.raises(ValidationError) as exc_info:
            TankLevelRequest(**data)
        
        assert "distance_cm" in str(exc_info.value)


class TestEnums:
    """Test enum validations"""
    
    def test_water_quality_classification_values(self):
        """Test WaterQualityClassification enum values"""
        assert WaterQualityClassification.SAFE == "Safe"
        assert WaterQualityClassification.WARNING == "Warning"
        assert WaterQualityClassification.UNSAFE == "Unsafe"
    
    def test_risk_level_values(self):
        """Test RiskLevel enum values"""
        assert RiskLevel.LOW == "Low"
        assert RiskLevel.MEDIUM == "Medium"
        assert RiskLevel.HIGH == "High"
    
    def test_tank_status_values(self):
        """Test TankStatus enum values"""
        assert TankStatus.EMPTY == "Empty"
        assert TankStatus.HALF_FULL == "Half_Full"
        assert TankStatus.FULL == "Full"
        assert TankStatus.OVERFLOW == "Overflow"


class TestSerializationRoundTrip:
    """Test serialization round-trip property (Requirement 15.9)"""
    
    def test_sensor_data_round_trip(self):
        """Test SensorDataRequest serialization round-trip"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "ph": 7.2,
            "turbidity": 15.5,
            "temperature": 25.3,
            "tds": 150.0,
            "dissolved_oxygen": 8.5
        }
        
        # Parse
        request1 = SensorDataRequest(**data)
        
        # Serialize
        json1 = request1.model_dump_json()
        
        # Parse again
        request2 = SensorDataRequest.model_validate_json(json1)
        
        # Serialize again
        json2 = request2.model_dump_json()
        
        # Should be equivalent
        assert json1 == json2
        assert request1.device_id == request2.device_id
        assert request1.ph == request2.ph
        assert request1.turbidity == request2.turbidity
    
    def test_tank_level_round_trip(self):
        """Test TankLevelRequest serialization round-trip"""
        data = {
            "device_id": "ESP32_001",
            "timestamp": "2025-01-15T10:30:00Z",
            "distance_cm": 45.2,
            "tank_height_cm": 200.0
        }
        
        # Parse
        request1 = TankLevelRequest(**data)
        
        # Serialize
        json1 = request1.model_dump_json()
        
        # Parse again
        request2 = TankLevelRequest.model_validate_json(json1)
        
        # Serialize again
        json2 = request2.model_dump_json()
        
        # Should be equivalent
        assert json1 == json2
        assert request1.device_id == request2.device_id
        assert request1.distance_cm == request2.distance_cm
