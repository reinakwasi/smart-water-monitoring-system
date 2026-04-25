"""Configuration management using pydantic-settings"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    app_name: str = "Water Quality Monitoring System"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # API
    api_v1_prefix: str = "/api/v1"
    
    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "water_quality_db"
    mongodb_max_pool_size: int = 10
    mongodb_min_pool_size: int = 1
    
    # JWT Authentication
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    
    # Password Hashing
    bcrypt_rounds: int = 12
    
    # ML Models
    ml_models_path: str = "ml/models"
    classifier_model_file: str = "rf_classifier_v1.pkl"
    predictor_model_file: str = "xgb_predictor_v1.pkl"
    
    # Firebase Cloud Messaging
    fcm_server_key: Optional[str] = None
    
    # Rate Limiting
    rate_limit_per_minute: int = 100
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "json"
    
    # CORS
    cors_origins: list[str] = ["*"]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


# Global settings instance
settings = Settings()
