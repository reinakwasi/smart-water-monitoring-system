"""FastAPI dependencies for authentication and authorization"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.auth_service import auth_service
from app.db.mongodb import mongodb
from app.models.schemas import UserRole


# HTTP Bearer token security scheme (auto_error=False to handle missing auth manually)
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
) -> dict:
    """
    Dependency to get the current authenticated user from JWT token
    
    Requirements: 17.2, 17.3, 20.4
    
    Args:
        credentials: HTTP Bearer token from Authorization header
        db: MongoDB database instance
        
    Returns:
        User document dictionary
        
    Raises:
        HTTPException: 401 if token is invalid or user not found
    """
    # Check if credentials are provided
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract token from credentials
    token = credentials.credentials
    
    # Decode and validate token
    payload = auth_service.decode_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract user email from token
    email: Optional[str] = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Fetch user from database
    user = await db.users.find_one({"email": email})
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def require_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Dependency to require admin role for protected endpoints
    
    Requirement 20.5: Apply authentication to protected endpoints
    
    Args:
        current_user: Current authenticated user from get_current_user dependency
        
    Returns:
        User document dictionary if user is admin
        
    Raises:
        HTTPException: 403 if user is not an admin
    """
    user_role = current_user.get("role", "user")
    
    if user_role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. Admin role required.",
        )
    
    return current_user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
) -> Optional[dict]:
    """
    Optional authentication dependency that doesn't raise errors
    
    Useful for endpoints that work with or without authentication
    
    Args:
        credentials: Optional HTTP Bearer token
        db: MongoDB database instance
        
    Returns:
        User document if authenticated, None otherwise
    """
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        payload = auth_service.decode_token(token)
        
        if payload is None:
            return None
        
        email = payload.get("sub")
        if email is None:
            return None
        
        user = await db.users.find_one({"email": email})
        return user
    except Exception:
        return None
