"""Pydantic schemas for API request/response validation"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum


# ============================================================================
# Enums
# ============================================================================

class WaterQualityClassification(str, Enum):
    """Water quality classification categories"""
    SAFE = "Safe"
    WARNING = "Warning"
    UNSAFE = "Unsafe"


class RiskLevel(str, Enum):
    """Contamination risk levels"""
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class TankStatus(str, Enum):
    """Tank level status categories"""
    EMPTY = "Empty"
    LOW = "Low"
    HALF_FULL = "Half_Full"
    FULL = "Full"
    OVERFLOW = "Overflow"


class UserRole(str, Enum):
    """User role types"""
    USER = "user"
    ADMIN = "admin"


# ============================================================================
# Request Models
# ============================================================================

class SensorDataRequest(BaseModel):
    """
    Request model for sensor data from ESP32
    
    Validates sensor readings are within physical measurement ranges:
    - pH: 0-14
    - Turbidity: 0-3000 NTU
    - Temperature: -55 to 125°C
    - TDS: 0-1000 ppm
    - Dissolved Oxygen: 0-20 mg/L
    
    Requirements: 1.1-1.5, 1.9, 15.1, 15.7
    """
    device_id: str = Field(..., min_length=1, max_length=100, description="Unique device identifier")
    timestamp: datetime = Field(..., description="Reading timestamp in ISO8601 format")
    ph: float = Field(..., ge=0.0, le=14.0, description="pH level (0-14)")
    turbidity: float = Field(..., ge=0.0, le=3000.0, description="Turbidity in NTU (0-3000)")
    temperature: float = Field(..., ge=-55.0, le=125.0, description="Temperature in Celsius (-55 to 125)")
    tds: float = Field(..., ge=0.0, le=1000.0, description="Total Dissolved Solids in ppm (0-1000)")
    dissolved_oxygen: float = Field(..., ge=0.0, le=20.0, description="Dissolved Oxygen in mg/L (0-20)")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "device_id": "ESP32_001",
                "timestamp": "2025-01-15T10:30:00Z",
                "ph": 7.2,
                "turbidity": 15.5,
                "temperature": 25.3,
                "tds": 150.0,
                "dissolved_oxygen": 8.5
            }
        }
    )
    
    @field_validator('ph')
    @classmethod
    def validate_ph_precision(cls, v: float) -> float:
        """Validate pH precision to ±0.1 units (Requirement 1.1)"""
        return round(v, 1)
    
    @field_validator('turbidity')
    @classmethod
    def validate_turbidity_precision(cls, v: float) -> float:
        """Validate turbidity precision to ±5 NTU (Requirement 1.2)"""
        return round(v, 1)
    
    @field_validator('temperature')
    @classmethod
    def validate_temperature_precision(cls, v: float) -> float:
        """Validate temperature precision to ±0.5°C (Requirement 1.3)"""
        return round(v, 1)
    
    @field_validator('tds')
    @classmethod
    def validate_tds_precision(cls, v: float) -> float:
        """Validate TDS precision to ±10 ppm (Requirement 1.4)"""
        return round(v, 0)
    
    @field_validator('dissolved_oxygen')
    @classmethod
    def validate_do_precision(cls, v: float) -> float:
        """Validate dissolved oxygen precision to ±0.2 mg/L (Requirement 1.5)"""
        return round(v, 1)


class TankLevelRequest(BaseModel):
    """
    Request model for tank level data from ESP32    """
    device_id: str = Field(..., min_length=1, max_length=100, description="Unique device identifier")
    timestamp: datetime = Field(..., description="Reading timestamp in ISO8601 format")
    distance_cm: float = Field(..., ge=0.0, le=500.0, description="Distance from sensor to water surface in cm")
    tank_height_cm: float = Field(..., ge=0.0, le=500.0, description="Total tank height in cm")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "device_id": "ESP32_001",
                "timestamp": "2025-01-15T10:30:00Z",
                "distance_cm": 45.2,
                "tank_height_cm": 200.0
            }
        }
    )
    
    @field_validator('distance_cm')
    @classmethod
    def validate_distance_precision(cls, v: float) -> float:
        """Validate distance precision to ±2 cm (Requirement 2.1)"""
        return round(v, 1)


# ============================================================================
# Response Models - SHAP Explanations
# ============================================================================

class SHAPFactor(BaseModel):
    """Individual SHAP feature contribution"""
    feature: str = Field(..., description="Feature name")
    shap_value: float = Field(..., description="SHAP contribution value")
    direction: str = Field(..., description="Direction of influence: 'increasing_risk' or 'decreasing_risk'")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "feature": "turbidity",
                "shap_value": 0.45,
                "direction": "increasing_risk"
            }
        }
    )


class SHAPExplanation(BaseModel):
    """
    SHAP explanation for model predictions    """
    shap_values: Dict[str, float] = Field(..., description="SHAP values for all features")
    top_factors: List[SHAPFactor] = Field(..., description="Top contributing factors ranked by absolute SHAP value")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "shap_values": {
                    "ph": 0.12,
                    "turbidity": 0.45,
                    "temperature": -0.08,
                    "tds": 0.23,
                    "dissolved_oxygen": -0.15
                },
                "top_factors": [
                    {
                        "feature": "turbidity",
                        "shap_value": 0.45,
                        "direction": "increasing_risk"
                    },
                    {
                        "feature": "tds",
                        "shap_value": 0.23,
                        "direction": "increasing_risk"
                    },
                    {
                        "feature": "dissolved_oxygen",
                        "shap_value": -0.15,
                        "direction": "decreasing_risk"
                    }
                ]
            }
        }
    )


# ============================================================================
# Response Models - Classification and Risk Prediction
# ============================================================================

class ClassificationResult(BaseModel):
    """
    Water quality classification result    """
    quality: WaterQualityClassification = Field(..., description="Water quality classification")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Classification confidence score")
    shap_explanation: SHAPExplanation = Field(..., description="SHAP explanation for classification")
    timestamp: datetime = Field(..., description="Prediction timestamp")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "quality": "Safe",
                "confidence": 0.92,
                "shap_explanation": {
                    "shap_values": {
                        "ph": 0.12,
                        "turbidity": 0.45,
                        "temperature": -0.08,
                        "tds": 0.23,
                        "dissolved_oxygen": -0.15
                    },
                    "top_factors": [
                        {
                            "feature": "turbidity",
                            "shap_value": 0.45,
                            "direction": "increasing_risk"
                        }
                    ]
                },
                "timestamp": "2025-01-15T10:30:01Z"
            }
        }
    )


class RiskPredictionResult(BaseModel):
    """
    Contamination risk prediction result    """
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Risk score between 0.0 (no risk) and 1.0 (high risk)")
    risk_level: RiskLevel = Field(..., description="Risk level classification")
    shap_explanation: SHAPExplanation = Field(..., description="SHAP explanation for risk prediction")
    timestamp: datetime = Field(..., description="Prediction timestamp")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "risk_score": 0.35,
                "risk_level": "Low",
                "shap_explanation": {
                    "shap_values": {
                        "ph": 0.05,
                        "turbidity": 0.18,
                        "temperature": -0.03,
                        "tds": 0.10,
                        "dissolved_oxygen": -0.08
                    },
                    "top_factors": [
                        {
                            "feature": "turbidity",
                            "shap_value": 0.18,
                            "direction": "increasing_risk"
                        }
                    ]
                },
                "timestamp": "2025-01-15T10:30:01Z"
            }
        }
    )


class SensorDataResponse(BaseModel):
    """
    Complete response for sensor data ingestion    """
    status: str = Field(..., description="Response status")
    reading_id: str = Field(..., description="MongoDB ObjectId of stored reading")
    classification: ClassificationResult = Field(..., description="Water quality classification")
    risk_prediction: RiskPredictionResult = Field(..., description="Contamination risk prediction")
    timestamp: datetime = Field(..., description="Response timestamp")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "success",
                "reading_id": "65a1b2c3d4e5f6g7h8i9j0k1",
                "classification": {
                    "quality": "Safe",
                    "confidence": 0.92,
                    "shap_explanation": {
                        "shap_values": {},
                        "top_factors": []
                    },
                    "timestamp": "2025-01-15T10:30:01Z"
                },
                "risk_prediction": {
                    "risk_score": 0.35,
                    "risk_level": "Low",
                    "shap_explanation": {
                        "shap_values": {},
                        "top_factors": []
                    },
                    "timestamp": "2025-01-15T10:30:01Z"
                },
                "timestamp": "2025-01-15T10:30:01Z"
            }
        }
    )


class TankLevelResponse(BaseModel):
    """
    Response for tank level data    """
    status: str = Field(..., description="Response status")
    reading_id: str = Field(..., description="MongoDB ObjectId of stored reading")
    tank_status: TankStatus = Field(..., description="Tank status classification")
    level_percent: float = Field(..., ge=0.0, le=100.0, description="Tank level percentage")
    volume_liters: float = Field(..., ge=0.0, description="Estimated water volume in liters")
    timestamp: datetime = Field(..., description="Response timestamp")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "success",
                "reading_id": "65a1b2c3d4e5f6g7h8i9j0k2",
                "tank_status": "Half_Full",
                "level_percent": 55.0,
                "volume_liters": 550.0,
                "timestamp": "2025-01-15T10:30:01Z"
            }
        }
    )


# ============================================================================
# Response Models - Current Status
# ============================================================================

class WaterQualityStatus(BaseModel):
    """Current water quality status"""
    classification: WaterQualityClassification = Field(..., description="Current classification")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Classification confidence")
    parameters: Dict[str, float] = Field(..., description="Current sensor parameter values")
    shap_explanation: SHAPExplanation = Field(..., description="SHAP explanation")
    timestamp: datetime = Field(..., description="Reading timestamp")


class ContaminationRiskStatus(BaseModel):
    """Current contamination risk status"""
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Risk score")
    risk_level: RiskLevel = Field(..., description="Risk level")
    shap_explanation: SHAPExplanation = Field(..., description="SHAP explanation")
    timestamp: datetime = Field(..., description="Prediction timestamp")


class TankLevelStatus(BaseModel):
    """Current tank level status"""
    status: TankStatus = Field(..., description="Tank status")
    level_percent: float = Field(..., ge=0.0, le=100.0, description="Level percentage")
    volume_liters: float = Field(..., ge=0.0, description="Volume in liters")
    timestamp: datetime = Field(..., description="Reading timestamp")


class CurrentStatusResponse(BaseModel):
    """
    Complete current status response    """
    water_quality: WaterQualityStatus = Field(..., description="Current water quality status")
    contamination_risk: ContaminationRiskStatus = Field(..., description="Current contamination risk")
    tank_status: TankLevelStatus = Field(..., description="Current tank level status")


# ============================================================================
# Response Models - Historical Data
# ============================================================================

class HistoricalDataPoint(BaseModel):
    """Single historical data point"""
    timestamp: datetime = Field(..., description="Reading timestamp")
    parameters: Dict[str, float] = Field(..., description="Sensor parameter values")
    classification: WaterQualityClassification = Field(..., description="Water quality classification")
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Contamination risk score")
    tank_level_percent: Optional[float] = Field(None, ge=0.0, le=100.0, description="Tank level percentage")


class HistoricalDataResponse(BaseModel):
    """
    Historical data response    """
    data: List[HistoricalDataPoint] = Field(..., description="Historical data points")
    count: int = Field(..., ge=0, description="Number of data points returned")
    start_date: datetime = Field(..., description="Query start date")
    end_date: datetime = Field(..., description="Query end date")


# ============================================================================
# Authentication Models
# ============================================================================

class UserRegisterRequest(BaseModel):
    """User registration request"""
    email: str = Field(..., min_length=3, max_length=255, description="User email address")
    password: str = Field(..., min_length=8, max_length=100, description="User password (min 8 characters)")
    full_name: str = Field(..., min_length=1, max_length=255, description="User full name")
    role: UserRole = Field(default=UserRole.USER, description="User role")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "password": "securepassword123",
                "full_name": "John Doe",
                "role": "user"
            }
        }
    )


class UserLoginRequest(BaseModel):
    """User login request"""
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "password": "securepassword123"
            }
        }
    )


class UserResponse(BaseModel):
    """User information response"""
    user_id: str = Field(..., description="User ID")
    email: str = Field(..., description="User email")
    full_name: str = Field(..., description="User full name")
    role: UserRole = Field(..., description="User role")
    created_at: datetime = Field(..., description="Account creation timestamp")


class TokenResponse(BaseModel):
    """JWT token response"""
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    user: UserResponse = Field(..., description="User information")


# ============================================================================
# Configuration Models
# ============================================================================

class QualityThreshold(BaseModel):
    """Threshold values for a single water quality parameter"""
    safe_min: Optional[float] = Field(None, description="Minimum safe value")
    safe_max: Optional[float] = Field(None, description="Maximum safe value")
    unsafe_min: Optional[float] = Field(None, description="Minimum unsafe value")
    unsafe_max: Optional[float] = Field(None, description="Maximum unsafe value")


class TankDimensions(BaseModel):
    """Tank physical dimensions"""
    height_cm: float = Field(..., gt=0, description="Tank height in centimeters")
    diameter_cm: float = Field(..., gt=0, description="Tank diameter in centimeters")
    capacity_liters: float = Field(..., gt=0, description="Tank capacity in liters")


class RiskThresholds(BaseModel):
    """Risk level threshold values"""
    low_max: float = Field(..., ge=0.0, le=1.0, description="Maximum risk score for Low level")
    medium_max: float = Field(..., ge=0.0, le=1.0, description="Maximum risk score for Medium level")
    
    @field_validator('medium_max')
    @classmethod
    def validate_medium_greater_than_low(cls, v: float, info) -> float:
        """Ensure medium_max > low_max"""
        if 'low_max' in info.data and v <= info.data['low_max']:
            raise ValueError('medium_max must be greater than low_max')
        return v


class SystemConfigResponse(BaseModel):
    """
    System configuration response    """
    sensor_polling_interval_seconds: int = Field(..., ge=10, le=300, description="Sensor polling interval (10-300 seconds)")
    quality_thresholds: Dict[str, QualityThreshold] = Field(..., description="Water quality thresholds per parameter")
    risk_thresholds: RiskThresholds = Field(..., description="Contamination risk thresholds")
    tank_dimensions: TankDimensions = Field(..., description="Tank physical dimensions")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sensor_polling_interval_seconds": 30,
                "quality_thresholds": {
                    "ph": {
                        "safe_min": 6.5,
                        "safe_max": 8.5,
                        "unsafe_min": 5.0,
                        "unsafe_max": 10.0
                    },
                    "turbidity": {
                        "safe_max": 5.0,
                        "unsafe_max": 25.0
                    },
                    "temperature": {
                        "safe_min": 15.0,
                        "safe_max": 30.0,
                        "unsafe_min": 5.0,
                        "unsafe_max": 40.0
                    },
                    "tds": {
                        "safe_max": 300.0,
                        "unsafe_max": 600.0
                    },
                    "dissolved_oxygen": {
                        "safe_min": 6.0,
                        "unsafe_min": 4.0
                    }
                },
                "risk_thresholds": {
                    "low_max": 0.4,
                    "medium_max": 0.7
                },
                "tank_dimensions": {
                    "height_cm": 200.0,
                    "diameter_cm": 100.0,
                    "capacity_liters": 1570.8
                }
            }
        }
    )


class SystemConfigUpdateRequest(BaseModel):
    """
    System configuration update request    """
    sensor_polling_interval_seconds: Optional[int] = Field(None, ge=10, le=300, description="Sensor polling interval (10-300 seconds)")
    quality_thresholds: Optional[Dict[str, QualityThreshold]] = Field(None, description="Water quality thresholds per parameter")
    risk_thresholds: Optional[RiskThresholds] = Field(None, description="Contamination risk thresholds")
    tank_dimensions: Optional[TankDimensions] = Field(None, description="Tank physical dimensions")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sensor_polling_interval_seconds": 60,
                "quality_thresholds": {
                    "ph": {
                        "safe_min": 6.5,
                        "safe_max": 8.5,
                        "unsafe_min": 5.0,
                        "unsafe_max": 10.0
                    }
                },
                "risk_thresholds": {
                    "low_max": 0.3,
                    "medium_max": 0.6
                },
                "tank_dimensions": {
                    "height_cm": 250.0,
                    "diameter_cm": 120.0,
                    "capacity_liters": 2827.4
                }
            }
        }
    )


class ConfigUpdateResponse(BaseModel):
    """Configuration update response"""
    status: str = Field(default="success", description="Response status")
    message: str = Field(..., description="Success message")
    updated_at: datetime = Field(..., description="Update timestamp")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "success",
                "message": "Configuration updated successfully",
                "updated_at": "2025-01-15T10:30:00Z"
            }
        }
    )


# ============================================================================
# Calibration Models
# ============================================================================

class SensorType(str, Enum):
    """Sensor types for calibration"""
    PH = "ph"
    TURBIDITY = "turbidity"
    TEMPERATURE = "temperature"
    TDS = "tds"
    DISSOLVED_OXYGEN = "dissolved_oxygen"


class CalibrationRequest(BaseModel):
    """
    Sensor calibration request    """
    device_id: str = Field(..., min_length=1, max_length=100, description="Device identifier")
    sensor_type: SensorType = Field(..., description="Type of sensor to calibrate")
    reference_value: float = Field(..., description="Known reference value")
    current_reading: float = Field(..., description="Current sensor reading")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "device_id": "ESP32_001",
                "sensor_type": "ph",
                "reference_value": 7.0,
                "current_reading": 7.3
            }
        }
    )


class CalibrationResponse(BaseModel):
    """Sensor calibration response"""
    status: str = Field(default="success", description="Response status")
    calibration_offset: float = Field(..., description="Calculated calibration offset")
    applied_at: datetime = Field(..., description="Calibration application timestamp")
    device_id: str = Field(..., description="Device identifier")
    sensor_type: str = Field(..., description="Sensor type")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "success",
                "calibration_offset": -0.3,
                "applied_at": "2025-01-15T10:30:00Z",
                "device_id": "ESP32_001",
                "sensor_type": "ph"
            }
        }
    )


# ============================================================================
# Error Response Models
# ============================================================================

class ErrorResponse(BaseModel):
    """Standard error response"""
    status: str = Field(default="error", description="Response status")
    message: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "error",
                "message": "Invalid sensor data",
                "detail": "pH value must be between 0 and 14",
                "timestamp": "2025-01-15T10:30:00Z"
            }
        }
    )


# ============================================================================
# Health Check Models
# ============================================================================

class SystemHealthStatus(str, Enum):
    """Overall system health status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class ComponentHealth(BaseModel):
    """
    Health status for a system component    """
    status: str = Field(..., description="Component status (connected, disconnected, loaded, not_loaded, operational, degraded, not_initialized)")
    latency_ms: Optional[float] = Field(None, description="Component latency in milliseconds (for database)")
    classifier_version: Optional[str] = Field(None, description="Classifier model version (for ML models)")
    predictor_version: Optional[str] = Field(None, description="Risk predictor model version (for ML models)")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "connected",
                "latency_ms": 15.5
            }
        }
    )


class SensorDeviceHealth(BaseModel):
    """
    Health status for a sensor device    """
    device_id: str = Field(..., description="Sensor device ID")
    status: str = Field(..., description="Device status (online, offline)")
    last_communication: Optional[datetime] = Field(None, description="Timestamp of last communication")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "device_id": "ESP32_001",
                "status": "online",
                "last_communication": "2025-01-15T10:30:00Z"
            }
        }
    )


class HealthCheckResponse(BaseModel):
    """
    System health check response    """
    status: SystemHealthStatus = Field(..., description="Overall system health status")
    timestamp: datetime = Field(..., description="Health check timestamp")
    components: Dict[str, ComponentHealth] = Field(..., description="Health status of system components")
    sensors: List[SensorDeviceHealth] = Field(default_factory=list, description="Health status of sensor devices")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "healthy",
                "timestamp": "2025-01-15T10:30:00Z",
                "components": {
                    "database": {
                        "status": "connected",
                        "latency_ms": 15.5
                    },
                    "ml_models": {
                        "status": "loaded",
                        "classifier_version": "v1.0",
                        "predictor_version": "v1.0"
                    },
                    "notification_service": {
                        "status": "operational"
                    }
                },
                "sensors": [
                    {
                        "device_id": "ESP32_001",
                        "status": "online",
                        "last_communication": "2025-01-15T10:30:00Z"
                    }
                ]
            }
        }
    )
