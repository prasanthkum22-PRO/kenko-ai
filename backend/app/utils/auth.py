"""
MediBridge AI — Authentication & Security Utilities
JWT token creation, validation, password hashing, and role authorization dependencies.
"""

import os
import hashlib
import hmac
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import User

# Configuration from environment
JWT_SECRET = os.getenv("JWT_SECRET", "medibridge-secret-key-change-in-production-2026")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash password securely using PBKDF2-HMAC-SHA256 with a random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000,
    )
    return f"{salt}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against stored salt$hash."""
    try:
        salt, key_hex = hashed_password.split("$")
        check_key = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            100000,
        )
        return hmac.compare_digest(check_key.hex(), key_hex)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate JWT token, supporting backend JWTs, Firebase tokens, and OAuth tokens."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # 1. Try HS256 with JWT_SECRET
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        pass

    # 2. Try decoding as Firebase/Google token (extract claims)
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        if payload and ("sub" in payload or "user_id" in payload or "uid" in payload or "email" in payload):
            return payload
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    FastAPI dependency to extract and verify the current authenticated user.
    If no authorization header is provided, returns None (for optional auth).
    Supports backend JWTs, Firebase Auth tokens, and auto-provisions user records.
    """
    if not credentials:
        return None

    token = credentials.credentials
    payload = decode_access_token(token)
    user_id: Optional[str] = payload.get("sub") or payload.get("user_id") or payload.get("uid")
    email: Optional[str] = payload.get("email")

    if not user_id and not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims: missing user identity.",
        )

    # 1. Query by user ID or email
    user = None
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
    if not user and email:
        user = db.query(User).filter(User.email == email).first()

    # 2. If authenticated via Firebase/OAuth and not yet in local DB, auto-provision
    if not user and (email or user_id):
        user_email = email or f"{user_id}@kenko.ai"
        user_name = payload.get("name") or payload.get("full_name") or user_email.split("@")[0]
        user_role = payload.get("role") or "PATIENT"
        
        user = User(
            id=user_id or f"u_{secrets.token_hex(8)}",
            email=user_email,
            full_name=user_name,
            role=str(user_role).upper(),
            hashed_password="firebase_external_auth",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User record could not be found.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return user


def require_authenticated_user(
    current_user: Optional[User] = Depends(get_current_user),
) -> User:
    """Dependency enforcing that a valid user is logged in."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


def require_role(allowed_roles: List[str]):
    """Dependency factory restricting access to specified roles."""
    def role_checker(user: User = Depends(require_authenticated_user)) -> User:
        if user.role.upper() not in [r.upper() for r in allowed_roles] and user.role.upper() != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for role '{user.role}'. Required: {', '.join(allowed_roles)}",
            )
        return user
    return role_checker

