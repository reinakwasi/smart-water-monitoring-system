"""Authentication endpoints for user registration and login"""

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from bson import ObjectId

from app.db.mongodb import mongodb
from app.models.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse,
    ErrorResponse
)
from app.services.auth_service import auth_service
from app.dependencies import get_current_user
from app.utils.logger import get_logger


logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {"description": "User successfully registered"},
        400: {"model": ErrorResponse, "description": "Invalid request data"},
        409: {"model": ErrorResponse, "description": "User already exists"}
    }
)
async def register_user(
    user_data: UserRegisterRequest,
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Register a new user account    Creates a new user with hashed password and returns user information.
    Default role is 'user' unless specified otherwise.
    
    Args:
        user_data: User registration data (email, password, full_name, role)
        db: MongoDB database instance
        
    Returns:
        UserResponse with user_id, email, full_name, role, and created_at
        
    Raises:
        HTTPException: 409 if user with email already exists
    """
    logger.info(
        f"User registration attempt for email: {user_data.email}",
        extra={"extra_fields": {"email": user_data.email, "role": user_data.role}}
    )
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        logger.warning(
            f"Registration failed: User already exists with email {user_data.email}"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists"
        )
    
    # Hash password
    password_hash = auth_service.hash_password(user_data.password)
    
    # Create user document
    user_doc = {
        "email": user_data.email,
        "password_hash": password_hash,
        "full_name": user_data.full_name,
        "role": user_data.role.value,
        "fcm_token": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "last_login": None,
        "is_active": True
    }
    
    # Insert user into database
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    logger.info(
        f"User registered successfully: {user_data.email}",
        extra={"extra_fields": {"user_id": user_id, "role": user_data.role}}
    )
    
    # Return user response
    return UserResponse(
        user_id=user_id,
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        created_at=user_doc["created_at"]
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        200: {"description": "Login successful, JWT token returned"},
        401: {"model": ErrorResponse, "description": "Invalid credentials"}
    }
)
async def login_user(
    login_data: UserLoginRequest,
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Authenticate user and issue JWT token    Validates user credentials and returns a JWT access token with user information.
    Token expires after the configured duration (default 60 minutes).
    
    Args:
        login_data: User login credentials (email, password)
        db: MongoDB database instance
        
    Returns:
        TokenResponse with access_token, token_type, expires_in, and user info
        
    Raises:
        HTTPException: 401 if credentials are invalid
    """
    logger.info(
        f"Login attempt for email: {login_data.email}",
        extra={"extra_fields": {"email": login_data.email}}
    )
    
    # Find user by email
    user = await db.users.find_one({"email": login_data.email})
    
    if user is None:
        logger.warning(f"Login failed: User not found with email {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not auth_service.verify_password(login_data.password, user["password_hash"]):
        logger.warning(f"Login failed: Invalid password for email {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.get("is_active", True):
        logger.warning(f"Login failed: Inactive account for email {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last login timestamp
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
    # Create JWT token
    token_data = {
        "sub": user["email"],
        "user_id": str(user["_id"]),
        "role": user["role"]
    }
    access_token = auth_service.create_access_token(token_data)
    
    logger.info(
        f"Login successful for email: {login_data.email}",
        extra={"extra_fields": {"user_id": str(user["_id"]), "role": user["role"]}}
    )
    
    # Return token response
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=auth_service.get_token_expiration_seconds(),
        user=UserResponse(
            user_id=str(user["_id"]),
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            created_at=user["created_at"]
        )
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={
        200: {"description": "Token refreshed successfully"},
        401: {"model": ErrorResponse, "description": "Invalid or expired token"}
    }
)
async def refresh_token(
    current_user: dict = Depends(get_current_user)
):
    """
    Refresh JWT token    Issues a new JWT token for an authenticated user. The old token must be valid.
    This allows users to extend their session without re-entering credentials.
    
    Args:
        current_user: Current authenticated user from JWT token
        
    Returns:
        TokenResponse with new access_token, token_type, and expires_in
    """
    logger.info(
        f"Token refresh for user: {current_user['email']}",
        extra={"extra_fields": {"user_id": str(current_user["_id"])}}
    )
    
    # Create new JWT token
    token_data = {
        "sub": current_user["email"],
        "user_id": str(current_user["_id"]),
        "role": current_user["role"]
    }
    access_token = auth_service.create_access_token(token_data)
    
    logger.info(
        f"Token refreshed successfully for user: {current_user['email']}",
        extra={"extra_fields": {"user_id": str(current_user["_id"])}}
    )
    
    # Return new token
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=auth_service.get_token_expiration_seconds(),
        user=UserResponse(
            user_id=str(current_user["_id"]),
            email=current_user["email"],
            full_name=current_user["full_name"],
            role=current_user["role"],
            created_at=current_user["created_at"]
        )
    )
