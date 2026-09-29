"""
MediBridge AI / KENKO-AI — Google OAuth Routes
Handles authorization URL generation, OAuth code callback, connection status, and disconnect.
Provides endpoints under both /api/google and /api/auth/google for frontend compatibility.
"""

import os
import json
import logging
import urllib.parse
from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse, JSONResponse
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
auth_google_router = APIRouter(prefix="/api/auth/google", tags=["Google OAuth (Auth Alias)"])


class GoogleOAuthCallbackBody(BaseModel):
    code: str
    state: Optional[str] = None


def _build_auth_url_handler(
    return_url: Optional[str],
    consultation_id: Optional[str],
    appointment_id: Optional[str],
    user_id: Optional[str] = None,
    current_user: Optional[User] = None,
) -> GoogleAuthUrlResponse:
    """Core logic to generate Google OAuth 2.0 authorization URL."""
    uid = (current_user.id if current_user else None) or user_id or "doctor_user"
    res = google_oauth_service.generate_auth_url(
        user_id=uid,
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
    """Core OAuth callback handler: exchanges code for tokens and stores credentials securely."""
    res = await google_oauth_service.exchange_code(code=code, state=state or "", db=db)
    return {
        "success": True,
        "user_id": res.get("user_id"),
        "email": res.get("email", ""),
        "return_url": res.get("return_url"),
        "consultation_id": res.get("consultation_id"),
        "appointment_id": res.get("appointment_id"),
    }


async def _handle_callback_get(
    code: Optional[str],
    state: Optional[str],
    error: Optional[str],
    db: Session,
) -> RedirectResponse:
    """GET callback endpoint called by Google Accounts browser redirect."""
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
            detail={"error": "INVALID_CALLBACK", "message": "Missing Google OAuth authorization code in callback."},
        )

    try:
        data = await _process_oauth_callback(code=code, state=state, db=db)
        target_url = data.get("return_url") or default_redirect
        sep = "&" if "?" in target_url else "?"
        redirect_params = [
            "google_auth=success",
            f"email={urllib.parse.quote(data.get('email') or '')}",
        ]
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


def _handle_connection_status(
    current_user: Optional[User],
    db: Session,
) -> GoogleAuthStatusResponse:
    """Checks if the doctor has connected their Google account."""
    if not current_user:
        return GoogleAuthStatusResponse(
            connected=False,
            is_connected=False,
            googleEmail=None,
            email=None,
            status="GOOGLE_NOT_CONNECTED",
            scopes=[],
            expires_at=None,
            is_mock=False,
        )
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


# ─── Primary Routes: /api/google/* ──────────────────────────────────────────

@router.get("/auth", response_model=GoogleAuthUrlResponse, summary="Get Google OAuth Authorization URL")
@router.get("/authorize", response_model=GoogleAuthUrlResponse, summary="Get Google OAuth Authorization URL (alias)")
def get_google_auth_url(
    return_url: Optional[str] = Query(None),
    consultation_id: Optional[str] = Query(None),
    appointment_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
):
    return _build_auth_url_handler(return_url, consultation_id, appointment_id, user_id, current_user)


@router.get("/login", summary="Direct browser redirect to Google OAuth consent screen")
def direct_google_login(
    return_url: Optional[str] = Query(None),
    consultation_id: Optional[str] = Query(None),
    appointment_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
):
    uid = (current_user.id if current_user else None) or user_id or "doctor_user"
    res = google_oauth_service.generate_auth_url(
        user_id=uid,
        return_url=return_url,
        consultation_id=consultation_id,
        appointment_id=appointment_id,
    )
    if res.get("auth_url"):
        return RedirectResponse(url=res["auth_url"], status_code=status.HTTP_302_FOUND)
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"error": "GOOGLE_OAUTH_NOT_CONFIGURED", "message": "Google OAuth is not configured on the backend."},
    )


@router.get("/callback", summary="Google OAuth 2.0 Callback (GET redirect from Google)")
async def google_oauth_callback_get(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return await _handle_callback_get(code, state, error, db)


@router.post("/callback", summary="Google OAuth 2.0 Callback (POST from frontend SPA)")
async def google_oauth_callback_post(
    body: GoogleOAuthCallbackBody,
    db: Session = Depends(get_db),
):
    if not body.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "INVALID_CALLBACK", "message": "Missing authorization code."},
        )
    try:
        data = await _process_oauth_callback(code=body.code, state=body.state, db=db)
        return data
    except Exception as exc:
        logger.error(f"[OAuth Callback POST] Processing error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "OAUTH_EXCHANGE_FAILED", "message": str(exc)},
        )


@router.get("/status", response_model=GoogleAuthStatusResponse, summary="Check Google OAuth connection status")
def get_google_connection_status(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _handle_connection_status(current_user, db)


@router.post("/disconnect", summary="Disconnect Google account")
async def disconnect_google_account(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    success_result = await google_oauth_service.disconnect(user_id=current_user.id, db=db)
    return {"success": success_result, "message": "Google account disconnected."}


# ─── Alias Routes: /api/auth/google/* ───────────────────────────────────────

@auth_google_router.get("", response_model=GoogleAuthUrlResponse, summary="Get Google OAuth Authorization URL (auth alias)")
@auth_google_router.get("/auth", response_model=GoogleAuthUrlResponse, summary="Get Google OAuth Authorization URL (auth alias)")
def get_auth_google_url(
    return_url: Optional[str] = Query(None),
    consultation_id: Optional[str] = Query(None),
    appointment_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
):
    return _build_auth_url_handler(return_url, consultation_id, appointment_id, user_id, current_user)


@auth_google_router.get("/login", summary="Direct browser redirect to Google OAuth (auth alias)")
def direct_auth_google_login(
    return_url: Optional[str] = Query(None),
    consultation_id: Optional[str] = Query(None),
    appointment_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
):
    return direct_google_login(return_url, consultation_id, appointment_id, user_id, current_user)


@auth_google_router.get("/callback", summary="Google OAuth Callback (auth alias GET)")
async def auth_google_callback_get(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return await _handle_callback_get(code, state, error, db)


@auth_google_router.post("/callback", summary="Google OAuth Callback (auth alias POST)")
async def auth_google_callback_post(
    body: GoogleOAuthCallbackBody,
    db: Session = Depends(get_db),
):
    return await google_oauth_callback_post(body, db)


@auth_google_router.get("/status", response_model=GoogleAuthStatusResponse, summary="Check Google OAuth status (auth alias)")
def auth_google_connection_status(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _handle_connection_status(current_user, db)


@auth_google_router.post("/disconnect", summary="Disconnect Google account (auth alias)")
async def auth_google_disconnect(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    return await disconnect_google_account(current_user, db)
