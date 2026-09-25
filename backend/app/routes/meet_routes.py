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
    1. Verifies consultation exists
    2. Calls POST https://meet.googleapis.com/v2/spaces
    3. Stores meeting metadata (google_space_name, google_meeting_uri, google_meeting_code)
    4. Returns meeting URI for Doctor + Patient to join
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

    user_id = current_user.id if current_user else "default_doctor"

    try:
        # Create space via Google Meet REST API v2
        space_data = await google_meet_service.create_space(user_id=user_id, db=db)
        
        space_name = space_data.get("name")
        meeting_uri = space_data.get("meetingUri")
        meeting_code = space_data.get("meetingCode")

        # Update Consultation record
        consultation.google_space_name = space_name
        consultation.google_meeting_uri = meeting_uri
        consultation.google_meeting_code = meeting_code
        consultation.google_oauth_user_id = user_id
        consultation.meeting_status = "waiting_for_participants"
        consultation.consultation_type = "video"
        consultation.updated_at = datetime.now(timezone.utc)
        db.commit()

        # Audit log
        audit = AuditLog(
            user_id=user_id,
            user_role="doctor",
            action="created_google_meet",
            resource_type="google_meet_space",
            resource_id=space_name,
            details={
                "consultation_id": consultation_id,
                "meeting_uri": meeting_uri,
                "is_mock": space_data.get("isMock", False),
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
            message="Google Meet Space created successfully.",
        )
    except Exception as exc:
        logger.error(f"Error creating Google Meet space: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Google Meet Space: {str(exc)}",
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
        participantCount=2 if consultation.google_meeting_uri else 0,
        message="Meeting status active.",
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
