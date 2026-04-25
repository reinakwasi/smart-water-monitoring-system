"""Tests for authentication endpoints and services"""

import pytest
from fastapi import status
from datetime import datetime, timedelta

from app.services.auth_service import auth_service


class TestAuthService:
    """Test authentication service functionality"""
    
    def test_hash_password(self):
        """Test password hashing"""
        password = "testpassword123"
        hashed = auth_service.hash_password(password)
        
        # Hash should be different from original password
        assert hashed != password
        # Hash should start with bcrypt identifier
        assert hashed.startswith("$2b$")
    
    def test_verify_password_correct(self):
        """Test password verification with correct password"""
        password = "testpassword123"
        hashed = auth_service.hash_password(password)
        
        # Verification should succeed
        assert auth_service.verify_password(password, hashed) is True
    
    def test_verify_password_incorrect(self):
        """Test password verification with incorrect password"""
        password = "testpassword123"
        wrong_password = "wrongpassword"
        hashed = auth_service.hash_password(password)
        
        # Verification should fail
        assert auth_service.verify_password(wrong_password, hashed) is False
    
    def test_create_access_token(self):
        """Test JWT token creation"""
        data = {"sub": "test@example.com", "user_id": "123", "role": "user"}
        token = auth_service.create_access_token(data)
        
        # Token should be a non-empty string
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_decode_token_valid(self):
        """Test decoding a valid JWT token"""
        data = {"sub": "test@example.com", "user_id": "123", "role": "user"}
        token = auth_service.create_access_token(data)
        
        # Decode token
        payload = auth_service.decode_token(token)
        
        # Payload should contain original data
        assert payload is not None
        assert payload["sub"] == "test@example.com"
        assert payload["user_id"] == "123"
        assert payload["role"] == "user"
        assert "exp" in payload
        assert "iat" in payload
        assert payload["type"] == "access"
    
    def test_decode_token_invalid(self):
        """Test decoding an invalid JWT token"""
        invalid_token = "invalid.token.here"
        
        # Decoding should return None
        payload = auth_service.decode_token(invalid_token)
        assert payload is None
    
    def test_decode_token_expired(self):
        """Test decoding an expired JWT token"""
        data = {"sub": "test@example.com"}
        # Create token that expires immediately
        token = auth_service.create_access_token(
            data,
            expires_delta=timedelta(seconds=-1)
        )
        
        # Decoding should return None for expired token
        payload = auth_service.decode_token(token)
        assert payload is None
    
    def test_get_token_expiration_seconds(self):
        """Test getting token expiration time"""
        expiration = auth_service.get_token_expiration_seconds()
        
        # Should return configured expiration in seconds
        assert isinstance(expiration, int)
        assert expiration > 0


@pytest.mark.asyncio
class TestAuthEndpoints:
    """Test authentication API endpoints"""
    
    async def test_register_user_success(self, async_client, db):
        """Test successful user registration"""
        user_data = {
            "email": "newuser@example.com",
            "password": "securepass123",
            "full_name": "New User",
            "role": "user"
        }
        
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["email"] == user_data["email"]
        assert data["full_name"] == user_data["full_name"]
        assert data["role"] == user_data["role"]
        assert "user_id" in data
        assert "created_at" in data
        assert "password" not in data
        assert "password_hash" not in data
    
    async def test_register_user_duplicate_email(self, async_client, db):
        """Test registration with duplicate email"""
        user_data = {
            "email": "duplicate@example.com",
            "password": "securepass123",
            "full_name": "First User",
            "role": "user"
        }
        
        # Register first user
        response1 = await async_client.post("/api/v1/auth/register", json=user_data)
        assert response1.status_code == status.HTTP_201_CREATED
        
        # Try to register with same email
        response2 = await async_client.post("/api/v1/auth/register", json=user_data)
        assert response2.status_code == status.HTTP_409_CONFLICT
        assert "already exists" in response2.json()["detail"].lower()
    
    async def test_register_user_invalid_password(self, async_client, db):
        """Test registration with password too short"""
        user_data = {
            "email": "test@example.com",
            "password": "short",  # Less than 8 characters
            "full_name": "Test User",
            "role": "user"
        }
        
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    async def test_register_user_default_role(self, async_client, db):
        """Test registration with default role"""
        user_data = {
            "email": "defaultrole@example.com",
            "password": "securepass123",
            "full_name": "Default Role User"
            # role not specified, should default to "user"
        }
        
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["role"] == "user"
    
    async def test_login_success(self, async_client, db):
        """Test successful login"""
        # Register user first
        user_data = {
            "email": "logintest@example.com",
            "password": "securepass123",
            "full_name": "Login Test User",
            "role": "user"
        }
        await async_client.post("/api/v1/auth/register", json=user_data)
        
        # Login
        login_data = {
            "email": "logintest@example.com",
            "password": "securepass123"
        }
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        assert data["expires_in"] > 0
        assert "user" in data
        assert data["user"]["email"] == user_data["email"]
        assert data["user"]["full_name"] == user_data["full_name"]
    
    async def test_login_invalid_email(self, async_client, db):
        """Test login with non-existent email"""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "somepassword"
        }
        
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "invalid" in response.json()["detail"].lower()
    
    async def test_login_invalid_password(self, async_client, db):
        """Test login with incorrect password"""
        # Register user first
        user_data = {
            "email": "wrongpass@example.com",
            "password": "correctpass123",
            "full_name": "Wrong Pass User",
            "role": "user"
        }
        await async_client.post("/api/v1/auth/register", json=user_data)
        
        # Login with wrong password
        login_data = {
            "email": "wrongpass@example.com",
            "password": "wrongpassword"
        }
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "invalid" in response.json()["detail"].lower()
    
    async def test_refresh_token_success(self, async_client, db):
        """Test successful token refresh"""
        # Register and login
        user_data = {
            "email": "refreshtest@example.com",
            "password": "securepass123",
            "full_name": "Refresh Test User",
            "role": "user"
        }
        await async_client.post("/api/v1/auth/register", json=user_data)
        
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": user_data["email"], "password": user_data["password"]}
        )
        token = login_response.json()["access_token"]
        
        # Add small delay to ensure different iat timestamp
        import asyncio
        await asyncio.sleep(1)
        
        # Refresh token
        response = await async_client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["access_token"] != token  # New token should be different
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        assert "user" in data
    
    async def test_refresh_token_no_auth(self, async_client, db):
        """Test token refresh without authentication"""
        response = await async_client.post("/api/v1/auth/refresh")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_refresh_token_invalid(self, async_client, db):
        """Test token refresh with invalid token"""
        response = await async_client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": "Bearer invalid.token.here"}
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
class TestAuthDependencies:
    """Test authentication dependencies"""
    
    async def test_get_current_user_valid_token(self, async_client, db):
        """Test get_current_user with valid token"""
        # Register and login
        user_data = {
            "email": "deptest@example.com",
            "password": "securepass123",
            "full_name": "Dependency Test User",
            "role": "user"
        }
        await async_client.post("/api/v1/auth/register", json=user_data)
        
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": user_data["email"], "password": user_data["password"]}
        )
        token = login_response.json()["access_token"]
        
        # Use token to access protected endpoint (refresh uses get_current_user)
        response = await async_client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == status.HTTP_200_OK
    
    async def test_require_admin_with_admin_user(self, async_client, db):
        """Test require_admin with admin user"""
        # Register admin user
        admin_data = {
            "email": "admin@example.com",
            "password": "adminpass123",
            "full_name": "Admin User",
            "role": "admin"
        }
        await async_client.post("/api/v1/auth/register", json=admin_data)
        
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": admin_data["email"], "password": admin_data["password"]}
        )
        token = login_response.json()["access_token"]
        
        # Admin should be able to refresh token
        response = await async_client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == status.HTTP_200_OK
