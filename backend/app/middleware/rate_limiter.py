"""Rate limiting middleware for FastAPI application

This middleware implements rate limiting to prevent API abuse."""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, status
from fastapi.responses import JSONResponse
from datetime import datetime, timezone

from app.utils.logger import get_logger


logger = get_logger(__name__)


def get_rate_limit_key(request: Request) -> str:
    """
    Get rate limit key from request
    
    Uses IP address as the primary identifier for rate limiting.
    For authenticated requests, could be extended to use user ID.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Rate limit key (IP address)
    """
    return get_remote_address(request)


# Initialize rate limiter
# The limiter will use in-memory storage by default
limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=[],  # No default limits, we'll apply per-route
    storage_uri="memory://",
    strategy="fixed-window"
)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Handle rate limit exceeded errors    
    Args:
        request: FastAPI request object
        exc: RateLimitExceeded exception
        
    Returns:
        JSONResponse with 429 status code
    """
    # Log rate limit violation
    logger.warning(
        f"Rate limit exceeded for {get_remote_address(request)}",
        extra={
            "extra_fields": {
                "component": "rate_limiter",
                "error_type": "rate_limit_exceeded",
                "client_ip": get_remote_address(request),
                "path": request.url.path,
                "method": request.method,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "status": "error",
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please try again later.",
            "detail": str(exc),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )
