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
from app.services.email_service import email_service
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
    
    # Create user document with is_verified=False
    user_doc = {
        "email": user_data.email,
        "password_hash": password_hash,
        "full_name": user_data.full_name,
        "role": user_data.role.value,
        "fcm_token": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "last_login": None,
        "is_active": False,
        "is_verified": False
    }
    
    # Insert user into database
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Generate and send OTP
    otp = email_service.generate_otp()
    email_service.store_otp(user_data.email, otp)
    
    # Send OTP email
    email_sent = email_service.send_otp_email(user_data.email, otp)
    
    if not email_sent:
        logger.error(f"Failed to send OTP email to {user_data.email}")
        # Delete the user if email fails
        await db.users.delete_one({"_id": result.inserted_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please try again."
        )
    
    logger.info(
        f"User registered successfully (pending verification): {user_data.email}",
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
    
    # Check if user is active and verified
    if not user.get("is_active", False):
        logger.warning(f"Login failed: Inactive account for email {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please verify your email before signing in",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.get("is_verified", False):
        logger.warning(f"Login failed: Unverified account for email {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please verify your email before signing in",
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


@router.post(
    "/verify-otp",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "OTP verified successfully"},
        400: {"model": ErrorResponse, "description": "Invalid or expired OTP"}
    }
)
async def verify_otp(
    email: str,
    otp: str,
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Verify OTP code and activate user account
    
    Args:
        email: User's email address
        otp: 6-digit OTP code
        db: MongoDB database instance
        
    Returns:
        Success message
        
    Raises:
        HTTPException: 400 if OTP is invalid or expired
    """
    logger.info(f"OTP verification attempt for email: {email}")
    
    # Verify OTP
    if not email_service.verify_otp(email, otp):
        logger.warning(f"OTP verification failed for {email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code"
        )
    
    # Update user as verified and activate account
    result = await db.users.update_one(
        {"email": email},
        {"$set": {
            "is_verified": True, 
            "is_active": True,
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        logger.warning(f"User not found for email: {email}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get user details
    user = await db.users.find_one({"email": email})
    
    # Send welcome email
    email_service.send_welcome_email(email, user["full_name"])
    
    logger.info(f"OTP verified successfully for {email}")
    
    return {"message": "Email verified successfully", "email": email}


@router.post(
    "/resend-otp",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "OTP resent successfully"},
        404: {"model": ErrorResponse, "description": "User not found"}
    }
)
async def resend_otp(
    email: str,
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Resend OTP code to user's email
    
    Args:
        email: User's email address
        db: MongoDB database instance
        
    Returns:
        Success message
        
    Raises:
        HTTPException: 404 if user not found
    """
    logger.info(f"OTP resend request for email: {email}")
    
    # Check if user exists
    user = await db.users.find_one({"email": email})
    if not user:
        logger.warning(f"User not found for email: {email}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Generate and send new OTP
    otp = email_service.generate_otp()
    email_service.store_otp(email, otp)
    
    # Send OTP email
    email_sent = email_service.send_otp_email(email, otp)
    
    if not email_sent:
        logger.error(f"Failed to send OTP email to {email}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP email"
        )
    
    logger.info(f"OTP resent successfully to {email}")
    
    return {"message": "OTP sent successfully", "email": email}


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Password reset link sent successfully"},
        404: {"model": ErrorResponse, "description": "User not found"}
    }
)
async def forgot_password(
    email: str,
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Send password reset link to user's email
    
    Args:
        email: User's email address
        db: MongoDB database instance
        
    Returns:
        Success message
        
    Raises:
        HTTPException: 404 if user not found
    """
    logger.info(f"Password reset request for email: {email}")
    
    # Check if user exists
    user = await db.users.find_one({"email": email})
    if not user:
        logger.warning(f"User not found for email: {email}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Generate password reset token (OTP)
    reset_token = email_service.generate_otp()
    email_service.store_otp(email, reset_token)
    
    # Send password reset email
    email_sent = email_service.send_password_reset_email(email, user["full_name"], reset_token)
    
    if not email_sent:
        logger.error(f"Failed to send password reset email to {email}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send password reset email"
        )
    
    logger.info(f"Password reset email sent successfully to {email}")
    
    return {"message": "Password reset link sent successfully", "email": email}


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Password reset successfully"},
        400: {"model": ErrorResponse, "description": "Invalid or expired token"}
    }
)
async def reset_password(
    email: str,
    token: str,
    new_password: str,
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Reset user password with token
    
    Args:
        email: User's email address
        token: Password reset token (OTP)
        new_password: New password
        db: MongoDB database instance
        
    Returns:
        Success message
        
    Raises:
        HTTPException: 400 if token is invalid or expired or new password same as current
    """
    logger.info(f"Password reset attempt for email: {email}")
    
    # Verify token
    if not email_service.verify_otp(email, token):
        logger.warning(f"Invalid or expired reset token for {email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Get user to check current password
    user = await db.users.find_one({"email": email})
    if not user:
        logger.warning(f"User not found for email: {email}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if new password is same as current password
    if auth_service.verify_password(new_password, user["password_hash"]):
        logger.warning(f"Password reset failed: New password same as current for {email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be the same as your current password"
        )
    
    # Hash new password
    password_hash = auth_service.hash_password(new_password)
    
    # Update password
    result = await db.users.update_one(
        {"email": email},
        {"$set": {
            "password_hash": password_hash,
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        logger.warning(f"Failed to update password for email: {email}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password"
        )
    
    logger.info(f"Password reset successfully for {email}")
    
    return {"message": "Password reset successfully", "email": email}



@router.get(
    "/profile",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "User profile retrieved successfully"},
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        404: {"model": ErrorResponse, "description": "User not found"}
    }
)
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Get current user profile
    
    Returns the authenticated user's profile information including
    phone, location, and profile picture.
    
    Args:
        current_user: Authenticated user from JWT token
        db: MongoDB database instance
        
    Returns:
        UserResponse with complete user profile
    """
    try:
        user = await db.users.find_one({"email": current_user.get("email")})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserResponse(
            user_id=str(user["_id"]),
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            phone=user.get("phone"),
            location=user.get("location"),
            profile_picture=user.get("profile_picture"),
            created_at=user["created_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve profile"
        )


@router.put(
    "/profile",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Profile updated successfully"},
        400: {"model": ErrorResponse, "description": "Invalid request data"},
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        404: {"model": ErrorResponse, "description": "User not found"}
    }
)
async def update_profile(
    profile_data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(mongodb.get_database)
):
    """
    Update current user profile
    
    Updates the authenticated user's profile information.
    Only provided fields will be updated.
    
    Args:
        profile_data: Profile update data (full_name, phone, location, profile_picture)
        current_user: Authenticated user from JWT token
        db: MongoDB database instance
        
    Returns:
        UserResponse with updated user profile
    """
    try:
        update_data = {}
        
        if "full_name" in profile_data and profile_data["full_name"]:
            update_data["full_name"] = profile_data["full_name"]
        
        if "phone" in profile_data:
            update_data["phone"] = profile_data["phone"]
        
        if "location" in profile_data:
            update_data["location"] = profile_data["location"]
        
        if "profile_picture" in profile_data:
            update_data["profile_picture"] = profile_data["profile_picture"]
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields to update"
            )
        
        update_data["updated_at"] = datetime.utcnow()
        
        result = await db.users.update_one(
            {"email": current_user.get("email")},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user = await db.users.find_one({"email": current_user.get("email")})
        
        return UserResponse(
            user_id=str(user["_id"]),
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            phone=user.get("phone"),
            location=user.get("location"),
            profile_picture=user.get("profile_picture"),
            created_at=user["created_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )
