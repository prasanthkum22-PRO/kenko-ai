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
from app.models.db_models import User, Consultation
from app.models.schemas import (
    GoogleAuthUrlResponse,
    GoogleAuthStatusResponse,
    UpdateGoogleAccountRequest,
)
from app.utils.auth import get_current_user
from app.services.google_oauth_service import google_oauth_service
from app.services.google_meet_service import google_meet_service
from app.services.firebase_service import firebase_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/google", tags=["Google OAuth"])


class GoogleOAuthCallbackBody(BaseModel):
    code: str
    state: Optional[str] = None


@router.get("/auth", response_model=GoogleAuthUrlResponse, summary="Get Google Meet OAuth Authorization URL")
def get_google_auth_url(
    return_url: Optional[str] = Query(None),
    consultation_id: Optional[str] = Query(None),
    appointment_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Returns the Google OAuth 2.0 authorization URL requesting Meet space creation & readonly scopes.
    Preserves consultation_id and appointment_id in state parameter.
    """
    user_id = current_user.id if current_user else "default_doctor"
    res = google_oauth_service.generate_auth_url(
        user_id=user_id,
        return_url=return_url,
        consultation_id=consultation_id,
        appointment_id=appointment_id,
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
    Core handler for OAuth code exchange, Meet space creation, and Firestore synchronization.
    """
    res = await google_oauth_service.exchange_code(code=code, state=state or "", db=db)
    user_id = res.get("user_id", "default_doctor")
    email = res.get("email", "")
    return_url = res.get("return_url")
    consultation_id = res.get("consultation_id")
    appointment_id = res.get("appointment_id")

    meet_uri = None
    meet_code = None
    space_name = None

    # Automatically create Google Meet space if consultation or appointment context exists
    if consultation_id or appointment_id:
        logger.info(
            f"[OAuth Callback] Creating Google Meet space for user={user_id}, "
            f"consultation={consultation_id}, appointment={appointment_id}"
        )
        try:
            meet_res = await google_meet_service.create_space(user_id=user_id, db=db)
            meet_uri = meet_res.get("meetingUri")
            meet_code = meet_res.get("meetingCode")
            space_name = meet_res.get("name")
            logger.info(f"[OAuth Callback] Meet API returned URL={meet_uri}, Code={meet_code}, Space={space_name}")

            # Update SQL Consultation record
            if consultation_id:
                consult = db.query(Consultation).filter(Consultation.id == consultation_id).first()
                if not consult:
                    consult = db.query(Consultation).filter(Consultation.appointment_id == consultation_id).first()
                if not consult:
                    consult = Consultation(
                        id=consultation_id,
                        appointment_id=appointment_id or consultation_id,
                        doctor_id=user_id,
                        patient_id="patient_placeholder",
                        patient_name="Patient",
                        consultation_type="video",
                        meeting_status="meet_ready",
                    )
                    db.add(consult)
                consult.google_space_name = space_name
                consult.google_meeting_uri = meet_uri
                consult.google_meeting_code = meet_code
                consult.meeting_status = "meet_ready"
                consult.consultation_type = "video"
                db.commit()

            # Save to Firestore
            target_appt_id = appointment_id or consultation_id
            await firebase_service.sync_appointment_meet(
                appointment_id=target_appt_id,
                space_name=space_name or "",
                meet_uri=meet_uri or "",
                meet_code=meet_code or "",
                consultation_id=consultation_id,
                doctor_id=user_id,
            )
            logger.info(f"[OAuth Callback] Saved meeting info to Firestore: appt={target_appt_id}, consult={consultation_id}")
        except Exception as meet_err:
            logger.error(f"[OAuth Callback] Meet space creation warning: {meet_err}")

    return {
        "success": True,
        "email": email,
        "return_url": return_url,
        "consultation_id": consultation_id,
        "appointment_id": appointment_id,
        "meetingUri": meet_uri,
        "meetingCode": meet_code,
        "spaceName": space_name,
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
        if data.get("meetingUri"):
            redirect_params.append("meet_created=true")
            redirect_params.append(f"meeting_uri={urllib.parse.quote(data['meetingUri'])}")
        if data.get("meetingCode"):
            redirect_params.append(f"meeting_code={urllib.parse.quote(data['meetingCode'])}")

        final_url = f"{target_url}{sep}{'&'.join(redirect_params)}"
        logger.info(f"[OAuth Callback GET] Final redirect to: {final_url}")
        return RedirectResponse(url=final_url, status_code=status.HTTP_302_FOUND)
    except Exception as exc:
        logger.error(f"[OAuth Callback GET] Processing error: {exc}")
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


@router.post("/account", summary="Update or customize Google Account email for Google Meet")
def update_google_account(
    req: UpdateGoogleAccountRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Allows doctor to edit or customize their Google Account / Google ID specifically for Google Meet."""
    if not req.email or "@" not in req.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid Google email address is required.",
        )
    user_id = current_user.id if current_user else "default_doctor"
    res = google_oauth_service.update_google_email(user_id=user_id, email=req.email, db=db)
    return res


@router.post("/disconnect", summary="Disconnect Google Meet account")
async def disconnect_google_account(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revokes token and removes stored credentials."""
    user_id = current_user.id if current_user else "default_doctor"
    success = await google_oauth_service.disconnect(user_id=user_id, db=db)
    return {"success": success, "message": "Google Meet disconnected successfully."}
