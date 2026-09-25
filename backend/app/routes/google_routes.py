"""
MediBridge AI — Google OAuth Routes
Handles authorization URL generation, OAuth code callback, connection status, and disconnect.
"""

import os
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import User
from app.models.schemas import GoogleAuthUrlResponse, GoogleAuthStatusResponse
from app.utils.auth import get_current_user, require_authenticated_user
from app.services.google_oauth_service import google_oauth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/google", tags=["Google OAuth"])


@router.get("/auth", response_model=GoogleAuthUrlResponse, summary="Get Google Meet OAuth Authorization URL")
def get_google_auth_url(
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Returns the Google OAuth 2.0 authorization URL requesting Meet space creation & readonly scopes.
    """
    user_id = current_user.id if current_user else "default_doctor"
    res = google_oauth_service.generate_auth_url(user_id=user_id)
    return GoogleAuthUrlResponse(
        auth_url=res["auth_url"],
        state=res["state"],
        is_configured=res["is_configured"],
        message=res.get("message"),
    )


@router.get("/callback", summary="Google OAuth 2.0 Callback Handler")
async def google_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Receives authorization code from Google, exchanges it for tokens,
    and saves them securely server-side. Redirects user back to frontend consultations page.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    if error:
        logger.warning(f"Google OAuth denied or returned error: {error}")
        return RedirectResponse(
            url=f"{frontend_url}/consultations?google_auth=error&error_msg={error}",
            status_code=status.HTTP_302_FOUND,
        )

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google OAuth authorization code in callback.",
        )

    try:
        res = await google_oauth_service.exchange_code(code=code, state=state or "", db=db)
        return RedirectResponse(
            url=f"{frontend_url}/consultations?google_auth=success&email={res.get('email', '')}",
            status_code=status.HTTP_302_FOUND,
        )
    except Exception as exc:
        logger.error(f"Google OAuth exchange error: {exc}")
        return RedirectResponse(
            url=f"{frontend_url}/consultations?google_auth=failed&error_msg=TokenExchangeError",
            status_code=status.HTTP_302_FOUND,
        )


@router.get("/status", response_model=GoogleAuthStatusResponse, summary="Check Google Meet connection status")
def get_google_connection_status(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Checks if the logged-in doctor/user has connected their Google Meet account."""
    user_id = current_user.id if current_user else "default_doctor"
    status_info = google_oauth_service.get_connection_status(user_id=user_id, db=db)
    return GoogleAuthStatusResponse(
        is_connected=status_info["is_connected"],
        email=status_info.get("email"),
        scopes=status_info.get("scopes", []),
        expires_at=status_info.get("expires_at"),
        is_mock=status_info.get("is_mock", False),
    )


@router.post("/disconnect", summary="Disconnect Google Meet account")
async def disconnect_google_account(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revokes token and removes stored credentials."""
    user_id = current_user.id if current_user else "default_doctor"
    success = await google_oauth_service.disconnect(user_id=user_id, db=db)
    return {"success": success, "message": "Google Meet disconnected successfully."}

