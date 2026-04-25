"""MongoDB document models and database schemas"""

from typing import Optional, Dict, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class SensorReadingDocument(BaseModel):
    """
    MongoDB document model for sensor readings
    
    Collection: sensor_readings
    Requirements: 11.1, 11.3
    """
    device_id: str
    timestamp: datetime
    
    # Sensor parameters
    ph: float
    turbidity: float
    temperature: float
    tds: float
    dissolved_oxygen: float
    
    # ML predictions
    classification: str  # Safe, Warning, Unsafe
    classification_confidence: float
    risk_score: float
    risk_level: str  # Low, Medium, High
    
    # SHAP explanations
    classification_shap_values: Dict[str, float]
    risk_shap_values: Dict[str, float]
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "device_id": "ESP32_001",
                "timestamp": "2025-01-15T10:30:00Z",
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
                "created_at": "2025-01-15T10:30:01Z"
            }
        }
    )


class TankReadingDocument(BaseModel):
    """
    MongoDB document model for tank level readings
    
    Collection: tank_readings
    Requirements: 11.2
    """
    device_id: str
    timestamp: datetime
    
    # Tank measurements
    distance_cm: float
    tank_height_cm: float
    level_percent: float
    volume_liters: float
    tank_status: str  # Empty, Half_Full, Full, Overflow
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "device_id": "ESP32_001",
                "timestamp": "2025-01-15T10:30:00Z",
                "distance_cm": 45.2,
                "tank_height_cm": 200.0,
                "level_percent": 77.4,
                "volume_liters": 774.0,
                "tank_status": "Full",
                "created_at": "2025-01-15T10:30:01Z"
            }
        }
    )


class UserDocument(BaseModel):
    """
    MongoDB document model for users
    
    Collection: users
    Requirements: 20.1, 20.3, 20.6
    """
    email: str
    password_hash: str  # bcrypt hashed password
    full_name: str
    role: str  # user, admin
    
    # FCM token for push notifications
    fcm_token: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    is_active: bool = True
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "password_hash": "$2b$12$...",
                "full_name": "John Doe",
                "role": "user",
                "fcm_token": "fcm_token_here",
                "created_at": "2025-01-15T10:00:00Z",
                "updated_at": "2025-01-15T10:00:00Z",
                "last_login": "2025-01-15T10:30:00Z",
                "is_active": True
            }
        }
    )


class SensorDeviceDocument(BaseModel):
    """
    MongoDB document model for sensor devices
    
    Collection: sensor_devices
    Requirements: 13.3, 13.4, 13.5
    """
    device_id: str
    device_name: str
    
    # Calibration offsets
    calibration: Dict[str, float] = Field(
        default_factory=lambda: {
            "ph_offset": 0.0,
            "turbidity_offset": 0.0,
            "temperature_offset": 0.0,
            "tds_offset": 0.0,
            "dissolved_oxygen_offset": 0.0
        }
    )
    
    # Device status
    is_online: bool = True
    last_communication: datetime = Field(default_factory=datetime.utcnow)
    
    # Metadata
    registered_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "device_id": "ESP32_001",
                "device_name": "Main Tank Sensor",
                "calibration": {
                    "ph_offset": 0.0,
                    "turbidity_offset": 0.0,
                    "temperature_offset": 0.0,
                    "tds_offset": 0.0,
                    "dissolved_oxygen_offset": 0.0
                },
                "is_online": True,
                "last_communication": "2025-01-15T10:30:00Z",
                "registered_at": "2025-01-10T08:00:00Z",
                "updated_at": "2025-01-15T10:30:00Z"
            }
        }
    )


class SystemConfigDocument(BaseModel):
    """
    MongoDB document model for system configuration
    
    Collection: system_config
    Requirements: 14.1, 14.2, 14.3, 14.4
    """
    config_id: str = "default"  # Single document with fixed ID
    
    # Sensor polling configuration
    sensor_polling_interval_seconds: int = 30
    
    # Water quality thresholds
    quality_thresholds: Dict[str, Dict[str, float]] = Field(
        default_factory=lambda: {
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
        }
    )
    
    # Risk thresholds
    risk_thresholds: Dict[str, float] = Field(
        default_factory=lambda: {
            "low_max": 0.4,
            "medium_max": 0.7
        }
    )
    
    # Tank dimensions
    tank_dimensions: Dict[str, float] = Field(
        default_factory=lambda: {
            "height_cm": 200.0,
            "diameter_cm": 100.0,
            "capacity_liters": 1570.8  # π * r² * h
        }
    )
    
    # Metadata
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None  # User ID who last updated
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "config_id": "default",
                "sensor_polling_interval_seconds": 30,
                "quality_thresholds": {
                    "ph": {
                        "safe_min": 6.5,
                        "safe_max": 8.5,
                        "unsafe_min": 5.0,
                        "unsafe_max": 10.0
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
                },
                "updated_at": "2025-01-15T10:00:00Z",
                "updated_by": "admin_user_id"
            }
        }
    )


class NotificationLogDocument(BaseModel):
    """
    MongoDB document model for notification logs
    
    Collection: notification_logs
    Requirements: 8.7, 9.6
    """
    notification_type: str  # quality_change, risk_change, tank_status
    user_id: str
    device_id: str
    
    # Notification content
    title: str
    body: str
    priority: str  # normal, high
    
    # Notification status
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    delivery_status: str = "sent"  # sent, failed, delivered
    fcm_response: Optional[Dict] = None
    
    # Related data
    related_reading_id: Optional[str] = None
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "notification_type": "quality_change",
                "user_id": "user_123",
                "device_id": "ESP32_001",
                "title": "⚠️ Water Quality: Warning",
                "body": "Water quality changed from Safe to Warning. Main factor: turbidity.",
                "priority": "normal",
                "sent_at": "2025-01-15T10:30:00Z",
                "delivery_status": "sent",
                "fcm_response": {"success": 1, "failure": 0},
                "related_reading_id": "65a1b2c3d4e5f6g7h8i9j0k1"
            }
        }
    )
