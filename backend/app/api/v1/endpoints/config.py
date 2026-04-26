"""Configuration and calibration endpoints (admin only)"""

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Dict

from app.models.schemas import (
    SystemConfigResponse,
    SystemConfigUpdateRequest,
    ConfigUpdateResponse,
    CalibrationRequest,
    CalibrationResponse,
    ErrorResponse,
    QualityThreshold,
    RiskThresholds,
    TankDimensions
)
from app.dependencies import require_admin
from app.db.mongodb import mongodb


router = APIRouter(prefix="/config", tags=["configuration"])


@router.get(
    "",
    response_model=SystemConfigResponse,
    status_code=status.HTTP_200_OK,
    summary="Get system configuration",
    description="Retrieve current system configuration including thresholds, polling interval, and tank dimensions. Requires admin authentication.",
    responses={
        200: {"description": "Configuration retrieved successfully"},
        401: {"model": ErrorResponse, "description": "Unauthorized - Invalid or missing token"},
        403: {"model": ErrorResponse, "description": "Forbidden - Admin role required"}
    }
)
async def get_config(
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
) -> SystemConfigResponse:
    """
    Get current system configuration
    
    Requirements: 14.1, 14.2, 14.3, 14.4, 20.4
    
    Args:
        current_user: Current authenticated admin user
        db: MongoDB database instance
        
    Returns:
        SystemConfigResponse with current configuration
        
    Raises:
        HTTPException: 404 if configuration not found
    """
    # Fetch configuration from database
    config = await db.system_config.find_one({"config_id": "default"})
    
    if config is None:
        # If no configuration exists, create default configuration
        default_config = {
            "config_id": "default",
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
            },
            "updated_at": datetime.utcnow(),
            "updated_by": None
        }
        
        # Insert default configuration
        await db.system_config.insert_one(default_config)
        config = default_config
    
    # Convert quality_thresholds to QualityThreshold objects
    quality_thresholds = {}
    for param, thresholds in config["quality_thresholds"].items():
        quality_thresholds[param] = QualityThreshold(**thresholds)
    
    # Build response
    return SystemConfigResponse(
        sensor_polling_interval_seconds=config["sensor_polling_interval_seconds"],
        quality_thresholds=quality_thresholds,
        risk_thresholds=RiskThresholds(**config["risk_thresholds"]),
        tank_dimensions=TankDimensions(**config["tank_dimensions"])
    )


@router.put(
    "",
    response_model=ConfigUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Update system configuration",
    description="Update system configuration with validated values. Requires admin authentication.",
    responses={
        200: {"description": "Configuration updated successfully"},
        400: {"model": ErrorResponse, "description": "Bad Request - Invalid configuration values"},
        401: {"model": ErrorResponse, "description": "Unauthorized - Invalid or missing token"},
        403: {"model": ErrorResponse, "description": "Forbidden - Admin role required"}
    }
)
async def update_config(
    config_update: SystemConfigUpdateRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
) -> ConfigUpdateResponse:
    """
    Update system configuration
    
    Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 20.4
    
    Args:
        config_update: Configuration update request with new values
        current_user: Current authenticated admin user
        db: MongoDB database instance
        
    Returns:
        ConfigUpdateResponse with success message and timestamp
        
    Raises:
        HTTPException: 400 if validation fails
    """
    # Fetch current configuration
    current_config = await db.system_config.find_one({"config_id": "default"})
    
    if current_config is None:
        # Create default configuration if it doesn't exist
        default_config = {
            "config_id": "default",
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
            },
            "updated_at": datetime.utcnow(),
            "updated_by": None
        }
        await db.system_config.insert_one(default_config)
        current_config = default_config
    
    # Build update document with only provided fields
    update_doc = {}
    
    if config_update.sensor_polling_interval_seconds is not None:
        # Validate range (10-300 seconds) - already validated by Pydantic
        update_doc["sensor_polling_interval_seconds"] = config_update.sensor_polling_interval_seconds
    
    if config_update.quality_thresholds is not None:
        # Convert QualityThreshold objects to dict
        quality_thresholds_dict = {}
        for param, threshold in config_update.quality_thresholds.items():
            quality_thresholds_dict[param] = threshold.model_dump(exclude_none=True)
        
        # Validate threshold logic
        for param, thresholds in quality_thresholds_dict.items():
            # Ensure safe ranges are within unsafe ranges
            if "safe_min" in thresholds and "unsafe_min" in thresholds:
                if thresholds["safe_min"] < thresholds["unsafe_min"]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid {param} thresholds: safe_min must be >= unsafe_min"
                    )
            
            if "safe_max" in thresholds and "unsafe_max" in thresholds:
                if thresholds["safe_max"] > thresholds["unsafe_max"]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid {param} thresholds: safe_max must be <= unsafe_max"
                    )
        
        update_doc["quality_thresholds"] = quality_thresholds_dict
    
    if config_update.risk_thresholds is not None:
        # Validate risk thresholds (already validated by Pydantic)
        update_doc["risk_thresholds"] = config_update.risk_thresholds.model_dump()
    
    if config_update.tank_dimensions is not None:
        # Validate tank dimensions are positive (already validated by Pydantic)
        update_doc["tank_dimensions"] = config_update.tank_dimensions.model_dump()
    
    # Add metadata
    update_doc["updated_at"] = datetime.utcnow()
    update_doc["updated_by"] = str(current_user["_id"])
    
    # Update configuration in database
    result = await db.system_config.update_one(
        {"config_id": "default"},
        {"$set": update_doc}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update configuration"
        )
    
    return ConfigUpdateResponse(
        status="success",
        message="Configuration updated successfully",
        updated_at=update_doc["updated_at"]
    )


@router.post(
    "/calibration",
    response_model=CalibrationResponse,
    status_code=status.HTTP_200_OK,
    summary="Calibrate sensor",
    description="Initiate sensor calibration by calculating offset from reference value. Requires admin authentication.",
    responses={
        200: {"description": "Calibration applied successfully"},
        400: {"model": ErrorResponse, "description": "Bad Request - Invalid calibration data"},
        401: {"model": ErrorResponse, "description": "Unauthorized - Invalid or missing token"},
        403: {"model": ErrorResponse, "description": "Forbidden - Admin role required"},
        404: {"model": ErrorResponse, "description": "Device not found"}
    }
)
async def calibrate_sensor(
    calibration: CalibrationRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
) -> CalibrationResponse:
    """
    Calibrate sensor by calculating offset from reference value
    
    Requirements: 13.1, 13.2, 13.3, 13.6, 20.4
    
    Args:
        calibration: Calibration request with device_id, sensor_type, reference_value, current_reading
        current_user: Current authenticated admin user
        db: MongoDB database instance
        
    Returns:
        CalibrationResponse with calculated offset and application timestamp
        
    Raises:
        HTTPException: 404 if device not found
    """
    # Calculate calibration offset
    # Offset = reference_value - current_reading
    # This offset will be added to future readings to correct them
    calibration_offset = calibration.reference_value - calibration.current_reading
    
    # Validate offset is reasonable (not too large)
    max_offsets = {
        "ph": 2.0,
        "turbidity": 100.0,
        "temperature": 10.0,
        "tds": 200.0,
        "dissolved_oxygen": 5.0
    }
    
    max_offset = max_offsets.get(calibration.sensor_type.value, 100.0)
    if abs(calibration_offset) > max_offset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Calibration offset too large ({calibration_offset:.2f}). Maximum allowed: ±{max_offset}. Please check reference value and current reading."
        )
    
    # Check if device exists
    device = await db.sensor_devices.find_one({"device_id": calibration.device_id})
    
    if device is None:
        # Create new device document if it doesn't exist
        device_doc = {
            "device_id": calibration.device_id,
            "device_name": f"Sensor {calibration.device_id}",
            "calibration": {
                "ph_offset": 0.0,
                "turbidity_offset": 0.0,
                "temperature_offset": 0.0,
                "tds_offset": 0.0,
                "dissolved_oxygen_offset": 0.0
            },
            "is_online": True,
            "last_communication": datetime.utcnow(),
            "registered_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await db.sensor_devices.insert_one(device_doc)
    
    # Update calibration offset for the specific sensor type
    offset_field = f"calibration.{calibration.sensor_type.value}_offset"
    
    result = await db.sensor_devices.update_one(
        {"device_id": calibration.device_id},
        {
            "$set": {
                offset_field: calibration_offset,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count == 0 and device is not None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to apply calibration"
        )
    
    applied_at = datetime.utcnow()
    
    return CalibrationResponse(
        status="success",
        calibration_offset=calibration_offset,
        applied_at=applied_at,
        device_id=calibration.device_id,
        sensor_type=calibration.sensor_type.value
    )
