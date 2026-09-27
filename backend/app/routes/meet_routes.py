"""
MediBridge AI — Google Meet API Routes
Endpoints for creating Google Meet spaces, tracking meeting status,
fetching conference artifacts, and syncing transcripts.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import Consultation, User, AuditLog, TranscriptSegment, Appointment
from app.models.schemas import (
    CreateGoogleMeetRequest,
    CreateGoogleMeetResponse,
    GoogleMeetStatusResponse,
    NormalizedTranscriptResponse,
)
from app.utils.auth import get_current_user
from app.services.google_meet_service import google_meet_service
from app.services.transcript_service import transcript_service
from app.services.firebase_service import firebase_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/meet", tags=["Google Meet"])


def format_error_response(
    code: str,
    message: str,
    operation: str = "spaces.create",
    request_id: Optional[str] = None,
    retryable: bool = False,
    status_code: int = 400,
) -> JSONResponse:
    req_id = request_id or f"req_{uuid.uuid4().hex[:10]}"
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "service": "google_meet",
                "operation": operation,
                "requestId": req_id,
                "retryable": retryable,
            },
        },
    )


@router.post("/create", response_model=CreateGoogleMeetResponse, summary="Create a new Google Meet space for consultation")
async def create_google_meet(
    req: CreateGoogleMeetRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new Google Meet space using Google Meet REST API v2.
    Idempotent: if google_meeting_uri is already set, returns the existing one.
    Authorization: doctor assigned to the consultation, or admin.
    """
    request_id = f"req_{uuid.uuid4().hex[:10]}"
    consultation_id = req.consultationId or req.consultation_id
    if not consultation_id:
        return format_error_response(
            code="INVALID_REQUEST",
            message="consultationId is required.",
            request_id=request_id,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        return format_error_response(
            code="CONSULTATION_NOT_FOUND",
            message=f"Consultation '{consultation_id}' not found.",
            request_id=request_id,
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Authorization: only the assigned doctor or admin
    if current_user:
        uid = current_user.id
        role = (current_user.role or "").upper()
        if role == "PATIENT":
            return format_error_response(
                code="UNAUTHORIZED_ROLE",
                message="Only the assigned doctor can create a Google Meet space.",
                request_id=request_id,
                status_code=status.HTTP_403_FORBIDDEN,
            )
        doctor_ids = {uid}
        if getattr(current_user, "doctor_id", None):
            doctor_ids.add(current_user.doctor_id)

        if role in ("DOCTOR", "DOCTOR_PENDING") and consultation.doctor_id and consultation.doctor_id not in doctor_ids:
            return format_error_response(
                code="DOCTOR_MISMATCH",
                message="You are not the assigned doctor for this consultation.",
                request_id=request_id,
                status_code=status.HTTP_403_FORBIDDEN,
            )
        if not consultation.doctor_id:
            consultation.doctor_id = current_user.doctor_id or uid

    user_id = current_user.id if current_user else "default_doctor"

    # ── Idempotency: return existing meeting if already created ──────────────
    if consultation.google_meeting_uri and consultation.meeting_status not in (
        "scheduled", "SCHEDULED", "meet_creation_failed", "MEET_CREATION_FAILED", ""
    ):
        logger.info(
            f"[GoogleMeet] requestId={request_id} consultationId={consultation_id} "
            f"Existing meeting found: {consultation.google_meeting_uri}. Returning existing."
        )
        try:
            await firebase_service.sync_appointment_meet(
                appointment_id=consultation.appointment_id or consultation_id,
                space_name=consultation.google_space_name or "",
                meet_uri=consultation.google_meeting_uri,
                meet_code=consultation.google_meeting_code or "",
                consultation_id=consultation_id,
            )
        except Exception as fe:
            logger.debug(f"Firestore meet create idempotency sync note: {fe}")

        return CreateGoogleMeetResponse(
            success=True,
            consultationId=consultation.id,
            spaceName=consultation.google_space_name,
            meetingUri=consultation.google_meeting_uri,
            meetingCode=consultation.google_meeting_code,
            meetStatus="READY",
            message="Google Meet Space already exists. Returning existing meeting.",
        )

    # Mark as creating
    consultation.meeting_status = "meet_creating"
    consultation.updated_at = datetime.now(timezone.utc)
    db.commit()

    try:
        space_data = await google_meet_service.create_space(
            user_id=user_id,
            db=db,
            request_id=request_id,
            consultation_id=consultation_id,
        )

        space_name = space_data.get("name")
        meeting_uri = space_data.get("meetingUri")
        meeting_code = space_data.get("meetingCode")

        consultation.google_space_name = space_name
        consultation.google_meeting_uri = meeting_uri
        consultation.google_meeting_code = meeting_code
        consultation.google_oauth_user_id = user_id
        consultation.meeting_status = "meet_ready"
        consultation.consultation_type = "video"
        consultation.updated_at = datetime.now(timezone.utc)

        target_appt_id = consultation.appointment_id or consultation_id
        appt = db.query(Appointment).filter(Appointment.id == target_appt_id).first()
        if appt:
            appt.google_space_name = space_name
            appt.google_meeting_uri = meeting_uri
            appt.google_meeting_code = meeting_code
            appt.meet_status = "READY"
            appt.status = "CONFIRMED"
            appt.updated_at = datetime.now(timezone.utc)

        db.commit()

        try:
            await firebase_service.sync_appointment_meet(
                appointment_id=target_appt_id,
                space_name=space_name or "",
                meet_uri=meeting_uri,
                meet_code=meeting_code or "",
                consultation_id=consultation_id,
                doctor_id=user_id,
            )
        except Exception as fe:
            logger.error(f"[GoogleMeet] requestId={request_id} error=FIREBASE_SYNC_FAILED detail={fe}")

        audit = AuditLog(
            user_id=user_id,
            user_role="doctor",
            action="created_google_meet",
            resource_type="google_meet_space",
            resource_id=space_name or consultation_id,
            details={"consultation_id": consultation_id},
        )
        db.add(audit)
        db.commit()

        return CreateGoogleMeetResponse(
            success=True,
            consultationId=consultation.id,
            appointmentId=target_appt_id,
            spaceName=space_name,
            meetingUri=meeting_uri,
            meetingCode=meeting_code,
            meetStatus="READY",
            message="Google Meet Space created successfully.",
        )
    except Exception as exc:
        err_str = str(exc)
        consultation.meeting_status = "meet_creation_failed"
        consultation.updated_at = datetime.now(timezone.utc)
        db.commit()

        if "GOOGLE_AUTH_REQUIRED" in err_str:
            return format_error_response(
                code="GOOGLE_AUTH_REQUIRED",
                message="Doctor must authenticate with Google OAuth before creating a Meet space.",
                request_id=request_id,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        if "GOOGLE_TOKEN_EXPIRED" in err_str:
            return format_error_response(
                code="GOOGLE_TOKEN_EXPIRED",
                message="Google authorization token expired. Please reconnect Google.",
                request_id=request_id,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        if "GOOGLE_OAUTH_NOT_CONFIGURED" in err_str:
            return format_error_response(
                code="GOOGLE_OAUTH_NOT_CONFIGURED",
                message="Google Cloud OAuth credentials are not configured in backend environment.",
                request_id=request_id,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if "GOOGLE_MEET_PERMISSION_DENIED" in err_str:
            return format_error_response(
                code="GOOGLE_MEET_PERMISSION_DENIED",
                message="Google did not allow this account to create a Meet space. Verify Google Workspace permissions.",
                request_id=request_id,
                status_code=status.HTTP_403_FORBIDDEN,
            )
        if "GOOGLE_MEET_API_NOT_ENABLED" in err_str:
            return format_error_response(
                code="GOOGLE_MEET_API_NOT_ENABLED",
                message="Google Meet REST API is not enabled in Google Cloud Console.",
                request_id=request_id,
                status_code=status.HTTP_403_FORBIDDEN,
            )
        if "GOOGLE_MEET_SCOPE_MISSING" in err_str:
            return format_error_response(
                code="GOOGLE_MEET_SCOPE_MISSING",
                message="The Google OAuth token is missing the required Meet space creation scope.",
                request_id=request_id,
                status_code=status.HTTP_403_FORBIDDEN,
            )
        if "GOOGLE_MEET_RATE_LIMITED" in err_str:
            return format_error_response(
                code="GOOGLE_MEET_RATE_LIMITED",
                message="Google Meet API rate limit reached. Please retry in a few moments.",
                request_id=request_id,
                retryable=True,
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        return format_error_response(
            code="GOOGLE_MEET_CREATE_FAILED",
            message=f"Google Meet space could not be created: {err_str}",
            request_id=request_id,
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


@router.get("/{consultationId}/status", response_model=GoogleMeetStatusResponse, summary="Get Google Meet consultation status")
async def get_google_meet_status(
    consultationId: str,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Checks the status of the Google Meet conference and transcript artifact.
    """
    consultation = db.query(Consultation).filter(Consultation.id == consultationId).first()
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation not found.",
        )

    has_transcript = len(consultation.transcript_segments) > 0

    if not consultation.google_space_name:
        return GoogleMeetStatusResponse(
            consultationId=consultation.id,
            meetingStatus=consultation.meeting_status or "scheduled",
            meetStatus="SCHEDULED",
            transcriptStatus=consultation.transcript_status or "pending",
            spaceName=None,
            meetingUri=None,
            meetingCode=None,
            conferenceRecordName=None,
            hasTranscript=has_transcript,
            participantCount=0,
            message="No Google Meet Space created for this consultation yet.",
        )

    status_label = consultation.meeting_status or "scheduled"
    if has_transcript:
        status_label = "transcript_ready"

    return GoogleMeetStatusResponse(
        consultationId=consultation.id,
        appointmentId=consultation.appointment_id,
        meetingStatus=status_label,
        meetStatus="READY" if consultation.google_meeting_uri else "SCHEDULED",
        transcriptStatus=consultation.transcript_status or ("ready" if has_transcript else "pending"),
        spaceName=consultation.google_space_name,
        meetingUri=consultation.google_meeting_uri,
        meetingCode=consultation.google_meeting_code,
        conferenceRecordName=consultation.conference_record_name,
        hasTranscript=has_transcript,
        participantCount=len(consultation.transcript_segments) if has_transcript else 0,
        message="Meeting status retrieved.",
    )


@router.post("/{consultationId}/end", summary="Mark Google Meet consultation as ended")
async def end_google_meet(
    consultationId: str,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marks the application consultation state as COMPLETED and syncs Firestore."""
    consultation = db.query(Consultation).filter(Consultation.id == consultationId).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    consultation.meeting_status = "completed"
    consultation.status = "completed"
    consultation.completed_at = datetime.now(timezone.utc)
    consultation.updated_at = datetime.now(timezone.utc)

    if consultation.appointment_id:
        appt = db.query(Appointment).filter(Appointment.id == consultation.appointment_id).first()
        if appt:
            appt.status = "completed"
            appt.meet_status = "COMPLETED"
            appt.updated_at = datetime.now(timezone.utc)

    db.commit()

    now_dt = datetime.now(timezone.utc)
    try:
        await firebase_service.write_document(
            "consultations",
            consultationId,
            {
                "status": "COMPLETED",
                "meetingStatus": "completed",
                "completedAt": now_dt,
                "updatedAt": now_dt,
            }
        )
        if consultation.appointment_id:
            await firebase_service.write_document(
                "appointments",
                consultation.appointment_id,
                {
                    "status": "COMPLETED",
                    "meetStatus": "COMPLETED",
                    "completedAt": now_dt,
                    "updatedAt": now_dt,
                }
            )
    except Exception as fe:
        logger.debug(f"Firestore end meet sync note: {fe}")

    return {
        "success": True,
        "consultationId": consultationId,
        "meetingStatus": "meeting_ended",
        "status": "COMPLETED",
        "message": "Consultation marked as completed.",
    }


@router.get("/{consultationId}/transcript", response_model=NormalizedTranscriptResponse, summary="Get normalized Google Meet transcript")
def get_google_meet_transcript(
    consultationId: str,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns normalized transcript entries mapped to DOCTOR / PATIENT / UNKNOWN.
    """
    consultation = db.query(Consultation).filter(Consultation.id == consultationId).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    entries = []
    for s in consultation.transcript_segments:
        role = "DOCTOR" if s.speaker == "Doctor" else ("PATIENT" if s.speaker == "Patient" else "UNKNOWN")
        entries.append({
            "speakerRole": role,
            "participantId": f"segment-{s.id}",
            "participantName": s.speaker,
            "text": s.text,
            "startTime": f"{int(s.start_time // 60):02d}:{int(s.start_time % 60):02d}",
            "endTime": f"{int(s.end_time // 60):02d}:{int(s.end_time % 60):02d}",
        })

    user_id = current_user.id if current_user else "doctor"
    audit = AuditLog(
        user_id=user_id,
        user_role="doctor",
        action="viewed_transcript",
        resource_type="transcript",
        resource_id=consultationId,
        details={"entries_count": len(entries)},
    )
    db.add(audit)
    db.commit()

    return NormalizedTranscriptResponse(
        consultationId=consultationId,
        entries=entries,
        transcriptStatus=consultation.transcript_status or ("ready" if entries else "pending"),
        googleSpaceName=consultation.google_space_name,
        doctorName=consultation.doctor_name,
        patientName=consultation.patient_name,
        isReviewed=bool(consultation.status in ["doctor_reviewed", "finalized"]),
    )


@router.post("/{consultationId}/sync-transcript", summary="Sync & fetch transcript entries from Google Meet REST API v2")
async def sync_google_meet_transcript(
    consultationId: str,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves conference records, lists transcripts, pulls all entries with pagination,
    and maps participants into structured clinical segments.
    """
    consultation = db.query(Consultation).filter(Consultation.id == consultationId).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    user_id = current_user.id if current_user else (consultation.google_oauth_user_id or "default_doctor")

    try:
        result = await transcript_service.sync_consultation_transcript(
            consultation_id=consultationId,
            user_id=user_id,
            db=db,
        )
        return result
    except Exception as exc:
        logger.error(f"[TranscriptSync] Error syncing Google Meet transcript: {exc}")
        return format_error_response(
            code="TRANSCRIPT_SYNC_FAILED",
            message=f"Google Meet transcript sync failed: {str(exc)}",
            operation="transcripts.sync",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
