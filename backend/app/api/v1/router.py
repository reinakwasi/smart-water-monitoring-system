"""API v1 router aggregation"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, sensor, status, config


# Create main API v1 router
api_router = APIRouter()

# Include authentication endpoints
api_router.include_router(auth.router)

# Include sensor data ingestion endpoints
api_router.include_router(sensor.router)

# Include status and historical data endpoints
api_router.include_router(status.router)

# Include configuration and calibration endpoints
api_router.include_router(config.router)

# TODO: Include other endpoint routers as they are implemented
# api_router.include_router(health.router)
