"""Unit tests for rate limiting middleware (no database required)"""

import pytest
from app.config import settings
from app.middleware.rate_limiter import limiter, rate_limit_exceeded_handler, get_rate_limit_key
from slowapi.errors import RateLimitExceeded


class TestRateLimitingConfiguration:
    """Test rate limiting configuration"""
    
    def test_rate_limit_configuration_loaded(self):
        """
        Test that rate limit configuration is loaded correctly        """
        # Verify rate limit setting is loaded
        assert settings.rate_limit_per_minute == 100
        
        # Verify it's a positive integer
        assert isinstance(settings.rate_limit_per_minute, int)
        assert settings.rate_limit_per_minute > 0
    
    def test_limiter_initialization(self):
        """
        Test that rate limiter is properly initialized
        """
        # Verify limiter exists
        assert limiter is not None
        
        # Verify limiter has correct configuration
        assert limiter._key_func == get_rate_limit_key
        assert limiter._storage_uri == "memory://"
        assert limiter._strategy == "fixed-window"
    
    def test_rate_limit_key_function(self):
        """
        Test that rate limit key function extracts IP address correctly
        """
        # Create a mock request object
        class MockClient:
            def __init__(self, host):
                self.host = host
        
        class MockRequest:
            def __init__(self, client_host):
                self.client = MockClient(client_host)
        
        # Test with different IP addresses
        request1 = MockRequest("192.168.1.1")
        key1 = get_rate_limit_key(request1)
        assert key1 == "192.168.1.1"
        
        request2 = MockRequest("10.0.0.1")
        key2 = get_rate_limit_key(request2)
        assert key2 == "10.0.0.1"
        
        # Verify different IPs get different keys
        assert key1 != key2


class TestRateLimitErrorHandler:
    """Test rate limit error handler"""
    
    @pytest.mark.asyncio
    async def test_rate_limit_error_response_format(self):
        """
        Test that rate limit error response has correct format        """
        # Create a mock request
        class MockClient:
            def __init__(self):
                self.host = "192.168.1.1"
        
        class MockURL:
            def __init__(self):
                self.path = "/api/v1/sensor/sensor-data"
        
        class MockRequest:
            def __init__(self):
                self.client = MockClient()
                self.url = MockURL()
                self.method = "POST"
        
        # Create a mock limit object that RateLimitExceeded expects
        class MockLimit:
            def __init__(self):
                self.error_message = "100 per 1 minute"
        
        # Create exception with the mock limit object
        exc = RateLimitExceeded(MockLimit())
        
        # Call the error handler
        request = MockRequest()
        response = await rate_limit_exceeded_handler(request, exc)
        
        # Verify response status code
        assert response.status_code == 429
        
        # Verify response body
        import json
        body = json.loads(response.body.decode())
        
        assert body["status"] == "error"
        assert body["error"] == "rate_limit_exceeded"
        assert "Too many requests" in body["message"]
        assert "timestamp" in body
        assert "detail" in body


class TestSSLConfiguration:
    """Test SSL/TLS configuration"""
    
    def test_ssl_configuration_defaults(self):
        """
        Test that SSL configuration has correct defaults        """
        # Verify SSL settings exist
        assert hasattr(settings, "ssl_enabled")
        assert hasattr(settings, "ssl_certfile")
        assert hasattr(settings, "ssl_keyfile")
        
        # Verify defaults (SSL disabled by default for development)
        assert settings.ssl_enabled == False
        assert settings.ssl_certfile is None
        assert settings.ssl_keyfile is None
    
    def test_ssl_configuration_types(self):
        """
        Test that SSL configuration has correct types
        """
        assert isinstance(settings.ssl_enabled, bool)
        assert settings.ssl_certfile is None or isinstance(settings.ssl_certfile, str)
        assert settings.ssl_keyfile is None or isinstance(settings.ssl_keyfile, str)
