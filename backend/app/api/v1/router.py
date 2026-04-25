"""API v1 router aggregation"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth


# Create main API v1 router
api_router = APIRouter()

# Include authentication endpoints
api_router.include_router(auth.router)

# TODO: Include other endpoint routers as they are implemented
# api_router.include_router(sensor.router)
# api_router.include_router(status.router)
# api_router.include_router(historical.router)
# api_router.include_router(config.router)
# api_router.include_router(health.router)
