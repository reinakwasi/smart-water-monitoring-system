"""Models package - Pydantic schemas and database models"""

from app.models.schemas import (
    # Enums
    WaterQualityClassification,
    RiskLevel,
    TankStatus,
    UserRole,
    
    # Request models
    SensorDataRequest,
    TankLevelRequest,
    UserRegisterRequest,
    UserLoginRequest,
    
    # Response models
    SensorDataResponse,
    TankLevelResponse,
    ClassificationResult,
    RiskPredictionResult,
    SHAPExplanation,
    SHAPFactor,
    CurrentStatusResponse,
    HistoricalDataResponse,
    TokenResponse,
    UserResponse,
    ErrorResponse,
)

from app.models.database import (
    SensorReadingDocument,
    TankReadingDocument,
    UserDocument,
    SensorDeviceDocument,
    SystemConfigDocument,
    NotificationLogDocument,
)

__all__ = [
    # Enums
    "WaterQualityClassification",
    "RiskLevel",
    "TankStatus",
    "UserRole",
    
    # Request models
    "SensorDataRequest",
    "TankLevelRequest",
    "UserRegisterRequest",
    "UserLoginRequest",
    
    # Response models
    "SensorDataResponse",
    "TankLevelResponse",
    "ClassificationResult",
    "RiskPredictionResult",
    "SHAPExplanation",
    "SHAPFactor",
    "CurrentStatusResponse",
    "HistoricalDataResponse",
    "TokenResponse",
    "UserResponse",
    "ErrorResponse",
    
    # Database models
    "SensorReadingDocument",
    "TankReadingDocument",
    "UserDocument",
    "SensorDeviceDocument",
    "SystemConfigDocument",
    "NotificationLogDocument",
]
