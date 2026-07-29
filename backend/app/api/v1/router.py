"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.endpoints import alerts, auth, config, devices, health, sensor, status

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(sensor.router)
api_router.include_router(alerts.router)
api_router.include_router(status.router)
api_router.include_router(config.router)
api_router.include_router(devices.router)
api_router.include_router(devices.admin_router)
api_router.include_router(health.router)
