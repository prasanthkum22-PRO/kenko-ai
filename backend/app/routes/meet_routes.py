"""
MediBridge AI — Google Meet API Routes
Endpoints for creating Google Meet spaces, tracking meeting status,
fetching conference artifacts, and syncing transcripts.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import Consultation, User, AuditLog, TranscriptSegment
from app.models.schemas import (
    CreateGoogleMeetRequest,
    CreateGoogleMeetResponse,
    GoogleMeetStatusResponse,
    NormalizedTranscriptResponse,
)
from app.utils.auth import get_current_user, require_authenticated_user
from app.services.google_meet_service import google_meet_service
from app.services.transcript_service import transcript_service
from app.services.participant_service import participant_service
from app.services.firebase_service import firebase_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/meet", tags=["Google Meet"])


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
    consultation_id = req.consultationId or req.consultation_id
    if not consultation_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="consultationId is required.",
        )

    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Consultation '{consultation_id}' not found.",
        )

    # Authorization: only the assigned doctor or admin
    if current_user:
        uid = current_user.id
        role = (current_user.role or "").upper()
        if role == "PATIENT":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the assigned doctor can create a Google Meet space.",
            )
        doctor_ids = {uid}
        if getattr(current_user, "doctor_id", None):
            doctor_ids.add(current_user.doctor_id)

        if role in ("DOCTOR", "DOCTOR_PENDING") and consultation.doctor_id and consultation.doctor_id not in doctor_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not the assigned doctor for this consultation.",
            )
        if not consultation.doctor_id:
            consultation.doctor_id = current_user.doctor_id or uid

    user_id = current_user.id if current_user else "default_doctor"

    # ── Idempotency: return existing meeting if already created ──────────────
    if consultation.google_meeting_uri and consultation.meeting_status not in (
        "scheduled", "SCHEDULED", "meet_creation_failed", "MEET_CREATION_FAILED", ""
    ):
        logger.info(
            f"[meet/create] Consultation {consultation_id} already has a Meet space. Returning existing."
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
            message="Google Meet Space already exists. Returning existing meeting.",
        )

    # Mark as creating
    consultation.meeting_status = "meet_creating"
    consultation.updated_at = datetime.now(timezone.utc)
    db.commit()

    try:
        space_data = await google_meet_service.create_space(user_id=user_id, db=db)

        space_name = space_data.get("name")
        meeting_uri = space_data.get("meetingUri")
        meeting_code = space_data.get("meetingCode")
        is_mock = space_data.get("isMock", False)

        consultation.google_space_name = space_name
        consultation.google_meeting_uri = meeting_uri
        consultation.google_meeting_code = meeting_code
        consultation.google_oauth_user_id = user_id
        consultation.meeting_status = "waiting_for_participants"
        consultation.consultation_type = "video"
        consultation.updated_at = datetime.now(timezone.utc)
        db.commit()

        try:
            await firebase_service.sync_appointment_meet(
                appointment_id=consultation.appointment_id or consultation_id,
                space_name=space_name or "",
                meet_uri=meeting_uri,
                meet_code=meeting_code or "",
                consultation_id=consultation_id,
            )
        except Exception as fe:
            logger.debug(f"Firestore meet create sync note: {fe}")

        audit = AuditLog(
            user_id=user_id,
            user_role="doctor",
            action="created_google_meet",
            resource_type="google_meet_space",
            resource_id=space_name or consultation_id,
            details={
                "consultation_id": consultation_id,
                "is_mock": is_mock,
            },
        )
        db.add(audit)
        db.commit()

        return CreateGoogleMeetResponse(
            success=True,
            consultationId=consultation.id,
            spaceName=space_name,
            meetingUri=meeting_uri,
            meetingCode=meeting_code,
            message="Google Meet Space created successfully." if not is_mock else "Google Meet Space ready (sandbox mode).",
        )
    except Exception as exc:
        logger.error(f"[meet/create] Error creating Google Meet space for {consultation_id}: {exc}")
        consultation.meeting_status = "meet_creation_failed"
        consultation.updated_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "success": False,
                "error": "MEET_CREATION_FAILED",
                "message": "Google Meet could not be created. Check Google OAuth configuration and Meet API permissions.",
            },
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

    user_id = current_user.id if current_user else (consultation.google_oauth_user_id or "default_doctor")

    has_transcript = len(consultation.transcript_segments) > 0
    
    # Check if space name exists
    if not consultation.google_space_name:
        return GoogleMeetStatusResponse(
            consultationId=consultation.id,
            meetingStatus=consultation.meeting_status or "scheduled",
            transcriptStatus=consultation.transcript_status or "pending",
            spaceName=None,
            meetingUri=None,
            meetingCode=None,
            conferenceRecordName=None,
            hasTranscript=has_transcript,
            participantCount=0,
            message="No Google Meet Space created for this consultation yet.",
        )

    # Determine meeting status
    status_label = consultation.meeting_status or "scheduled"
    if has_transcript:
        status_label = "transcript_ready"

    return GoogleMeetStatusResponse(
        consultationId=consultation.id,
        meetingStatus=status_label,
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
    """Marks the Google Meet as ended and sets status to processing transcript."""
    consultation = db.query(Consultation).filter(Consultation.id == consultationId).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    consultation.meeting_status = "meeting_ended"
    consultation.transcript_status = "processing"
    consultation.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "success": True,
        "consultationId": consultationId,
        "meetingStatus": "meeting_ended",
        "message": "Google Meet marked as completed. Waiting for transcript artifacts.",
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
        # Convert DB speaker tag ('Doctor'/'Patient') to role enum
        role = "DOCTOR" if s.speaker == "Doctor" else ("PATIENT" if s.speaker == "Patient" else "UNKNOWN")
        entries.append({
            "speakerRole": role,
            "participantId": f"segment-{s.id}",
            "participantName": s.speaker,
            "text": s.text,
            "startTime": f"{int(s.start_time // 60):02d}:{int(s.start_time % 60):02d}",
            "endTime": f"{int(s.end_time // 60):02d}:{int(s.end_time % 60):02d}",
        })

    # Log audit trail for transcript access
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
        logger.error(f"Error syncing Google Meet transcript: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Google Meet transcript sync failed: {str(exc)}",
        )


@router.post("/{consultationId}/mock-complete", summary="Simulate Google Meet completion and transcript generation (Demo / Testing)")
async def mock_complete_google_meet(
    consultationId: str,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Demo/testing helper that populates a realistic Google Meet space, conference record,
    and multi-speaker dialogue.
    """
    consultation = db.query(Consultation).filter(Consultation.id == consultationId).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    user_id = current_user.id if current_user else "default_doctor"

    if not consultation.google_space_name:
        space_data = await google_meet_service.create_space(user_id=user_id, db=db)
        consultation.google_space_name = space_data["name"]
        consultation.google_meeting_uri = space_data["meetingUri"]
        consultation.google_meeting_code = space_data["meetingCode"]
        consultation.meeting_status = "meeting_ended"
        db.commit()

    result = await transcript_service.sync_consultation_transcript(
        consultation_id=consultationId,
        user_id=user_id,
        db=db,
    )
    return {
        "success": True,
        "message": "Google Meet simulated completion and transcript ready.",
        "data": result,
    }
