"""Tests for global error handling middleware"""

import pytest
from httpx import AsyncClient
from datetime import datetime


@pytest.mark.asyncio
async def test_validation_error_handling(async_client: AsyncClient):
    """
    Test validation errors return 422 with descriptive message    """
    # Send invalid request to auth endpoint (missing required fields)
    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            # Missing required fields: password, full_name
        }
    )
    
    assert response.status_code == 422
    
    data = response.json()
    
    # Verify error response structure
    assert data["status"] == "error"
    assert data["error"] == "validation_error"
    assert "message" in data
    assert "detail" in data  # Changed from "details" to "detail"
    assert "timestamp" in data
    
    # Verify detail contain field-level errors
    assert isinstance(data["detail"], list)
    assert len(data["detail"]) > 0
    
    # Each error should have field, message, and type
    for error in data["detail"]:
        assert "field" in error
        assert "message" in error
        assert "type" in error


@pytest.mark.asyncio
async def test_validation_error_invalid_types(async_client: AsyncClient):
    """
    Test validation errors for invalid data types    """
    # Send auth request with invalid data type (password as number instead of string)
    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": 12345,  # Should be string
            "full_name": "Test User"
        }
    )
    
    assert response.status_code == 422
    
    data = response.json()
    assert data["status"] == "error"
    assert data["error"] == "validation_error"
    assert "detail" in data


@pytest.mark.asyncio
async def test_authentication_error_handling(async_client: AsyncClient):
    """
    Test authentication errors return 401    """
    # Try to access protected endpoint without authentication
    response = await async_client.get("/api/v1/status/current-status")
    
    assert response.status_code == 401
    
    data = response.json()
    
    # Verify error response structure
    assert data["status"] == "error"
    assert data["error"] == "unauthorized"
    assert "message" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_authentication_error_invalid_token(async_client: AsyncClient):
    """
    Test authentication errors with invalid token return 401    """
    # Try to access protected endpoint with invalid token
    response = await async_client.get(
        "/api/v1/status/current-status",
        headers={"Authorization": "Bearer invalid_token_12345"}
    )
    
    assert response.status_code == 401
    
    data = response.json()
    assert data["status"] == "error"
    assert data["error"] == "unauthorized"


@pytest.mark.asyncio
async def test_authorization_error_handling(async_client: AsyncClient, test_user: dict):
    """
    Test authorization errors return 403    """
    from app.services.auth_service import auth_service
    
    # Create a valid token for a regular user
    user_token = auth_service.create_access_token({"sub": test_user["email"], "role": test_user["role"]})
    
    # Try to access admin-only endpoint with regular user token
    response = await async_client.get(
        "/api/v1/config",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    
    assert response.status_code == 403
    
    data = response.json()
    
    # Verify error response structure
    assert data["status"] == "error"
    assert data["error"] == "forbidden"
    assert "message" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_not_found_error_handling(async_client: AsyncClient):
    """
    Test 404 errors are handled properly    """
    # Try to access non-existent endpoint
    response = await async_client.get("/api/v1/nonexistent-endpoint")
    
    assert response.status_code == 404
    
    data = response.json()
    
    # Verify error response structure
    assert data["status"] == "error"
    assert data["error"] == "not_found"
    assert "message" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_error_response_timestamp_format(async_client: AsyncClient):
    """
    Test error responses include valid ISO8601 timestamp    """
    # Trigger a validation error
    response = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com"}  # Missing required fields
    )
    
    assert response.status_code == 422
    
    data = response.json()
    
    # Verify timestamp is valid ISO8601 format
    assert "timestamp" in data
    timestamp = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
    assert isinstance(timestamp, datetime)


@pytest.mark.asyncio
async def test_error_response_consistency(async_client: AsyncClient):
    """
    Test all error responses follow consistent format
    
    Requirement 16.7, 16.8: Consistent error handling and logging
    """
    # Test multiple error scenarios
    error_scenarios = [
        # Validation error
        {
            "method": "post",
            "url": "/api/v1/auth/register",
            "json": {"email": "test@example.com"},
            "expected_status": 422
        },
        # Authentication error
        {
            "method": "get",
            "url": "/api/v1/status/current-status",
            "expected_status": 401
        },
        # Not found error
        {
            "method": "get",
            "url": "/api/v1/nonexistent",
            "expected_status": 404
        }
    ]
    
    for scenario in error_scenarios:
        if scenario["method"] == "get":
            response = await async_client.get(scenario["url"])
        elif scenario["method"] == "post":
            response = await async_client.post(scenario["url"], json=scenario.get("json", {}))
        
        assert response.status_code == scenario["expected_status"]
        
        data = response.json()
        
        # All error responses should have consistent structure
        assert "status" in data
        assert data["status"] == "error"
        assert "error" in data
        assert "message" in data
        assert "timestamp" in data
        
        # Timestamp should be valid
        timestamp = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
        assert isinstance(timestamp, datetime)

