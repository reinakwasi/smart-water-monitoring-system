"""API-key generation and verification for ESP32 devices."""

import base64
import secrets

import bcrypt


class DeviceAuthService:
    """Create and verify high-entropy device credentials."""

    bcrypt_rounds = 12

    @staticmethod
    def generate_api_key() -> str:
        """Return a URL-safe API key backed by 256 random bits."""
        return base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode("ascii")

    @classmethod
    def hash_api_key(cls, api_key: str) -> str:
        """Hash an API key with bcrypt; plaintext keys are never persisted."""
        return bcrypt.hashpw(
            api_key.encode("utf-8"),
            bcrypt.gensalt(rounds=cls.bcrypt_rounds),
        ).decode("utf-8")

    @staticmethod
    def verify_api_key(api_key: str, api_key_hash: str) -> bool:
        """Safely compare a plaintext API key with a bcrypt hash."""
        try:
            return bcrypt.checkpw(api_key.encode("utf-8"), api_key_hash.encode("utf-8"))
        except (TypeError, ValueError):
            return False


device_auth_service = DeviceAuthService()
