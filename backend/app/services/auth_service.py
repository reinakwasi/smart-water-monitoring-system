"""Authentication service for JWT token generation and password hashing."""

from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import bcrypt
from jose import JWTError, jwt

from app.config import settings


class AuthService:
    """Handle password hashing and short/long-lived JWT credentials."""

    def __init__(self):
        self.secret_key = settings.jwt_secret_key
        self.algorithm = settings.jwt_algorithm
        self.access_token_expire_minutes = settings.jwt_access_token_expire_minutes
        self.bcrypt_rounds = settings.bcrypt_rounds

    def hash_password(self, password: str) -> str:
        password_bytes = password.encode("utf-8")
        salt = bcrypt.gensalt(rounds=self.bcrypt_rounds)
        return bcrypt.hashpw(password_bytes, salt).decode("utf-8")

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )

    def create_access_token(
        self,
        data: Dict,
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """Create a short-lived token accepted by protected API endpoints."""
        now = datetime.now(timezone.utc)
        expire = now + (
            expires_delta
            if expires_delta is not None
            else timedelta(minutes=self.access_token_expire_minutes)
        )
        payload = {
            **data,
            "exp": expire,
            "iat": now,
            "type": "access",
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def create_refresh_token(self, data: Dict) -> str:
        """Create a long-lived token usable only at the refresh endpoint."""
        now = datetime.now(timezone.utc)
        payload = {
            **data,
            "exp": now + timedelta(days=settings.jwt_refresh_token_expire_days),
            "iat": now,
            "type": "refresh",
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def decode_token(self, token: str) -> Optional[Dict]:
        """Decode and validate a JWT, returning ``None`` when it is invalid."""
        try:
            return jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
        except JWTError:
            return None

    def get_token_expiration_seconds(self) -> int:
        return self.access_token_expire_minutes * 60


auth_service = AuthService()
