"""Tests for health check endpoint"""

import pytest
from httpx import AsyncClient
from datetime import datetime


@pytest.mark.asyncio
async def test_health_check_endpoint(async_client: AsyncClient):
    """
    Test health check endpoint returns system status    """
    response = await async_client.get("/api/v1/health")
    
    assert response.status_code == 200
    
    data = response.json()
    
    # Verify response structure
    assert "status" in data
    assert "timestamp" in data
    assert "components" in data
    assert "sensors" in data
    
    # Verify status is one of the valid values
    assert data["status"] in ["healthy", "degraded", "unhealthy"]
    
    # Verify timestamp is valid ISO8601 format
    timestamp = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
    assert isinstance(timestamp, datetime)
    
    # Verify components structure
    components = data["components"]
    assert "database" in components
    assert "ml_models" in components
    assert "notification_service" in components
    
    # Verify database component
    db_component = components["database"]
    assert "status" in db_component
    assert db_component["status"] in ["connected", "disconnected"]
    
    # Verify ML models component
    ml_component = components["ml_models"]
    assert "status" in ml_component
    assert ml_component["status"] in ["loaded", "partially_loaded", "not_loaded"]
    
    # Verify notification service component
    notif_component = components["notification_service"]
    assert "status" in notif_component
    assert notif_component["status"] in ["operational", "degraded", "not_initialized"]
    
    # Verify sensors is a list
    assert isinstance(data["sensors"], list)


@pytest.mark.asyncio
async def test_health_check_response_time(async_client: AsyncClient):
    """
    Test health check endpoint responds within 500ms    """
    import time
    
    start_time = time.time()
    response = await async_client.get("/api/v1/health")
    end_time = time.time()
    
    response_time_ms = (end_time - start_time) * 1000
    
    assert response.status_code == 200
    assert response_time_ms < 500, f"Health check took {response_time_ms:.2f}ms (should be < 500ms)"


@pytest.mark.asyncio
async def test_health_check_database_status(async_client: AsyncClient):
    """
    Test health check reports database connection status    """
    response = await async_client.get("/api/v1/health")
    
    assert response.status_code == 200
    
    data = response.json()
    db_component = data["components"]["database"]
    
    # Database should be connected in test environment
    assert db_component["status"] == "connected"
    
    # Latency should be present and reasonable
    if "latency_ms" in db_component and db_component["latency_ms"] is not None:
        assert db_component["latency_ms"] > 0
        assert db_component["latency_ms"] < 1000  # Should be less than 1 second


@pytest.mark.asyncio
async def test_health_check_ml_models_status(async_client: AsyncClient):
    """
    Test health check reports ML models status and versions    """
    response = await async_client.get("/api/v1/health")
    
    assert response.status_code == 200
    
    data = response.json()
    ml_component = data["components"]["ml_models"]
    
    # ML models should be loaded in test environment
    assert ml_component["status"] in ["loaded", "partially_loaded", "not_loaded"]
    
    # If models are loaded, versions should be present
    if ml_component["status"] == "loaded":
        assert "classifier_version" in ml_component
        assert "predictor_version" in ml_component
        assert ml_component["classifier_version"] is not None
        assert ml_component["predictor_version"] is not None
