"""Health check endpoint for system monitoring"""

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from typing import Dict, List, Any

from app.db.mongodb import mongodb
from app.models.schemas import HealthCheckResponse, ComponentHealth, SensorDeviceHealth, SystemHealthStatus
from app.utils.logger import get_logger


logger = get_logger(__name__)
router = APIRouter(prefix="/health", tags=["Health"])


@router.get(
    "",
    response_model=HealthCheckResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "System health check completed"},
        503: {"description": "Service unavailable"}
    }
)
async def health_check(
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    System health check endpoint    This endpoint:
    1. Checks MongoDB connection status and latency
    2. Checks ML models loaded status and versions
    3. Checks notification service status
    4. Reports sensor device online/offline status
    5. Returns overall system health (healthy/degraded/unhealthy)
    
    Returns:
        HealthCheckResponse with overall status and component health details
    """
    logger.info("Health check requested")
    
    timestamp = datetime.utcnow()
    components: Dict[str, ComponentHealth] = {}
    sensors: List[SensorDeviceHealth] = []
    
    # Step 1: Check MongoDB connection status and latency (Requirement 19.1, 19.2)
    logger.debug("Checking MongoDB connection health")
    try:
        db_health = await mongodb.health_check()
        
        if db_health["status"] == "connected":
            components["database"] = ComponentHealth(
                status="connected",
                latency_ms=db_health["latency_ms"]
            )
            logger.debug(f"MongoDB health: connected (latency: {db_health['latency_ms']}ms)")
        else:
            components["database"] = ComponentHealth(
                status="disconnected",
                latency_ms=None
            )
            logger.warning("MongoDB health: disconnected")
    except Exception as e:
        logger.error(f"Error checking MongoDB health: {str(e)}", exc_info=True)
        components["database"] = ComponentHealth(
            status="disconnected",
            latency_ms=None
        )
    
    # Step 2: Check ML models loaded status and versions (Requirement 19.3, 19.5)
    logger.debug("Checking ML models status")
    try:
        from ml.ml_service import ml_service
        
        model_info = ml_service.get_model_info()
        
        classifier_loaded = model_info["classifier"]["loaded"]
        predictor_loaded = model_info["risk_predictor"]["loaded"]
        
        if classifier_loaded and predictor_loaded:
            ml_status = "loaded"
        elif classifier_loaded or predictor_loaded:
            ml_status = "partially_loaded"
        else:
            ml_status = "not_loaded"
        
        components["ml_models"] = ComponentHealth(
            status=ml_status,
            classifier_version=model_info["classifier"]["version"] if classifier_loaded else None,
            predictor_version=model_info["risk_predictor"]["version"] if predictor_loaded else None
        )
        
        logger.debug(
            f"ML models health: {ml_status} "
            f"(classifier: {model_info['classifier']['version']}, "
            f"predictor: {model_info['risk_predictor']['version']})"
        )
    except Exception as e:
        logger.error(f"Error checking ML models health: {str(e)}", exc_info=True)
        components["ml_models"] = ComponentHealth(
            status="not_loaded",
            classifier_version=None,
            predictor_version=None
        )
    
    # Step 3: Check notification service status (Requirement 19.4)
    logger.debug("Checking notification service status")
    try:
        from app.services.notification_service import get_notification_service
        
        notification_svc = get_notification_service()
        
        if notification_svc is not None and notification_svc.fcm_server_key:
            notif_status = "operational"
        elif notification_svc is not None:
            notif_status = "degraded"
        else:
            notif_status = "not_initialized"
        
        components["notification_service"] = ComponentHealth(
            status=notif_status
        )
        
        logger.debug(f"Notification service health: {notif_status}")
    except Exception as e:
        logger.error(f"Error checking notification service health: {str(e)}", exc_info=True)
        components["notification_service"] = ComponentHealth(
            status="not_initialized"
        )
    
    # Step 4: Report sensor device online/offline status (Requirement 19.6)
    logger.debug("Checking sensor device status")
    try:
        # Query all registered sensor devices
        sensor_devices_cursor = db.sensor_devices.find({})
        
        offline_threshold = datetime.utcnow() - timedelta(minutes=5)
        
        async for device in sensor_devices_cursor:
            device_id = device["device_id"]
            
            # Find the most recent sensor reading for this device
            latest_reading = await db.sensor_readings.find_one(
                {"device_id": device_id},
                sort=[("timestamp", -1)]
            )
            
            if latest_reading:
                last_communication = latest_reading["timestamp"]
                
                # Device is online if it communicated within the last 5 minutes
                if last_communication >= offline_threshold:
                    device_status = "online"
                else:
                    device_status = "offline"
                
                sensors.append(
                    SensorDeviceHealth(
                        device_id=device_id,
                        status=device_status,
                        last_communication=last_communication
                    )
                )
                
                logger.debug(
                    f"Sensor device {device_id}: {device_status} "
                    f"(last communication: {last_communication.isoformat()})"
                )
            else:
                # No readings found for this device
                sensors.append(
                    SensorDeviceHealth(
                        device_id=device_id,
                        status="offline",
                        last_communication=None
                    )
                )
                logger.debug(f"Sensor device {device_id}: offline (no readings found)")
        
        logger.debug(f"Found {len(sensors)} registered sensor devices")
    except Exception as e:
        logger.error(f"Error checking sensor device status: {str(e)}", exc_info=True)
        # Continue with empty sensors list
    
    # Step 5: Determine overall system health (Requirement 19.5)
    logger.debug("Determining overall system health")
    
    # Count component statuses
    critical_components_healthy = (
        components["database"].status == "connected" and
        components["ml_models"].status == "loaded"
    )
    
    notification_healthy = components["notification_service"].status == "operational"
    
    # Determine overall status
    if critical_components_healthy and notification_healthy:
        overall_status = SystemHealthStatus.HEALTHY
    elif critical_components_healthy:
        overall_status = SystemHealthStatus.DEGRADED
    else:
        overall_status = SystemHealthStatus.UNHEALTHY
    
    logger.info(
        f"Health check completed: {overall_status.value}",
        extra={
            "extra_fields": {
                "overall_status": overall_status.value,
                "database_status": components["database"].status,
                "ml_models_status": components["ml_models"].status,
                "notification_service_status": components["notification_service"].status,
                "sensor_count": len(sensors)
            }
        }
    )
    
    # Build response
    response = HealthCheckResponse(
        status=overall_status,
        timestamp=timestamp,
        components=components,
        sensors=sensors
    )
    
    return response
