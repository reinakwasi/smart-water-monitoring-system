"""Authentication service for JWT token generation and password hashing"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
from jose import JWTError, jwt
import bcrypt

from app.config import settings


class AuthService:
    """
    Authentication service handling password hashing and JWT operations    """
    
    def __init__(self):
        # JWT configuration
        self.secret_key = settings.jwt_secret_key
        self.algorithm = settings.jwt_algorithm
        self.access_token_expire_minutes = settings.jwt_access_token_expire_minutes
        self.bcrypt_rounds = settings.bcrypt_rounds
    
    def hash_password(self, password: str) -> str:
        """
        Hash a password using bcrypt with configured cost factor        
        Args:
            password: Plain text password
            
        Returns:
            Hashed password string
        """
        # Convert password to bytes
        password_bytes = password.encode('utf-8')
        # Generate salt with configured rounds
        salt = bcrypt.gensalt(rounds=self.bcrypt_rounds)
        # Hash password
        hashed = bcrypt.hashpw(password_bytes, salt)
        # Return as string
        return hashed.decode('utf-8')
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verify a password against its hash
        
        Args:
            plain_password: Plain text password to verify
            hashed_password: Hashed password to compare against
            
        Returns:
            True if password matches, False otherwise
        """
        # Convert to bytes
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        # Verify password
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    
    def create_access_token(
        self,
        data: Dict,
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create a JWT access token with configurable expiration        
        Args:
            data: Dictionary of claims to encode in the token
            expires_delta: Optional custom expiration time
            
        Returns:
            Encoded JWT token string
        """
        to_encode = data.copy()
        
        # Set expiration time
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(
                minutes=self.access_token_expire_minutes
            )
        
        # Add standard JWT claims
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access"
        })
        
        # Encode token
        encoded_jwt = jwt.encode(
            to_encode,
            self.secret_key,
            algorithm=self.algorithm
        )
        
        return encoded_jwt
    
    def decode_token(self, token: str) -> Optional[Dict]:
        """
        Decode and validate a JWT token        
        Args:
            token: JWT token string to decode
            
        Returns:
            Dictionary of token claims if valid, None if invalid
        """
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            return payload
        except JWTError:
            return None
    
    def get_token_expiration_seconds(self) -> int:
        """
        Get the token expiration time in seconds
        
        Returns:
            Token expiration time in seconds
        """
        return self.access_token_expire_minutes * 60


# Global auth service instance
auth_service = AuthService()
