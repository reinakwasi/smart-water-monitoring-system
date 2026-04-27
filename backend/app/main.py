from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.utils.logger import setup_logging, get_logger
from app.db.mongodb import mongodb
from app.api.v1.router import api_router
from app.middleware import (
    global_error_handler,
    validation_exception_handler,
    http_exception_handler,
    general_exception_handler,
    limiter,
    rate_limit_exceeded_handler
)

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.app_name}")
    
    # Connect to database
    try:
        await mongodb.connect()
        logger.info("Database connected")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise
    
    # Load ML models
    try:
        from ml.ml_service import ml_service
        from ml.shap_service import shap_service
        
        if ml_service.is_ready():
            logger.info("ML models loaded")
            shap_service.set_models(
                classifier=ml_service.classifier,
                risk_predictor=ml_service.risk_predictor
            )
            if shap_service.is_ready():
                logger.info("SHAP service ready")
        else:
            logger.warning("ML models not loaded")
    except Exception as e:
        logger.error(f"ML initialization error: {e}")
    
    # Initialize notifications
    try:
        from app.services.notification_service import initialize_notification_service
        notification_svc = initialize_notification_service(settings.fcm_server_key)
        if notification_svc:
            logger.info("Notification service ready")
    except Exception as e:
        logger.error(f"Notification service error: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down")
    try:
        await mongodb.disconnect()
        logger.info("Database disconnected")
    except Exception as e:
        logger.error(f"Shutdown error: {e}")


# Create app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Water quality monitoring with ML predictions",
    lifespan=lifespan,
    debug=settings.debug
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

from slowapi.middleware import SlowAPIMiddleware
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Error handling
app.middleware("http")(global_error_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# API routes
app.include_router(api_router, prefix=settings.api_v1_prefix)


@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
@app.get("/")
async def root(request: Request):
    return {
        "message": "Water Quality Monitoring System API",
        "version": settings.app_version,
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version
    }


if __name__ == "__main__":
    import uvicorn
    
    ssl_config = {}
    if settings.ssl_enabled:
        if settings.ssl_certfile and settings.ssl_keyfile:
            ssl_config = {
                "ssl_certfile": settings.ssl_certfile,
                "ssl_keyfile": settings.ssl_keyfile
            }
            logger.info("Starting with HTTPS enabled")
        else:
            logger.warning("SSL enabled but no certificates provided")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
        **ssl_config
    )
