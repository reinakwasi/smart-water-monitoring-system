"""Status and historical data endpoints for water quality monitoring"""

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from typing import Optional, List
import time

from app.db.mongodb import mongodb
from app.dependencies import get_current_user
from app.services.data_isolation_service import data_isolation_service, log_admin_access
from app.models.schemas import (
    CurrentStatusResponse,
    WaterQualityStatus,
    ContaminationRiskStatus,
    TankLevelStatus,
    HistoricalDataResponse,
    HistoricalDataPoint,
    WaterQualityClassification,
    RiskLevel,
    TankStatus,
    SHAPExplanation,
    SHAPFactor,
    ParameterClassifications,
    ErrorResponse
)
from app.utils.logger import get_logger
from app.config import settings


logger = get_logger(__name__)
router = APIRouter(prefix="/status", tags=["Status"])


# Simple in-memory cache for current status (30 second TTL)
_status_cache = {
    "data": None,
    "timestamp": None,
    "ttl_seconds": 2,
    "entries": {},
}


def is_cache_valid(cache_key: Optional[str] = None) -> bool:
    """Check if cached status data is still valid"""
    if cache_key is not None:
        entry = _status_cache["entries"].get(cache_key)
        return bool(entry and time.time() - entry["timestamp"] < _status_cache["ttl_seconds"])

    if _status_cache["data"] is None or _status_cache["timestamp"] is None:
        return False

    elapsed = time.time() - _status_cache["timestamp"]
    return elapsed < _status_cache["ttl_seconds"]


def get_cached_status(cache_key: Optional[str] = None) -> Optional[dict]:
    """Get cached status if valid"""
    if cache_key is not None:
        entry = _status_cache["entries"].get(cache_key)
        return entry["data"] if is_cache_valid(cache_key) else None

    if is_cache_valid():
        logger.debug("Returning cached status data")
        return _status_cache["data"]
    return None


def set_cached_status(data: dict, cache_key: Optional[str] = None):
    """Cache status data with current timestamp"""
    if cache_key is not None:
        _status_cache["entries"][cache_key] = {"data": data, "timestamp": time.time()}
        return

    _status_cache["data"] = data
    _status_cache["timestamp"] = time.time()
    logger.debug("Status data cached")


@router.get(
    "/current-status",
    response_model=CurrentStatusResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Current status retrieved successfully"},
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        404: {"model": ErrorResponse, "description": "No data available"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def get_current_status(
    request: Request,
    device_id: Optional[str] = Query(None, description="Filter by specific device ID"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Get current water quality and tank status    This endpoint:
    1. Requires JWT authentication
    2. Queries latest sensor reading and tank level from MongoDB
    3. Returns current water quality, risk, and tank status
    4. Implements response caching (30 second TTL)

    Args:
        device_id: Optional device ID filter
        current_user: Authenticated user from JWT token
        db: MongoDB database instance

    Returns:
        CurrentStatusResponse with water quality, contamination risk, and tank status

    Raises:
        HTTPException: 404 if no data available
        HTTPException: 500 if query fails
    """
    logger.info(
        f"Current status requested by user: {current_user.get('email')}",
        extra={
            "extra_fields": {
                "user_email": current_user.get("email"),
                "device_id": device_id
            }
        }
    )

    try:
        user_id = str(current_user["_id"])
        user_role = current_user.get("role", "user")
        owned_device_ids: List[str] = []
        simple_esp32_mode = settings.allow_legacy_device_uploads and not device_id
        if user_role != "admin":
            owned_device_ids = await data_isolation_service.get_user_device_ids(user_id, db)
            if not owned_device_ids and not simple_esp32_mode:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No devices registered. Please register a device first.",
                )
            if device_id and not await data_isolation_service.verify_device_ownership(
                user_id, device_id, db
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Device does not belong to your account.",
                )

        if user_role != "admin" and simple_esp32_mode:
            query_filter = {}
        else:
            query_filter = await data_isolation_service.build_device_filter(
                user_id, user_role, db, device_id
            )
        if user_role == "admin":
            await log_admin_access(
                user_id=user_id,
                action="read_current_status",
                endpoint="/status/current-status",
                device_id=device_id,
                db=db,
                ip_address=request.client.host if request.client else None,
                query_parameters=dict(request.query_params),
            )

        cache_scope = device_id or ",".join(sorted(owned_device_ids)) or "all-devices"
        cache_key = f"{user_role}:{user_id}:{cache_scope}"
        cached_data = get_cached_status(cache_key)
        if cached_data is not None:
            return CurrentStatusResponse(**cached_data)
        # Step 1: Query latest sensor reading
        logger.debug("Querying latest sensor reading from database")
        latest_sensor_reading = await db.sensor_readings.find_one(
            query_filter,
            sort=[("created_at", -1), ("timestamp", -1)]
        )

        if latest_sensor_reading is None and simple_esp32_mode and query_filter:
            logger.info("No owned-device reading found; falling back to latest simple ESP32 reading")
            query_filter = {}
            latest_sensor_reading = await db.sensor_readings.find_one(
                query_filter,
                sort=[("created_at", -1), ("timestamp", -1)]
            )

        if latest_sensor_reading is None:
            logger.warning("No sensor readings found in database")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No sensor data available. Please ensure sensors are transmitting data."
            )

        sensor_display_timestamp = latest_sensor_reading.get("created_at") or latest_sensor_reading["timestamp"]
        tank_display_timestamp = None

        logger.debug(
            f"Found latest sensor reading from {latest_sensor_reading['timestamp']}",
            extra={
                "extra_fields": {
                    "device_id": latest_sensor_reading["device_id"],
                    "timestamp": latest_sensor_reading["timestamp"].isoformat()
                }
            }
        )

        # Step 2: Query latest tank level reading
        logger.debug("Querying latest tank level reading from database")
        tank_query_filter = query_filter or {"device_id": latest_sensor_reading["device_id"]}
        latest_tank_reading = await db.tank_readings.find_one(
            tank_query_filter,
            sort=[("created_at", -1), ("timestamp", -1)]
        )

        if latest_tank_reading is None:
            # Allow the water-quality dashboard to work before a tank sensor is added.
            latest_tank_reading = {
                "tank_status": "Empty",
                "level_percent": 0.0,
                "volume_liters": 0.0,
                "timestamp": sensor_display_timestamp
            }
            logger.warning("No tank readings found; returning an empty tank status")
        else:
            tank_display_timestamp = latest_tank_reading.get("created_at") or latest_tank_reading["timestamp"]
            logger.debug(
                f"Found latest tank reading from {latest_tank_reading['timestamp']}",
                extra={
                    "extra_fields": {
                        "device_id": latest_tank_reading["device_id"],
                        "timestamp": latest_tank_reading["timestamp"].isoformat()
                    }
                }
            )

        # Step 3: Build water quality status
        classification_shap_factors = []
        if "classification_shap_values" in latest_sensor_reading:
            # Get top 3 factors by absolute value
            shap_items = sorted(
                (
                    item for item in latest_sensor_reading["classification_shap_values"].items()
                    if not item[0].startswith("dissolved_oxygen")
                ),
                key=lambda x: abs(x[1]),
                reverse=True
            )[:3]

            classification_shap_factors = [
                SHAPFactor(
                    feature=feature,
                    shap_value=value,
                    direction="increasing_risk" if value > 0 else "decreasing_risk"
                )
                for feature, value in shap_items
            ]

        # Get parameter classifications from database
        # If not present (backward compatibility), set empty strings
        parameter_classifications_dict = latest_sensor_reading.get("parameter_classifications", {})
        parameter_classifications = ParameterClassifications(
            ph=parameter_classifications_dict.get("ph", ""),
            turbidity_index=parameter_classifications_dict.get("turbidity_index", ""),
            temperature=parameter_classifications_dict.get("temperature", ""),
            tds=parameter_classifications_dict.get("tds", "")
        )

        water_quality_status = WaterQualityStatus(
            classification=WaterQualityClassification(latest_sensor_reading["classification"]),
            confidence=latest_sensor_reading.get("classification_confidence", 0.0),
            parameters={
                "ph": latest_sensor_reading["ph"],
                "turbidity_index": latest_sensor_reading["turbidity_index"],
                "temperature": latest_sensor_reading["temperature"],
                "tds": latest_sensor_reading["tds"]
            },
            parameter_classifications=parameter_classifications,
            shap_explanation=SHAPExplanation(
                shap_values={
                    key: value for key, value in latest_sensor_reading.get("classification_shap_values", {}).items()
                    if not key.startswith("dissolved_oxygen")
                },
                top_factors=classification_shap_factors
            ),
            timestamp=sensor_display_timestamp
        )

        # Step 4: Build contamination risk status
        risk_shap_factors = []
        if "risk_shap_values" in latest_sensor_reading:
            # Get top 3 factors by absolute value
            shap_items = sorted(
                (
                    item for item in latest_sensor_reading["risk_shap_values"].items()
                    if not item[0].startswith("dissolved_oxygen")
                ),
                key=lambda x: abs(x[1]),
                reverse=True
            )[:3]

            risk_shap_factors = [
                SHAPFactor(
                    feature=feature,
                    shap_value=value,
                    direction="increasing_risk" if value > 0 else "decreasing_risk"
                )
                for feature, value in shap_items
            ]

        contamination_risk_status = ContaminationRiskStatus(
            risk_score=latest_sensor_reading.get("risk_score", 0.0),
            risk_level=RiskLevel(latest_sensor_reading.get("risk_level", "Low")),
            shap_explanation=SHAPExplanation(
                shap_values={
                    key: value for key, value in latest_sensor_reading.get("risk_shap_values", {}).items()
                    if not key.startswith("dissolved_oxygen")
                },
                top_factors=risk_shap_factors
            ),
            timestamp=sensor_display_timestamp
        )

        # Step 5: Build tank level status
        tank_level_status = TankLevelStatus(
            status=TankStatus(latest_tank_reading["tank_status"]),
            level_percent=latest_tank_reading["level_percent"],
            volume_liters=latest_tank_reading["volume_liters"],
            timestamp=tank_display_timestamp or latest_tank_reading["timestamp"]
        )

        # Step 6: Build complete response
        response_data = {
            "water_quality": water_quality_status,
            "contamination_risk": contamination_risk_status,
            "tank_status": tank_level_status
        }

        set_cached_status(response_data, cache_key)

        logger.info(
            f"Current status retrieved successfully",
            extra={
                "extra_fields": {
                    "user_email": current_user.get("email"),
                    "water_quality": water_quality_status.classification.value,
                    "risk_level": contamination_risk_status.risk_level.value,
                    "tank_status": tank_level_status.status.value
                }
            }
        )

        return CurrentStatusResponse(**response_data)

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(
            f"Error retrieving current status: {str(e)}",
            extra={
                "extra_fields": {
                    "user_email": current_user.get("email"),
                    "error": str(e)
                }
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve current status: {str(e)}"
        )


@router.get(
    "/historical-data",
    response_model=HistoricalDataResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Historical data retrieved successfully"},
        400: {"model": ErrorResponse, "description": "Invalid query parameters"},
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def get_historical_data(
    request: Request,
    start_date: datetime = Query(..., description="Start date for historical data (ISO8601 format)"),
    end_date: datetime = Query(..., description="End date for historical data (ISO8601 format)"),
    parameter: Optional[str] = Query(None, description="Filter by specific parameter (ph, turbidity_index, temperature, tds, tank_level, all)"),
    device_id: Optional[str] = Query(None, description="Filter by specific device ID"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum number of records to return"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Retrieve historical sensor readings and predictions    This endpoint:
    1. Requires JWT authentication
    2. Accepts query parameters: start_date, end_date, parameter, device_id, limit
    3. Queries MongoDB with date range filter and projection
    4. Returns historical readings with pagination
    5. Optimizes query with indexes

    Args:
        start_date: Start date for query range
        end_date: End date for query range
        parameter: Optional parameter filter
        device_id: Optional device ID filter
        limit: Maximum number of records (default: 1000, max: 10000)
        current_user: Authenticated user from JWT token
        db: MongoDB database instance

    Returns:
        HistoricalDataResponse with historical data points

    Raises:
        HTTPException: 400 if date range is invalid
        HTTPException: 500 if query fails
    """
    logger.info(
        f"Historical data requested by user: {current_user.get('email')}",
        extra={
            "extra_fields": {
                "user_email": current_user.get("email"),
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "parameter": parameter,
                "device_id": device_id,
                "limit": limit
            }
        }
    )

    try:
        # Validate date range
        if start_date >= end_date:
            logger.warning(
                f"Invalid date range: start_date ({start_date}) >= end_date ({end_date})"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date must be before end_date"
            )

        # Check if date range exceeds 30 days (warn but allow)
        date_range_days = (end_date - start_date).days
        if date_range_days > 30:
            logger.warning(
                f"Large date range requested: {date_range_days} days",
                extra={
                    "extra_fields": {
                        "user_email": current_user.get("email"),
                        "date_range_days": date_range_days
                    }
                }
            )

        # Validate parameter filter
        valid_parameters = ["ph", "turbidity_index", "temperature", "tds", "tank_level", "all", None]
        if parameter not in valid_parameters:
            logger.warning(f"Invalid parameter filter: {parameter}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid parameter. Must be one of: {', '.join([p for p in valid_parameters if p is not None])}"
            )

        user_id = str(current_user["_id"])
        user_role = current_user.get("role", "user")
        owned_device_ids: List[str] = []
        simple_esp32_mode = settings.allow_legacy_device_uploads and not device_id
        if user_role != "admin":
            owned_device_ids = await data_isolation_service.get_user_device_ids(user_id, db)
            if not owned_device_ids and not simple_esp32_mode:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No devices registered. Please register a device first.",
                )
            if device_id and not await data_isolation_service.verify_device_ownership(
                user_id, device_id, db
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Device does not belong to your account.",
                )

        if user_role != "admin" and simple_esp32_mode:
            device_filter = {}
        else:
            device_filter = await data_isolation_service.build_device_filter(
                user_id, user_role, db, device_id
            )
        query_filter = {**device_filter, "timestamp": {
            "$gte": start_date,
            "$lte": end_date,
        }}
        if user_role == "admin":
            await log_admin_access(
                user_id=user_id,
                action="read_historical_data",
                endpoint="/status/historical-data",
                device_id=device_id,
                db=db,
                ip_address=request.client.host if request.client else None,
                query_parameters=dict(request.query_params),
            )

        # Step 1: Query sensor readings with date range filter
        logger.debug(
            f"Querying sensor readings with filter: {query_filter}",
            extra={
                "extra_fields": {
                    "query_filter": str(query_filter),
                    "limit": limit
                }
            }
        )

        sensor_cursor = db.sensor_readings.find(
            query_filter,
            sort=[("created_at", 1), ("timestamp", 1)]  # Ascending order (oldest to newest)
        ).limit(limit)

        sensor_readings = []
        async for reading in sensor_cursor:
            sensor_readings.append(reading)

        if not sensor_readings and simple_esp32_mode and device_filter:
            logger.info("No owned-device history found; falling back to simple ESP32 history")
            device_filter = {}
            query_filter = {"timestamp": {
                "$gte": start_date,
                "$lte": end_date,
            }}
            sensor_cursor = db.sensor_readings.find(
                query_filter,
                sort=[("created_at", 1), ("timestamp", 1)]
            ).limit(limit)
            sensor_readings = []
            async for reading in sensor_cursor:
                sensor_readings.append(reading)

        logger.debug(f"Found {len(sensor_readings)} sensor readings")

        # Query tank readings from the same period. Water and tank messages are sent
        # separately, so they are matched by nearest timestamp instead of exact time.
        logger.debug("Querying tank readings")
        tank_cursor = db.tank_readings.find(
            query_filter,
            sort=[("created_at", 1), ("timestamp", 1)]
        ).limit(limit)

        tank_readings = []
        async for reading in tank_cursor:
            tank_readings.append(reading)

        logger.debug(f"Found {len(tank_readings)} tank readings")

        def record_time(record: dict) -> Optional[datetime]:
            value = record.get("created_at") or record.get("timestamp")
            return value if isinstance(value, datetime) else None

        def nearest_tank_reading(sensor_reading: dict) -> Optional[dict]:
            sensor_time = record_time(sensor_reading)
            if sensor_time is None:
                return None

            sensor_device_id = sensor_reading.get("device_id")
            candidates = [
                tank for tank in tank_readings
                if not sensor_device_id or tank.get("device_id") == sensor_device_id
            ]
            if not candidates:
                return None

            best = min(
                candidates,
                key=lambda tank: abs(((record_time(tank) or sensor_time) - sensor_time).total_seconds())
            )
            best_time = record_time(best)
            if best_time is None:
                return None

            return best if abs((best_time - sensor_time).total_seconds()) <= 120 else None

        # Build historical data points
        historical_data: List[HistoricalDataPoint] = []

        for sensor_reading in sensor_readings:
            # Build parameters dict based on filter
            parameters = {}

            if parameter is None or parameter == "all":
                parameters = {
                    "ph": sensor_reading["ph"],
                    "turbidity_index": sensor_reading["turbidity_index"],
                    "temperature": sensor_reading["temperature"],
                    "tds": sensor_reading["tds"]
                }
            elif parameter in ["ph", "turbidity_index", "temperature", "tds"]:
                parameters[parameter] = sensor_reading.get(parameter, 0.0)

            # Get the nearest tank level for this water reading when available.
            tank_level_percent = None
            if parameter is None or parameter == "all" or parameter == "tank_level":
                tank_reading = nearest_tank_reading(sensor_reading)
                if tank_reading:
                    tank_level_percent = tank_reading["level_percent"]

            # Create historical data point
            data_point = HistoricalDataPoint(
                timestamp=sensor_reading.get("created_at") or sensor_reading["timestamp"],
                parameters=parameters,
                classification=WaterQualityClassification(sensor_reading["classification"]),
                risk_score=sensor_reading.get("risk_score", 0.0),
                tank_level_percent=tank_level_percent
            )

            historical_data.append(data_point)

        # Step 4: Build response
        response = HistoricalDataResponse(
            data=historical_data,
            count=len(historical_data),
            start_date=start_date,
            end_date=end_date
        )

        logger.info(
            f"Historical data retrieved successfully: {len(historical_data)} records",
            extra={
                "extra_fields": {
                    "user_email": current_user.get("email"),
                    "record_count": len(historical_data),
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                }
            }
        )

        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(
            f"Error retrieving historical data: {str(e)}",
            extra={
                "extra_fields": {
                    "user_email": current_user.get("email"),
                    "error": str(e)
                }
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve historical data: {str(e)}"
        )
