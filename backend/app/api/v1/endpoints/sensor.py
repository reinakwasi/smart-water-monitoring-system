"""Sensor data ingestion endpoints for ESP32 sensor modules"""

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from bson import ObjectId
import math

from app.db.mongodb import mongodb
from app.models.schemas import (
    SensorDataRequest,
    SensorDataResponse,
    TankLevelRequest,
    TankLevelResponse,
    ClassificationResult,
    RiskPredictionResult,
    SHAPExplanation,
    SHAPFactor,
    WaterQualityClassification,
    RiskLevel,
    TankStatus,
    ErrorResponse
)
from app.utils.logger import get_logger
from ml.ml_service import ml_service
from ml.shap_service import shap_service


logger = get_logger(__name__)
router = APIRouter(prefix="/sensor", tags=["Sensor Data"])


def classify_risk_level(risk_score: float) -> RiskLevel:
    """
    Classify risk level based on risk score
    
    Requirements: 4.6, 4.7, 4.8
    
    Args:
        risk_score: Risk score between 0.0 and 1.0
        
    Returns:
        RiskLevel enum (Low, Medium, High)
    """
    if risk_score >= 0.7:
        return RiskLevel.HIGH
    elif risk_score >= 0.4:
        return RiskLevel.MEDIUM
    else:
        return RiskLevel.LOW


def classify_tank_status(level_percent: float) -> TankStatus:
    """
    Classify tank status based on level percentage
    
    Requirements: 2.3, 2.4, 2.5, 2.6
    
    Args:
        level_percent: Tank level percentage (0-100)
        
    Returns:
        TankStatus enum (Empty, Half_Full, Full, Overflow)
    """
    if level_percent >= 95.0:
        return TankStatus.OVERFLOW
    elif level_percent >= 50.0:
        return TankStatus.FULL
    elif level_percent >= 10.0:
        return TankStatus.HALF_FULL
    else:
        return TankStatus.EMPTY


def calculate_tank_volume(level_percent: float, tank_height_cm: float, tank_diameter_cm: float = 100.0) -> float:
    """
    Calculate tank volume in liters based on level percentage
    
    Requirement: 2.7
    
    Assumes cylindrical tank: Volume = π * r² * h
    
    Args:
        level_percent: Tank level percentage (0-100)
        tank_height_cm: Total tank height in cm
        tank_diameter_cm: Tank diameter in cm (default: 100cm)
        
    Returns:
        Volume in liters
    """
    radius_cm = tank_diameter_cm / 2.0
    water_height_cm = (level_percent / 100.0) * tank_height_cm
    volume_cm3 = math.pi * (radius_cm ** 2) * water_height_cm
    volume_liters = volume_cm3 / 1000.0  # Convert cm³ to liters
    return round(volume_liters, 2)


@router.post(
    "/sensor-data",
    response_model=SensorDataResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {"description": "Sensor data processed successfully"},
        400: {"model": ErrorResponse, "description": "Invalid sensor data"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def ingest_sensor_data(
    sensor_data: SensorDataRequest,
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Ingest sensor data from ESP32 and perform ML inference
    
    Requirements: 1.7, 3.1, 4.1, 5.1, 5.2, 11.1, 11.3
    
    This endpoint:
    1. Validates sensor data using Pydantic model
    2. Calls MLService for classification and risk prediction
    3. Calls SHAPService for explanations
    4. Persists reading + predictions to MongoDB
    5. Returns complete response with classification, risk, and SHAP values
    
    Args:
        sensor_data: SensorDataRequest payload from ESP32
        db: MongoDB database instance
        
    Returns:
        SensorDataResponse with classification, risk prediction, and SHAP explanations
        
    Raises:
        HTTPException: 500 if ML models are not loaded or processing fails
    """
    logger.info(
        f"Received sensor data from device: {sensor_data.device_id}",
        extra={
            "extra_fields": {
                "device_id": sensor_data.device_id,
                "timestamp": sensor_data.timestamp.isoformat()
            }
        }
    )
    
    try:
        # Check if ML models are ready
        if not ml_service.is_ready():
            logger.error("ML models are not loaded")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ML models are not available. Please contact system administrator."
            )
        
        # Check if SHAP service is ready
        if not shap_service.is_ready():
            logger.error("SHAP service is not initialized")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="SHAP service is not available. Please contact system administrator."
            )
        
        # Prepare sensor data dictionary for ML inference
        sensor_dict = {
            "ph": sensor_data.ph,
            "turbidity": sensor_data.turbidity,
            "temperature": sensor_data.temperature,
            "tds": sensor_data.tds,
            "dissolved_oxygen": sensor_data.dissolved_oxygen
        }
        
        # Step 1: Classify water quality (Requirement 3.1)
        logger.debug(f"Classifying water quality for device {sensor_data.device_id}")
        classification_result = ml_service.classify_water_quality(sensor_dict)
        
        quality_classification = WaterQualityClassification(classification_result['classification'])
        confidence = classification_result['confidence']
        
        logger.info(
            f"Water quality classified as {quality_classification.value} with confidence {confidence:.2f}",
            extra={
                "extra_fields": {
                    "device_id": sensor_data.device_id,
                    "classification": quality_classification.value,
                    "confidence": confidence
                }
            }
        )
        
        # Step 2: Get SHAP explanation for classification (Requirement 5.1)
        logger.debug(f"Computing SHAP explanation for classification")
        classification_shap = shap_service.explain_classification(
            sensor_dict,
            quality_classification.value
        )
        
        # Convert SHAP explanation to response format
        classification_shap_factors = [
            SHAPFactor(
                feature=factor['feature'],
                shap_value=factor['shap_value'],
                direction="increasing_risk" if factor['direction'] == 'positive' else "decreasing_risk"
            )
            for factor in classification_shap['top_factors']
        ]
        
        classification_shap_explanation = SHAPExplanation(
            shap_values=classification_shap['shap_values'],
            top_factors=classification_shap_factors
        )
        
        # Step 3: Query historical readings for risk prediction (Requirement 4.3)
        logger.debug(f"Querying historical readings for device {sensor_data.device_id}")
        historical_cursor = db.sensor_readings.find(
            {"device_id": sensor_data.device_id}
        ).sort("timestamp", -1).limit(10)
        
        historical_readings = []
        async for reading in historical_cursor:
            historical_readings.append({
                "ph": reading["ph"],
                "turbidity": reading["turbidity"],
                "temperature": reading["temperature"],
                "tds": reading["tds"],
                "dissolved_oxygen": reading["dissolved_oxygen"]
            })
        
        # Reverse to get chronological order (oldest to newest)
        historical_readings.reverse()
        
        logger.debug(f"Found {len(historical_readings)} historical readings")
        
        # Step 4: Predict contamination risk (Requirement 4.1)
        logger.debug(f"Predicting contamination risk for device {sensor_data.device_id}")
        risk_result = ml_service.predict_contamination_risk(
            sensor_dict,
            historical_readings if len(historical_readings) > 0 else None,
            window_size=10
        )
        
        risk_score = risk_result['risk_score']
        risk_level = classify_risk_level(risk_score)
        
        logger.info(
            f"Contamination risk predicted: {risk_level.value} (score: {risk_score:.2f})",
            extra={
                "extra_fields": {
                    "device_id": sensor_data.device_id,
                    "risk_level": risk_level.value,
                    "risk_score": risk_score
                }
            }
        )
        
        # Step 5: Get SHAP explanation for risk prediction (Requirement 5.2)
        logger.debug(f"Computing SHAP explanation for risk prediction")
        risk_shap = shap_service.explain_risk_prediction(
            sensor_dict,
            historical_readings if len(historical_readings) > 0 else None,
            risk_score,
            window_size=10
        )
        
        # Convert SHAP explanation to response format
        risk_shap_factors = [
            SHAPFactor(
                feature=factor['feature'],
                shap_value=factor['shap_value'],
                direction="increasing_risk" if factor['direction'] == 'positive' else "decreasing_risk"
            )
            for factor in risk_shap['top_factors']
        ]
        
        risk_shap_explanation = SHAPExplanation(
            shap_values=risk_shap['shap_values'],
            top_factors=risk_shap_factors
        )
        
        # Step 6: Persist reading + predictions to MongoDB (Requirement 11.1, 11.3)
        logger.debug(f"Persisting sensor reading to database")
        reading_doc = {
            "device_id": sensor_data.device_id,
            "timestamp": sensor_data.timestamp,
            "ph": sensor_data.ph,
            "turbidity": sensor_data.turbidity,
            "temperature": sensor_data.temperature,
            "tds": sensor_data.tds,
            "dissolved_oxygen": sensor_data.dissolved_oxygen,
            "classification": quality_classification.value,
            "classification_confidence": confidence,
            "risk_score": risk_score,
            "risk_level": risk_level.value,
            "classification_shap_values": classification_shap['shap_values'],
            "risk_shap_values": risk_shap['shap_values'],
            "created_at": datetime.utcnow()
        }
        
        result = await db.sensor_readings.insert_one(reading_doc)
        reading_id = str(result.inserted_id)
        
        logger.info(
            f"Sensor reading persisted successfully with ID: {reading_id}",
            extra={
                "extra_fields": {
                    "device_id": sensor_data.device_id,
                    "reading_id": reading_id
                }
            }
        )
        
        # Step 7: Build and return response
        response_timestamp = datetime.utcnow()
        
        response = SensorDataResponse(
            status="success",
            reading_id=reading_id,
            classification=ClassificationResult(
                quality=quality_classification,
                confidence=confidence,
                shap_explanation=classification_shap_explanation,
                timestamp=response_timestamp
            ),
            risk_prediction=RiskPredictionResult(
                risk_score=risk_score,
                risk_level=risk_level,
                shap_explanation=risk_shap_explanation,
                timestamp=response_timestamp
            ),
            timestamp=response_timestamp
        )
        
        logger.info(
            f"Sensor data processing completed successfully for device {sensor_data.device_id}",
            extra={
                "extra_fields": {
                    "device_id": sensor_data.device_id,
                    "reading_id": reading_id,
                    "classification": quality_classification.value,
                    "risk_level": risk_level.value
                }
            }
        )
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(
            f"Error processing sensor data from device {sensor_data.device_id}: {str(e)}",
            extra={
                "extra_fields": {
                    "device_id": sensor_data.device_id,
                    "error": str(e)
                }
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process sensor data: {str(e)}"
        )


@router.post(
    "/tank-level",
    response_model=TankLevelResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {"description": "Tank level data processed successfully"},
        400: {"model": ErrorResponse, "description": "Invalid tank level data"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def ingest_tank_level(
    tank_data: TankLevelRequest,
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Ingest tank level data from ESP32 ultrasonic sensor
    
    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 11.2
    
    This endpoint:
    1. Accepts TankLevelRequest payload from ESP32
    2. Calculates tank level percentage and volume
    3. Classifies tank status (Empty, Half_Full, Full, Overflow)
    4. Persists tank reading to MongoDB
    5. Returns tank status response
    
    Args:
        tank_data: TankLevelRequest payload from ESP32
        db: MongoDB database instance
        
    Returns:
        TankLevelResponse with tank status, level percentage, and volume
        
    Raises:
        HTTPException: 400 if distance exceeds tank height
        HTTPException: 500 if processing fails
    """
    logger.info(
        f"Received tank level data from device: {tank_data.device_id}",
        extra={
            "extra_fields": {
                "device_id": tank_data.device_id,
                "timestamp": tank_data.timestamp.isoformat(),
                "distance_cm": tank_data.distance_cm
            }
        }
    )
    
    try:
        # Validate that distance doesn't exceed tank height
        if tank_data.distance_cm > tank_data.tank_height_cm:
            logger.warning(
                f"Invalid tank level data: distance ({tank_data.distance_cm}cm) exceeds tank height ({tank_data.tank_height_cm}cm)",
                extra={
                    "extra_fields": {
                        "device_id": tank_data.device_id,
                        "distance_cm": tank_data.distance_cm,
                        "tank_height_cm": tank_data.tank_height_cm
                    }
                }
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Distance ({tank_data.distance_cm}cm) cannot exceed tank height ({tank_data.tank_height_cm}cm)"
            )
        
        # Step 1: Calculate tank level percentage (Requirement 2.7)
        water_height_cm = tank_data.tank_height_cm - tank_data.distance_cm
        level_percent = (water_height_cm / tank_data.tank_height_cm) * 100.0
        level_percent = max(0.0, min(100.0, level_percent))  # Clamp to [0, 100]
        level_percent = round(level_percent, 1)
        
        logger.debug(
            f"Calculated tank level: {level_percent}%",
            extra={
                "extra_fields": {
                    "device_id": tank_data.device_id,
                    "level_percent": level_percent
                }
            }
        )
        
        # Step 2: Classify tank status (Requirements 2.3, 2.4, 2.5, 2.6)
        tank_status = classify_tank_status(level_percent)
        
        logger.info(
            f"Tank status classified as {tank_status.value}",
            extra={
                "extra_fields": {
                    "device_id": tank_data.device_id,
                    "tank_status": tank_status.value,
                    "level_percent": level_percent
                }
            }
        )
        
        # Step 3: Calculate tank volume (Requirement 2.7)
        # Use default diameter of 100cm (can be made configurable later)
        volume_liters = calculate_tank_volume(
            level_percent,
            tank_data.tank_height_cm,
            tank_diameter_cm=100.0
        )
        
        logger.debug(
            f"Calculated tank volume: {volume_liters}L",
            extra={
                "extra_fields": {
                    "device_id": tank_data.device_id,
                    "volume_liters": volume_liters
                }
            }
        )
        
        # Step 4: Persist tank reading to MongoDB (Requirement 11.2)
        logger.debug(f"Persisting tank reading to database")
        tank_doc = {
            "device_id": tank_data.device_id,
            "timestamp": tank_data.timestamp,
            "distance_cm": tank_data.distance_cm,
            "tank_height_cm": tank_data.tank_height_cm,
            "level_percent": level_percent,
            "volume_liters": volume_liters,
            "tank_status": tank_status.value,
            "created_at": datetime.utcnow()
        }
        
        result = await db.tank_readings.insert_one(tank_doc)
        reading_id = str(result.inserted_id)
        
        logger.info(
            f"Tank reading persisted successfully with ID: {reading_id}",
            extra={
                "extra_fields": {
                    "device_id": tank_data.device_id,
                    "reading_id": reading_id
                }
            }
        )
        
        # Step 5: Build and return response
        response_timestamp = datetime.utcnow()
        
        response = TankLevelResponse(
            status="success",
            reading_id=reading_id,
            tank_status=tank_status,
            level_percent=level_percent,
            volume_liters=volume_liters,
            timestamp=response_timestamp
        )
        
        logger.info(
            f"Tank level processing completed successfully for device {tank_data.device_id}",
            extra={
                "extra_fields": {
                    "device_id": tank_data.device_id,
                    "reading_id": reading_id,
                    "tank_status": tank_status.value,
                    "level_percent": level_percent
                }
            }
        )
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(
            f"Error processing tank level data from device {tank_data.device_id}: {str(e)}",
            extra={
                "extra_fields": {
                    "device_id": tank_data.device_id,
                    "error": str(e)
                }
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process tank level data: {str(e)}"
        )
