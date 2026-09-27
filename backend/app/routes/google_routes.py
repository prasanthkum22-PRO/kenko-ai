"""
MediBridge AI — Google OAuth Routes
Handles authorization URL generation, OAuth code callback, connection status, and disconnect.
"""

import os
import json
import logging
import urllib.parse
from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import User
from app.models.schemas import (
    GoogleAuthUrlResponse,
    GoogleAuthStatusResponse,
)
from app.utils.auth import get_current_user, require_authenticated_user
from app.services.google_oauth_service import google_oauth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/google", tags=["Google OAuth"])

# Removed import of google_meet_service — Meet creation is not done in OAuth callback.


class GoogleOAuthCallbackBody(BaseModel):
    code: str
    state: Optional[str] = None


@router.get("/auth", response_model=GoogleAuthUrlResponse, summary="Get Google OAuth Authorization URL")
def get_google_auth_url(
    return_url: Optional[str] = Query(None),
    consultation_id: Optional[str] = Query(None),
    appointment_id: Optional[str] = Query(None),
    current_user: User = Depends(require_authenticated_user),
):
    """
    Returns the Google OAuth 2.0 authorization URL.
    Requires authentication: user_id is taken from the JWT, never defaulted.
    """
    res = google_oauth_service.generate_auth_url(
        user_id=current_user.id,
        return_url=return_url,
        consultation_id=consultation_id,
        appointment_id=appointment_id,
    )
    if res.get("error"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE if res["error"] == "GOOGLE_OAUTH_NOT_CONFIGURED" else status.HTTP_400_BAD_REQUEST,
            detail={"error": res["error"], "message": res.get("message")},
        )
    return GoogleAuthUrlResponse(
        auth_url=res["auth_url"],
        state=res["state"],
        is_configured=res["is_configured"],
        message=res.get("message"),
    )


async def _process_oauth_callback(
    code: str,
    state: Optional[str],
    db: Session,
) -> Dict[str, Any]:
    """
    Core OAuth callback handler: ONLY exchanges code for tokens and stores credentials.
    Does NOT create a Google Meet space here.
    Meet creation must be triggered explicitly by doctor via POST /api/meet/create.
    """
    res = await google_oauth_service.exchange_code(code=code, state=state or "", db=db)
    return {
        "success": True,
        "user_id": res.get("user_id"),
        "email": res.get("email", ""),
        "return_url": res.get("return_url"),
        "consultation_id": res.get("consultation_id"),
        "appointment_id": res.get("appointment_id"),
        # No meetingUri — Meet is created only when doctor clicks Create Meeting
    }


@router.get("/callback", summary="Google OAuth 2.0 Callback (GET redirect from Google)")
async def google_oauth_callback_get(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    GET callback endpoint called by Google Accounts redirect.
    Exchanges code, creates Meet space, syncs Firestore, and redirects back to Doctor Consultation page.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    default_redirect = f"{frontend_url}/consultations"

    if error:
        logger.warning(f"[OAuth Callback GET] Google OAuth error received: {error}")
        return RedirectResponse(
            url=f"{default_redirect}?google_auth=error&error_msg={urllib.parse.quote(str(error))}",
            status_code=status.HTTP_302_FOUND,
        )

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google OAuth authorization code in callback.",
        )

    try:
        data = await _process_oauth_callback(code=code, state=state, db=db)
        target_url = data.get("return_url") or default_redirect
        sep = "&" if "?" in target_url else "?"
        redirect_params = [
            "google_auth=success",
            f"email={urllib.parse.quote(data.get('email') or '')}",
        ]
        # Note: no meet_created param — Meet is created only by explicit doctor action
        final_url = f"{target_url}{sep}{'&'.join(redirect_params)}"
        logger.info(f"[OAuth Callback GET] Redirecting to: {final_url}")
        return RedirectResponse(url=final_url, status_code=status.HTTP_302_FOUND)
    except ValueError as exc:
        err_str = str(exc)
        logger.error(f"[OAuth Callback GET] ValueError: {err_str}")
        return RedirectResponse(
            url=f"{default_redirect}?google_auth=failed&error_code={urllib.parse.quote(err_str.split(':')[0])}&error_msg={urllib.parse.quote(err_str)}",
            status_code=status.HTTP_302_FOUND,
        )
    except Exception as exc:
        logger.error(f"[OAuth Callback GET] Unexpected error: {exc}")
        return RedirectResponse(
            url=f"{default_redirect}?google_auth=failed&error_msg={urllib.parse.quote(str(exc))}",
            status_code=status.HTTP_302_FOUND,
        )


@router.post("/callback", summary="Google OAuth 2.0 Callback (POST from frontend SPA)")
async def google_oauth_callback_post(
    body: GoogleOAuthCallbackBody,
    db: Session = Depends(get_db),
):
    """
    POST callback endpoint used by frontend callback component when SPA captures redirect.
    """
    if not body.code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing authorization code.")
    try:
        data = await _process_oauth_callback(code=body.code, state=body.state, db=db)
        return data
    except Exception as exc:
        logger.error(f"[OAuth Callback POST] Processing error: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/status", response_model=GoogleAuthStatusResponse, summary="Check Google OAuth connection status")
def get_google_connection_status(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Checks if the logged-in doctor has connected their Google account. Requires authentication."""
    status_info = google_oauth_service.get_connection_status(user_id=current_user.id, db=db)
    is_conn = bool(status_info.get("is_connected", False))
    doc_email = status_info.get("email")
    return GoogleAuthStatusResponse(
        connected=is_conn,
        is_connected=is_conn,
        googleEmail=doc_email,
        email=doc_email,
        status="CONNECTED" if is_conn else "GOOGLE_NOT_CONNECTED",
        scopes=status_info.get("scopes", []),
        expires_at=status_info.get("expires_at"),
        is_mock=False,
    )


@router.post("/disconnect", summary="Disconnect Google account")
async def disconnect_google_account(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Revokes token and removes stored credentials for the authenticated user."""
    success_result = await google_oauth_service.disconnect(user_id=current_user.id, db=db)
    return {"success": success_result, "message": "Google account disconnected."}
