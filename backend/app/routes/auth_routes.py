"""
MediBridge AI — Authentication Routes
Endpoints for registering, logging in, and retrieving current user profile.
"""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import User
from app.models.schemas import UserRegisterRequest, UserLoginRequest, UserOut, TokenResponse
from app.utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    require_authenticated_user,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, summary="Register a new user")
def register_user(req: UserRegisterRequest, db: Session = Depends(get_db)):
    # Check if user already exists
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Normalize role
    role = req.role.upper()
    valid_roles = ["PATIENT", "DOCTOR", "ADMIN", "NURSE", "LAB"]
    if role not in valid_roles:
        role = "PATIENT"

    user = User(
        email=req.email.lower().strip(),
        hashed_password=hash_password(req.password),
        full_name=req.full_name.strip(),
        role=role,
        patient_id=req.patient_id or (f"P-{user_id_short()}" if role == "PATIENT" else None),
        doctor_id=req.doctor_id or (f"D-{user_id_short()}" if role == "DOCTOR" else None),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role, "name": user.full_name}
    )

    user_out = UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        patient_id=user.patient_id,
        doctor_id=user.doctor_id,
        created_at=user.created_at,
    )

    return TokenResponse(access_token=token, token_type="bearer", user=user_out)


@router.post("/login", response_model=TokenResponse, summary="Authenticate and obtain JWT token")
def login_user(req: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role, "name": user.full_name}
    )

    user_out = UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        patient_id=user.patient_id,
        doctor_id=user.doctor_id,
        created_at=user.created_at,
    )

    return TokenResponse(access_token=token, token_type="bearer", user=user_out)


@router.get("/me", response_model=UserOut, summary="Get current authenticated user profile")
def get_current_user_profile(user: User = Depends(require_authenticated_user)):
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        patient_id=user.patient_id,
        doctor_id=user.doctor_id,
        created_at=user.created_at,
    )


def user_id_short():
    import random
    return str(random.randint(1000, 9999))
