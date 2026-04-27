"""Global error handling middleware for FastAPI application

This middleware handles all exceptions and errors that occur during request processing,
providing consistent error responses and comprehensive logging."""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import ValidationError
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure
from datetime import datetime
from typing import Union
import traceback

from app.utils.logger import get_logger


logger = get_logger(__name__)


async def global_error_handler(request: Request, call_next):
    """
    Global error handling middleware    This middleware:
    1. Handles database connection failures (return 503)
    2. Handles validation errors (return 400 with descriptive message)
    3. Handles authentication errors (return 401)
    4. Handles authorization errors (return 403)
    5. Logs all errors with timestamp, component, and context
    
    Args:
        request: FastAPI request object
        call_next: Next middleware or route handler
        
    Returns:
        Response from route handler or error response
    """
    try:
        # Process the request
        response = await call_next(request)
        return response
        
    except Exception as exc:
        # Handle the exception and return appropriate error response
        return await handle_exception(request, exc)


async def handle_exception(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle exceptions and return appropriate error responses
    
    Args:
        request: FastAPI request object
        exc: Exception that occurred
        
    Returns:
        JSONResponse with error details
    """
    # Extract request context for logging
    request_context = {
        "method": request.method,
        "url": str(request.url),
        "client_host": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }
    
    # Handle database connection errors
    if isinstance(exc, (ServerSelectionTimeoutError, ConnectionFailure)):
        logger.error(
            f"Database connection failure: {str(exc)}",
            extra={
                "extra_fields": {
                    "component": "database",
                    "error_type": "connection_failure",
                    "timestamp": datetime.utcnow().isoformat(),
                    **request_context
                }
            },
            exc_info=True
        )
        
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "error": "service_unavailable",
                "message": "Database service is temporarily unavailable. Please try again later.",
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    # Handle request validation errors
    if isinstance(exc, RequestValidationError):
        # Extract validation error details
        errors = []
        for error in exc.errors():
            field = " -> ".join(str(loc) for loc in error["loc"])
            message = error["msg"]
            error_type = error["type"]
            
            errors.append({
                "field": field,
                "message": message,
                "type": error_type
            })
        
        logger.warning(
            f"Request validation error: {len(errors)} validation errors",
            extra={
                "extra_fields": {
                    "component": "validation",
                    "error_type": "validation_error",
                    "validation_errors": errors,
                    "timestamp": datetime.utcnow().isoformat(),
                    **request_context
                }
            }
        )
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": errors,
                "status": "error",
                "error": "validation_error",
                "message": "Request validation failed. Please check your input.",
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    # Handle Pydantic validation errors
    if isinstance(exc, ValidationError):
        errors = []
        for error in exc.errors():
            field = " -> ".join(str(loc) for loc in error["loc"])
            message = error["msg"]
            error_type = error["type"]
            
            errors.append({
                "field": field,
                "message": message,
                "type": error_type
            })
        
        logger.warning(
            f"Data validation error: {len(errors)} validation errors",
            extra={
                "extra_fields": {
                    "component": "validation",
                    "error_type": "data_validation_error",
                    "validation_errors": errors,
                    "timestamp": datetime.utcnow().isoformat(),
                    **request_context
                }
            }
        )
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": errors,
                "status": "error",
                "error": "validation_error",
                "message": "Data validation failed. Please check your input.",
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    # Handle HTTP exceptions
    if isinstance(exc, StarletteHTTPException):
        # Log based on status code
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            logger.warning(
                f"Authentication error: {exc.detail}",
                extra={
                    "extra_fields": {
                        "component": "authentication",
                        "error_type": "authentication_error",
                        "timestamp": datetime.utcnow().isoformat(),
                        **request_context
                    }
                }
            )
        elif exc.status_code == status.HTTP_403_FORBIDDEN:
            logger.warning(
                f"Authorization error: {exc.detail}",
                extra={
                    "extra_fields": {
                        "component": "authorization",
                        "error_type": "authorization_error",
                        "timestamp": datetime.utcnow().isoformat(),
                        **request_context
                    }
                }
            )
        else:
            logger.warning(
                f"HTTP exception: {exc.status_code} - {exc.detail}",
                extra={
                    "extra_fields": {
                        "component": "http",
                        "error_type": "http_exception",
                        "status_code": exc.status_code,
                        "timestamp": datetime.utcnow().isoformat(),
                        **request_context
                    }
                }
            )
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.detail,
                "status": "error",
                "error": get_error_code_from_status(exc.status_code),
                "message": exc.detail,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    # Handle all other exceptions
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {str(exc)}",
        extra={
            "extra_fields": {
                "component": "application",
                "error_type": "unhandled_exception",
                "exception_type": type(exc).__name__,
                "exception_message": str(exc),
                "traceback": traceback.format_exc(),
                "timestamp": datetime.utcnow().isoformat(),
                **request_context
            }
        },
        exc_info=True
    )
    
    # Return generic 500 error (don't expose internal details)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "error": "internal_server_error",
            "message": "An internal server error occurred. Please try again later.",
            "timestamp": datetime.utcnow().isoformat()
        }
    )


def get_error_code_from_status(status_code: int) -> str:
    """
    Get error code string from HTTP status code
    
    Args:
        status_code: HTTP status code
        
    Returns:
        Error code string
    """
    error_codes = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        405: "method_not_allowed",
        409: "conflict",
        422: "unprocessable_entity",
        429: "too_many_requests",
        500: "internal_server_error",
        502: "bad_gateway",
        503: "service_unavailable",
        504: "gateway_timeout"
    }
    
    return error_codes.get(status_code, "unknown_error")


# Exception handlers for FastAPI app.add_exception_handler()

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return await handle_exception(request, exc)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return await handle_exception(request, exc)


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return await handle_exception(request, exc)
