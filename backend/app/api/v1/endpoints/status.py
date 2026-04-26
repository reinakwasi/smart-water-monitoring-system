"""Status and historical data endpoints for water quality monitoring"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from typing import Optional, List
import time

from app.db.mongodb import mongodb
from app.dependencies import get_current_user
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
    ErrorResponse
)
from app.utils.logger import get_logger


logger = get_logger(__name__)
router = APIRouter(prefix="/status", tags=["Status"])


# Simple in-memory cache for current status (30 second TTL)
_status_cache = {
    "data": None,
    "timestamp": None,
    "ttl_seconds": 30
}


def is_cache_valid() -> bool:
    """Check if cached status data is still valid"""
    if _status_cache["data"] is None or _status_cache["timestamp"] is None:
        return False
    
    elapsed = time.time() - _status_cache["timestamp"]
    return elapsed < _status_cache["ttl_seconds"]


def get_cached_status() -> Optional[dict]:
    """Get cached status if valid"""
    if is_cache_valid():
        logger.debug("Returning cached status data")
        return _status_cache["data"]
    return None


def set_cached_status(data: dict):
    """Cache status data with current timestamp"""
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
    device_id: Optional[str] = Query(None, description="Filter by specific device ID"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Get current water quality and tank status
    
    Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 17.1
    
    This endpoint:
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
        # Check cache first (only if no device_id filter)
        if device_id is None:
            cached_data = get_cached_status()
            if cached_data is not None:
                logger.info("Returning cached current status")
                return CurrentStatusResponse(**cached_data)
        
        # Build query filter
        query_filter = {}
        if device_id:
            query_filter["device_id"] = device_id
        
        # Step 1: Query latest sensor reading
        logger.debug("Querying latest sensor reading from database")
        latest_sensor_reading = await db.sensor_readings.find_one(
            query_filter,
            sort=[("timestamp", -1)]
        )
        
        if latest_sensor_reading is None:
            logger.warning("No sensor readings found in database")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No sensor data available. Please ensure sensors are transmitting data."
            )
        
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
        latest_tank_reading = await db.tank_readings.find_one(
            query_filter,
            sort=[("timestamp", -1)]
        )
        
        if latest_tank_reading is None:
            logger.warning("No tank readings found in database")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No tank level data available. Please ensure tank sensor is transmitting data."
            )
        
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
                latest_sensor_reading["classification_shap_values"].items(),
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
        
        water_quality_status = WaterQualityStatus(
            classification=WaterQualityClassification(latest_sensor_reading["classification"]),
            confidence=latest_sensor_reading.get("classification_confidence", 0.0),
            parameters={
                "ph": latest_sensor_reading["ph"],
                "turbidity": latest_sensor_reading["turbidity"],
                "temperature": latest_sensor_reading["temperature"],
                "tds": latest_sensor_reading["tds"],
                "dissolved_oxygen": latest_sensor_reading["dissolved_oxygen"]
            },
            shap_explanation=SHAPExplanation(
                shap_values=latest_sensor_reading.get("classification_shap_values", {}),
                top_factors=classification_shap_factors
            ),
            timestamp=latest_sensor_reading["timestamp"]
        )
        
        # Step 4: Build contamination risk status
        risk_shap_factors = []
        if "risk_shap_values" in latest_sensor_reading:
            # Get top 3 factors by absolute value
            shap_items = sorted(
                latest_sensor_reading["risk_shap_values"].items(),
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
                shap_values=latest_sensor_reading.get("risk_shap_values", {}),
                top_factors=risk_shap_factors
            ),
            timestamp=latest_sensor_reading["timestamp"]
        )
        
        # Step 5: Build tank level status
        tank_level_status = TankLevelStatus(
            status=TankStatus(latest_tank_reading["tank_status"]),
            level_percent=latest_tank_reading["level_percent"],
            volume_liters=latest_tank_reading["volume_liters"],
            timestamp=latest_tank_reading["timestamp"]
        )
        
        # Step 6: Build complete response
        response_data = {
            "water_quality": water_quality_status,
            "contamination_risk": contamination_risk_status,
            "tank_status": tank_level_status
        }
        
        # Cache the response (only if no device_id filter)
        if device_id is None:
            set_cached_status(response_data)
        
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
    start_date: datetime = Query(..., description="Start date for historical data (ISO8601 format)"),
    end_date: datetime = Query(..., description="End date for historical data (ISO8601 format)"),
    parameter: Optional[str] = Query(None, description="Filter by specific parameter (ph, turbidity, temperature, tds, dissolved_oxygen, tank_level, all)"),
    device_id: Optional[str] = Query(None, description="Filter by specific device ID"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum number of records to return"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Retrieve historical sensor readings and predictions
    
    Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 11.6, 11.7
    
    This endpoint:
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
        valid_parameters = ["ph", "turbidity", "temperature", "tds", "dissolved_oxygen", "tank_level", "all", None]
        if parameter not in valid_parameters:
            logger.warning(f"Invalid parameter filter: {parameter}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid parameter. Must be one of: {', '.join([p for p in valid_parameters if p is not None])}"
            )
        
        # Build query filter
        query_filter = {
            "timestamp": {
                "$gte": start_date,
                "$lte": end_date
            }
        }
        
        if device_id:
            query_filter["device_id"] = device_id
        
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
            sort=[("timestamp", 1)]  # Ascending order (oldest to newest)
        ).limit(limit)
        
        sensor_readings = []
        async for reading in sensor_cursor:
            sensor_readings.append(reading)
        
        logger.debug(f"Found {len(sensor_readings)} sensor readings")
        
        # Step 2: Query tank readings with same filter
        logger.debug("Querying tank readings")
        tank_cursor = db.tank_readings.find(
            query_filter,
            sort=[("timestamp", 1)]
        ).limit(limit)
        
        tank_readings = {}
        async for reading in tank_cursor:
            # Index by timestamp for easy lookup
            tank_readings[reading["timestamp"]] = reading
        
        logger.debug(f"Found {len(tank_readings)} tank readings")
        
        # Step 3: Build historical data points
        historical_data: List[HistoricalDataPoint] = []
        
        for sensor_reading in sensor_readings:
            # Build parameters dict based on filter
            parameters = {}
            
            if parameter is None or parameter == "all":
                parameters = {
                    "ph": sensor_reading["ph"],
                    "turbidity": sensor_reading["turbidity"],
                    "temperature": sensor_reading["temperature"],
                    "tds": sensor_reading["tds"],
                    "dissolved_oxygen": sensor_reading["dissolved_oxygen"]
                }
            elif parameter in ["ph", "turbidity", "temperature", "tds", "dissolved_oxygen"]:
                parameters[parameter] = sensor_reading[parameter]
            
            # Get tank level if available and requested
            tank_level_percent = None
            if parameter is None or parameter == "all" or parameter == "tank_level":
                tank_reading = tank_readings.get(sensor_reading["timestamp"])
                if tank_reading:
                    tank_level_percent = tank_reading["level_percent"]
            
            # Create historical data point
            data_point = HistoricalDataPoint(
                timestamp=sensor_reading["timestamp"],
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
