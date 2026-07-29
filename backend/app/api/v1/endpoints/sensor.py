"""Sensor data ingestion endpoints for ESP32 sensor modules"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from bson import ObjectId
import math

from app.db.mongodb import mongodb
from app.dependencies import verify_device_api_key
from app.models.schemas import (
    SensorDataRequest,
    SensorDataResponse,
    TankLevelRequest,
    TankLevelResponse,
    ClassificationResult,
    RiskPredictionResult,
    ParameterClassifications,
    SHAPExplanation,
    SHAPFactor,
    WaterQualityClassification,
    RiskLevel,
    TankStatus,
    ErrorResponse
)
from app.utils.logger import get_logger
from app.config import settings
from app.middleware import limiter
from ml.ml_service import ml_service
from ml.shap_service import shap_service
from app.services.parameter_classifier import ParameterClassifierService


async def record_in_app_alert(
    db: AsyncIOMotorDatabase,
    device_association: dict,
    device_id: str,
    notification_type: str,
    title: str,
    body: str,
    severity: str,
    related_reading_id: str,
    preference_key: str,
):
    """Persist an owned alert even when remote push delivery is unavailable."""
    owner_id = str(device_association.get("user_id", ""))
    if not owner_id:
        return None

    owner_query = {"_id": ObjectId(owner_id)} if ObjectId.is_valid(owner_id) else {"_id": owner_id}
    owner = await db.users.find_one(owner_query)
    if not owner or not owner.get(preference_key, True):
        return None

    now = datetime.utcnow()
    duplicate = await db.notification_logs.find_one({
        "user_id": owner_id,
        "device_id": device_id,
        "notification_type": notification_type,
        "title": title,
        "sent_at": {"$gte": now - timedelta(hours=1)},
    })
    if duplicate:
        return duplicate

    alert = {
        "notification_type": notification_type,
        "user_id": owner_id,
        "device_id": device_id,
        "title": title,
        "body": body,
        "priority": "high" if severity == "high" else "normal",
        "severity": severity,
        "sent_at": now,
        "delivery_status": "in_app",
        "is_read": False,
        "related_reading_id": related_reading_id,
    }
    result = await db.notification_logs.insert_one(alert)
    alert["_id"] = result.inserted_id
    return alert

logger = get_logger(__name__)
# The deployed ESP32 measures pH, turbidity, temperature, and TDS.
# No dissolved-oxygen value is fabricated for inference.


async def resolve_upload_device(
    db: AsyncIOMotorDatabase,
    device_association: dict,
    device_id: str,
) -> dict:
    """
    Resolve the device record for an incoming ESP32 reading.

    Key-based uploads are matched by setup key. Simple project uploads do not
    send a key, so they are matched by the device_id in the payload.
    """
    authenticated_device_id = device_association.get("device_id")
    if authenticated_device_id:
        if device_id != authenticated_device_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Device ID mismatch",
            )
        return device_association

    association = await db.user_device_associations.find_one({
        "device_id": device_id,
        "is_active": True,
    })
    if association:
        now = datetime.utcnow()
        await db.user_device_associations.update_one(
            {"_id": association["_id"]},
            {"$set": {"last_communication": now, "updated_at": now}},
        )
        association["last_communication"] = now
        return association

    return {
        "legacy_upload": True,
        "device_id": device_id,
        "device_name": device_id,
        "is_active": True,
    }


def filter_supported_shap(explanation: dict) -> dict:
    """Remove unmeasured dissolved-oxygen factors from stored/API explanations."""
    shap_values = {
        key: value for key, value in explanation.get("shap_values", {}).items()
        if not key.startswith("dissolved_oxygen")
    }
    top_factors = [
        factor for factor in explanation.get("top_factors", [])
        if not factor["feature"].startswith("dissolved_oxygen")
    ]
    return {**explanation, "shap_values": shap_values, "top_factors": top_factors}
router = APIRouter(prefix="/sensor", tags=["Sensor Data"])

# Instantiate parameter classifier service
parameter_classifier_service = ParameterClassifierService()


def classify_risk_level(risk_score: float) -> RiskLevel:
    """
    Classify risk level based on risk score    Args:
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

    Thresholds match Chapter 3 Algorithm 4:
    - Empty: <= 5%
    - Low: > 5% and <= 25%
    - Half: > 25% and <= 75%
    - Full: > 75% and <= 95%
    - Overflow: > 95%

    Args:
        level_percent: Tank level percentage (0-100)

    Returns:
        TankStatus enum (Empty, Low, Half_Full, Full, Overflow)
    """
    if level_percent > 95.0:
        return TankStatus.OVERFLOW
    elif level_percent > 75.0:
        return TankStatus.FULL
    elif level_percent > 25.0:
        return TankStatus.HALF_FULL
    elif level_percent > 5.0:
        return TankStatus.LOW
    else:
        return TankStatus.EMPTY


def calculate_tank_volume(level_percent: float, tank_height_cm: float, tank_diameter_cm: float = 100.0) -> float:
    """
    Calculate tank volume in liters based on level percentage    Assumes cylindrical tank: Volume = π * r² * h

    Args:
        level_percent: Tank level percentage (0-100)
        tank_height_cm: Total tank height in cm
        tank_diameter_cm: Tank diameter in cm (default: 100cm)

    Returns:
        Volume in litres
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
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def ingest_sensor_data(
    request: Request,
    sensor_data: SensorDataRequest,
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
    device_association: dict = Depends(verify_device_api_key),
):
    """
    Ingest sensor data from ESP32 and perform ML inference

    Rate limit: 100 requests per minute per IP address

    This endpoint:
    1. Validates sensor data using Pydantic model
    2. Calls MLService for classification and risk prediction
    3. Calls SHAPService for explanations
    4. Persists reading + predictions to MongoDB
    5. Returns complete response with classification, risk, and SHAP values

    Args:
        request: FastAPI request object (for rate limiting)
        sensor_data: SensorDataRequest payload from ESP32
        db: MongoDB database instance

    Returns:
        SensorDataResponse with classification, risk prediction, and SHAP explanations

    Raises:
        HTTPException: 429 if rate limit exceeded
        HTTPException: 500 if ML models are not loaded or processing fails
    """
    device_association = await resolve_upload_device(db, device_association, sensor_data.device_id)
    sensor_data.device_id = device_association.get("device_id", sensor_data.device_id)
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
            "turbidity_index": sensor_data.turbidity_index,
            "temperature": sensor_data.temperature,
            "tds": sensor_data.tds,
        }

        # Step 1: Classify water quality
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

        # Step 2: Get SHAP explanation for classification
        logger.debug(f"Computing SHAP explanation for classification")
        classification_shap = shap_service.explain_classification(
            sensor_dict,
            quality_classification.value
        )
        classification_shap = filter_supported_shap(classification_shap)

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

        # Step 3: Query historical readings for risk prediction
        logger.debug(f"Querying historical readings for device {sensor_data.device_id}")
        historical_cursor = db.sensor_readings.find(
            {"device_id": sensor_data.device_id}
        ).sort("timestamp", -1).limit(10)

        historical_readings = []
        async for reading in historical_cursor:
            historical_readings.append({
                "ph": reading.get("ph", 7.0),
                "turbidity_index": reading.get("turbidity_index", reading.get("turbidity", 5.0)),
                "temperature": reading.get("temperature", 25.0),
                "tds": reading.get("tds", 100.0),
            })

        # Reverse to get chronological order (oldest to newest)
        historical_readings.reverse()

        logger.debug(f"Found {len(historical_readings)} historical readings")

        # Step 4: Predict contamination risk
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

        # Step 5: Get SHAP explanation for risk prediction
        logger.debug(f"Computing SHAP explanation for risk prediction")
        risk_shap = shap_service.explain_risk_prediction(
            sensor_dict,
            historical_readings if len(historical_readings) > 0 else None,
            risk_score,
            window_size=10
        )
        risk_shap = filter_supported_shap(risk_shap)

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

        # Step 6: Classify parameters using the shared monitoring bands
        logger.debug(f"Classifying parameters using operational bands for device {sensor_data.device_id}")
        parameter_classifications = parameter_classifier_service.classify_reading(
            ph=sensor_data.ph,
            turbidity_index=sensor_data.turbidity_index,
            temperature=sensor_data.temperature,
            tds=sensor_data.tds
        )

        logger.info(
            f"Parameters classified: TDS={parameter_classifications['tds'].value}, "
            f"pH={parameter_classifications['ph'].value}, "
            f"Turbidity={parameter_classifications['turbidity_index'].value}, "
            f"Temperature={parameter_classifications['temperature'].value}",
            extra={
                "extra_fields": {
                    "device_id": sensor_data.device_id,
                    "tds_band": parameter_classifications['tds'].value,
                    "ph_band": parameter_classifications['ph'].value,
                    "turbidity_band": parameter_classifications['turbidity_index'].value,
                    "temperature_band": parameter_classifications['temperature'].value
                }
            }
        )

        # Step 7: Persist reading and predictions
        logger.debug(f"Persisting sensor reading to database")
        received_at = datetime.utcnow()
        reading_doc = {
            "device_id": sensor_data.device_id,
            "timestamp": received_at,
            "device_timestamp": sensor_data.timestamp,
            "ph": sensor_data.ph,
            "turbidity_index": sensor_data.turbidity_index,
            "temperature": sensor_data.temperature,
            "tds": sensor_data.tds,
            "classification": quality_classification.value,
            "classification_confidence": confidence,
            "risk_score": risk_score,
            "risk_level": risk_level.value,
            "classification_shap_values": classification_shap['shap_values'],
            "risk_shap_values": risk_shap['shap_values'],
            "parameter_classifications": {
                "ph": parameter_classifications['ph'].value,
                "turbidity_index": parameter_classifications['turbidity_index'].value,
                "temperature": parameter_classifications['temperature'].value,
                "tds": parameter_classifications['tds'].value
            },
            "created_at": received_at
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

        # Maintain a real alert history independently of optional FCM delivery.
        if quality_classification.value in {"Warning", "Unsafe"}:
            top_factor = classification_shap_factors[0].feature if classification_shap_factors else "combined readings"
            unsafe = quality_classification.value == "Unsafe"
            await record_in_app_alert(
                db,
                device_association,
                sensor_data.device_id,
                "quality_change",
                "Unsafe water reading" if unsafe else "Water reading needs attention",
                (
                    f"AquaGuard classified this reading as {quality_classification.value}. "
                    f"The strongest model factor was {top_factor}. "
                    + ("Do not use it for drinking until a fresh reading is checked." if unsafe else "Repeat the measurement and review Water Insights.")
                ),
                "high" if unsafe else "attention",
                reading_id,
                "alert_on_unsafe",
            )

        if risk_level.value in {"Medium", "High"}:
            high_risk = risk_level.value == "High"
            await record_in_app_alert(
                db,
                device_association,
                sensor_data.device_id,
                "risk_change",
                f"{risk_level.value} predicted contamination risk",
                (
                    f"The model found a {risk_level.value.lower()}-risk pattern "
                    f"with a score of {round(risk_score * 100)}%. Review the contributing factors in Water Insights."
                ),
                "high" if high_risk else "attention",
                reading_id,
                "alert_on_high_risk",
            )

        # Step 7: Check for changes and send notifications
        try:
            from app.services.notification_service import get_notification_service
            notification_service = get_notification_service()

            if notification_service:
                # Query previous reading for this device
                previous_reading = await db.sensor_readings.find_one(
                    {
                        "device_id": sensor_data.device_id,
                        "_id": {"$ne": result.inserted_id}
                    },
                    sort=[("timestamp", -1)]
                )

                if previous_reading:
                    # Get active user FCM tokens
                    user_tokens = await notification_service.get_device_owner_tokens(sensor_data.device_id, db)

                    if user_tokens:
                        # Check for water quality classification change
                        previous_classification = previous_reading.get("classification")
                        if previous_classification and previous_classification != quality_classification.value:
                            logger.info(
                                f"Water quality changed: {previous_classification} -> {quality_classification.value}",
                                extra={
                                    "extra_fields": {
                                        "device_id": sensor_data.device_id,
                                        "old_classification": previous_classification,
                                        "new_classification": quality_classification.value
                                    }
                                }
                            )

                            # Get top contributing factor from SHAP explanation
                            top_factor = classification_shap_factors[0].feature if classification_shap_factors else "unknown"

                            # Send quality change notification
                            await notification_service.send_quality_change_notification(
                                user_tokens=user_tokens,
                                old_quality=previous_classification,
                                new_quality=quality_classification.value,
                                top_factor=top_factor,
                                device_id=sensor_data.device_id,
                                device_name=device_association.get("device_name", sensor_data.device_id),
                            )

                        # Check for contamination risk level increase
                        previous_risk_level = previous_reading.get("risk_level")
                        if previous_risk_level:
                            # Define risk level ordering
                            risk_order = {"Low": 0, "Medium": 1, "High": 2}
                            previous_risk_order = risk_order.get(previous_risk_level, 0)
                            current_risk_order = risk_order.get(risk_level.value, 0)

                            # Only send notification if risk level increased
                            if current_risk_order > previous_risk_order:
                                logger.info(
                                    f"Contamination risk increased: {previous_risk_level} -> {risk_level.value}",
                                    extra={
                                        "extra_fields": {
                                            "device_id": sensor_data.device_id,
                                            "old_risk_level": previous_risk_level,
                                            "new_risk_level": risk_level.value,
                                            "risk_score": risk_score
                                        }
                                    }
                                )

                                # Send risk change notification
                                await notification_service.send_risk_change_notification(
                                    user_tokens=user_tokens,
                                    risk_level=risk_level.value,
                                    risk_score=risk_score,
                                    device_id=sensor_data.device_id,
                                    device_name=device_association.get("device_name", sensor_data.device_id),
                                )
                    else:
                        logger.debug("No active user FCM tokens found for notifications")
                else:
                    logger.debug(f"No previous reading found for device {sensor_data.device_id}")
            else:
                logger.debug("Notification service not initialized, skipping notifications")
        except Exception as e:
            # Log error but don't fail the request
            logger.error(
                f"Error sending notifications: {str(e)}",
                extra={
                    "extra_fields": {
                        "device_id": sensor_data.device_id,
                        "error": str(e)
                    }
                },
                exc_info=True
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
            parameter_classifications=ParameterClassifications(
                ph=parameter_classifications['ph'].value,
                turbidity_index=parameter_classifications['turbidity_index'].value,
                temperature=parameter_classifications['temperature'].value,
                tds=parameter_classifications['tds'].value
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
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def ingest_tank_level(
    request: Request,
    tank_data: TankLevelRequest,
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database),
    device_association: dict = Depends(verify_device_api_key),
):
    """
    Ingest tank level data from ESP32 ultrasonic sensor

    Rate limit: 100 requests per minute per IP address

    This endpoint:
    1. Accepts TankLevelRequest payload from ESP32
    2. Calculates tank level percentage and volume
    3. Classifies tank status (Empty, Half_Full, Full, Overflow)
    4. Persists tank reading to MongoDB
    5. Returns tank status response

    Args:
        request: FastAPI request object (for rate limiting)
        tank_data: TankLevelRequest payload from ESP32
        db: MongoDB database instance

    Returns:
        TankLevelResponse with tank status, level percentage, and volume

    Raises:
        HTTPException: 400 if distance exceeds tank height
        HTTPException: 429 if rate limit exceeded
        HTTPException: 500 if processing fails
    """
    device_association = await resolve_upload_device(db, device_association, tank_data.device_id)
    tank_data.device_id = device_association.get("device_id", tank_data.device_id)
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

        # Step 1: Calculate tank level percentage
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

        # Step 2: Classify tank status
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

        # Step 3: Calculate tank volume
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

        # Step 4: Persist tank reading
        logger.debug(f"Persisting tank reading to database")
        received_at = datetime.utcnow()
        tank_doc = {
            "device_id": tank_data.device_id,
            "timestamp": received_at,
            "device_timestamp": tank_data.timestamp,
            "distance_cm": tank_data.distance_cm,
            "tank_height_cm": tank_data.tank_height_cm,
            "level_percent": level_percent,
            "volume_liters": volume_liters,
            "tank_status": tank_status.value,
            "created_at": received_at
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

        tank_alerts = {
            "Empty": ("Tank is empty", "The tank is at or below 5%. Plan a refill.", "high"),
            "Low": ("Tank level is low", f"The tank is at {level_percent:.0f}%. Plan a refill soon.", "attention"),
            "Half_Full": ("Tank is half full", f"The tank is at {level_percent:.0f}% and has reached the half-full stage.", "info"),
            "Full": ("Tank is full", f"The tank is at {level_percent:.0f}%. Stop or check the inlet supply.", "attention"),
            "Overflow": ("Tank overflow detected", "The measured level indicates overflow. Check the inlet and level sensor immediately.", "high"),
        }
        tank_title, tank_message, tank_severity = tank_alerts[tank_status.value]
        await record_in_app_alert(
            db,
            device_association,
            tank_data.device_id,
            "tank_status",
            tank_title,
            tank_message,
            tank_severity,
            reading_id,
            "alert_on_tank_critical",
        )

        # Step 5: Check for tank status changes and send notifications
        try:
            from app.services.notification_service import get_notification_service
            notification_service = get_notification_service()

            if notification_service:
                # Query previous tank reading for this device
                previous_reading = await db.tank_readings.find_one(
                    {
                        "device_id": tank_data.device_id,
                        "_id": {"$ne": result.inserted_id}
                    },
                    sort=[("timestamp", -1)]
                )

                if previous_reading:
                    # Get active user FCM tokens
                    user_tokens = await notification_service.get_device_owner_tokens(tank_data.device_id, db)

                    if user_tokens:
                        # Check for tank status change to critical states
                        previous_tank_status = previous_reading.get("tank_status")

                        # Only send notification if status changed AND new status is critical
                        critical_statuses = ["Overflow", "Full", "Empty"]
                        if (previous_tank_status and
                            previous_tank_status != tank_status.value and
                            tank_status.value in critical_statuses):

                            logger.info(
                                f"Tank status changed to critical state: {previous_tank_status} -> {tank_status.value}",
                                extra={
                                    "extra_fields": {
                                        "device_id": tank_data.device_id,
                                        "old_tank_status": previous_tank_status,
                                        "new_tank_status": tank_status.value,
                                        "level_percent": level_percent
                                    }
                                }
                            )

                            # Send tank status notification
                            await notification_service.send_tank_notification(
                                user_tokens=user_tokens,
                                tank_status=tank_status.value,
                                level_percent=level_percent,
                                device_id=tank_data.device_id,
                                device_name=device_association.get("device_name", tank_data.device_id),
                            )
                    else:
                        logger.debug("No active user FCM tokens found for notifications")
                else:
                    logger.debug(f"No previous tank reading found for device {tank_data.device_id}")
            else:
                logger.debug("Notification service not initialized, skipping notifications")
        except Exception as e:
            # Log error but don't fail the request
            logger.error(
                f"Error sending tank notifications: {str(e)}",
                extra={
                    "extra_fields": {
                        "device_id": tank_data.device_id,
                        "error": str(e)
                    }
                },
                exc_info=True
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
