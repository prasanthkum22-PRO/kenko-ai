"""
MediBridge AI — Appointment Routes

GET  /api/appointments/:id
     Returns appointment + patient + doctor + consultation + Google Meet metadata.
     Authorization: caller must be the patient, the doctor, or an admin.

POST /api/appointments/:id/meet
     Creates a Google Meet Space for a VIDEO appointment.
     Idempotent: if a space already exists, returns the existing one.
     Authorization: caller must be the doctor or an admin.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import Appointment, Consultation, User, AuditLog, TranscriptSegment
from app.utils.auth import get_current_user, require_authenticated_user
from app.services.google_meet_service import google_meet_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


# ─── Authorization helper ─────────────────────────────────────────────────────

def _require_appointment_access(
    appointment: Appointment,
    current_user: User,
) -> None:
    """
    Raises HTTP 403 if the authenticated user is NOT the assigned patient,
    assigned doctor, or an admin.

    We never trust patientId/doctorId from the request body.
    We compare against the server-verified JWT uid (current_user.id).
    """
    uid = current_user.id
    role = (current_user.role or "").upper()

    if role == "ADMIN":
        return  # Admin full access

    # Patient: UID must match appointment.patient_id
    if role == "PATIENT":
        if appointment.patient_id != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"success": False, "error": "FORBIDDEN"},
            )
        return

    # Doctor: UID must match appointment.doctor_id
    if role in ("DOCTOR", "DOCTOR_PENDING"):
        if appointment.doctor_id != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"success": False, "error": "FORBIDDEN"},
            )
        return

    # Any other role: deny
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"success": False, "error": "FORBIDDEN"},
    )


# ─── Response builders ────────────────────────────────────────────────────────

def _build_appointment_response(
    appointment: Appointment,
    consultation: Optional[Consultation],
    current_user: User,
) -> dict:
    """
    Build the safe public response. Never leaks private fields
    that the caller is not authorized to see.
    """
    role = (current_user.role or "").upper()
    uid = current_user.id

    # ── Appointment block ────────────────────────────────────────
    appt_block = {
        "id": appointment.id,
        "patientId": appointment.patient_id,
        "doctorId": appointment.doctor_id,
        "consultationType": (appointment.appointment_type or "video").upper(),
        "status": appointment.meet_status or appointment.status or "SCHEDULED",
        "scheduledStart": appointment.scheduled_at.isoformat() if appointment.scheduled_at else None,
        "scheduledEnd": appointment.scheduled_end.isoformat() if appointment.scheduled_end else None,
        "timezone": "Asia/Kolkata",
        "reason": appointment.reason,
        "consultationId": appointment.consultation_id,
    }

    # ── Patient block ────────────────────────────────────────────
    # Patients see their own full data; doctors/admin also see it.
    patient_block = {
        "id": appointment.patient_id,
        "displayName": appointment.patient_name or None,
        "age": appointment.patient_age,
        "gender": appointment.patient_gender,
        "language": appointment.patient_language or "English",
    }

    # ── Doctor block ─────────────────────────────────────────────
    doctor_block = {
        "id": appointment.doctor_id,
        "displayName": appointment.doctor_name or None,
        "specialization": appointment.doctor_specialization or None,
    }

    # ── Consultation block ───────────────────────────────────────
    consult_block = None
    if consultation:
        consult_block = {
            "id": consultation.id,
            "status": consultation.status,
            "meetingStatus": consultation.meeting_status,
            "transcriptStatus": consultation.transcript_status,
            "startedAt": consultation.started_at.isoformat() if consultation.started_at else None,
            "completedAt": consultation.completed_at.isoformat() if consultation.completed_at else None,
        }

    # ── Google Meet block ────────────────────────────────────────
    # Only return real URI. Never synthesize a fake one.
    meet_block = None
    if appointment.google_meeting_uri:
        meet_status = appointment.meet_status or "READY"
        meet_block = {
            "status": meet_status,
            "meetingUri": appointment.google_meeting_uri,
            "meetingCode": appointment.google_meeting_code,
            "spaceName": appointment.google_space_name,
        }
    else:
        meet_block = {
            "status": appointment.meet_status or "NOT_CREATED",
            "meetingUri": None,
            "meetingCode": None,
            "spaceName": None,
        }

    return {
        "success": True,
        "appointment": appt_block,
        "patient": patient_block,
        "doctor": doctor_block,
        "consultation": consult_block,
        "googleMeet": meet_block,
    }


# ─── GET /api/appointments/:id ────────────────────────────────────────────────

@router.get("/{appointment_id}", summary="Get appointment details with patient, doctor, consultation, and Meet metadata")
def get_appointment(
    appointment_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """
    Returns appointment metadata including patient/doctor info and Google Meet state.

    Authorization:
      - Patient: can only read their own appointment
      - Doctor: can only read their assigned appointment
      - Admin: unrestricted
    """
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        # Use the same 404 shape regardless of existence to avoid enumeration
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": "APPOINTMENT_NOT_FOUND"},
        )

    _require_appointment_access(appointment, current_user)

    # Load linked consultation if exists
    consultation: Optional[Consultation] = None
    if appointment.consultation_id:
        consultation = db.query(Consultation).filter(
            Consultation.id == appointment.consultation_id
        ).first()

    return _build_appointment_response(appointment, consultation, current_user)


# ─── POST /api/appointments/:id/meet ─────────────────────────────────────────

@router.post("/{appointment_id}/meet", summary="Create or retrieve Google Meet Space for appointment (idempotent)")
async def create_appointment_meet(
    appointment_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """
    Creates a Google Meet Space for the given VIDEO appointment.

    Idempotency: if google_meeting_uri is already set and meet_status is READY,
    returns the existing meeting — no duplicate spaces are created.

    Authorization: DOCTOR assigned to this appointment, or ADMIN.
    """
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": "APPOINTMENT_NOT_FOUND"},
        )

    # Only doctors or admins can initiate a Meet space
    role = (current_user.role or "").upper()
    if role == "PATIENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"success": False, "error": "FORBIDDEN", "message": "Only the assigned doctor can create the meeting."},
        )
    if role == "DOCTOR" and appointment.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"success": False, "error": "FORBIDDEN"},
        )

    # Validate appointment type
    apt_type = (appointment.appointment_type or "").lower()
    if apt_type not in ("video", "google_meet", "telehealth"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": "INVALID_APPOINTMENT_TYPE",
                "message": f"Appointment type '{appointment.appointment_type}' does not support Google Meet. Only VIDEO appointments can have a Meet space.",
            },
        )

    # ── Idempotency check ────────────────────────────────────────────────────
    if appointment.google_meeting_uri and appointment.meet_status in ("READY", "MEET_READY", "IN_PROGRESS"):
        logger.info(
            f"[appointments/{appointment_id}] Meet already exists: {appointment.google_meeting_uri}. Returning existing."
        )
        # Load linked consultation
        consultation: Optional[Consultation] = None
        if appointment.consultation_id:
            consultation = db.query(Consultation).filter(
                Consultation.id == appointment.consultation_id
            ).first()

        return {
            "success": True,
            "idempotent": True,
            "appointmentId": appointment_id,
            "spaceName": appointment.google_space_name,
            "meetingUri": appointment.google_meeting_uri,
            "meetingCode": appointment.google_meeting_code,
            "meetStatus": appointment.meet_status,
            "consultationId": appointment.consultation_id,
            "message": "Google Meet Space already exists. Returning existing meeting.",
        }

    # ── Create Google Meet Space ─────────────────────────────────────────────
    user_id = current_user.id
    logger.info(f"[appointments/{appointment_id}] Creating Google Meet Space (user={user_id})")

    # Set status to CREATING first so UI can reflect it
    appointment.meet_status = "CREATING"
    appointment.updated_at = datetime.now(timezone.utc)
    db.commit()

    try:
        space_data = await google_meet_service.create_space(user_id=user_id, db=db)
    except Exception as exc:
        logger.error(f"[appointments/{appointment_id}] Google Meet creation error: {exc}")
        appointment.meet_status = "FAILED"
        appointment.updated_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "success": False,
                "error": "MEET_CREATION_FAILED",
                "message": "Google Meet could not be created. Check Google OAuth configuration.",
            },
        )

    space_name = space_data.get("name")
    meeting_uri = space_data.get("meetingUri")
    meeting_code = space_data.get("meetingCode")
    is_mock = space_data.get("isMock", False)

    # If the service returned isMock=True but we need a real meeting,
    # mark FAILED and do NOT accept a fake URI
    if is_mock and not _is_mock_acceptable():
        appointment.meet_status = "FAILED"
        appointment.updated_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "success": False,
                "error": "GOOGLE_NOT_CONFIGURED",
                "message": "Google Meet is not configured. Please connect a Google account with Meet API access.",
            },
        )

    if not meeting_uri:
        appointment.meet_status = "FAILED"
        appointment.updated_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "success": False,
                "error": "MEET_CREATION_FAILED",
                "message": "Google Meet returned no meeting URI.",
            },
        )

    # ── Persist Meet metadata to Appointment ─────────────────────────────────
    appointment.google_space_name = space_name
    appointment.google_meeting_uri = meeting_uri
    appointment.google_meeting_code = meeting_code
    appointment.meet_status = "READY"
    appointment.status = "confirmed"
    appointment.updated_at = datetime.now(timezone.utc)
    db.commit()

    # ── Create or update linked Consultation ────────────────────────────────
    consultation_id = appointment.consultation_id
    consultation: Optional[Consultation] = None
    if consultation_id:
        consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()

    if not consultation:
        consultation = Consultation(
            id=str(uuid.uuid4()),
            appointment_id=appointment_id,
            consultation_type="video",
            patient_id=appointment.patient_id,
            patient_name=appointment.patient_name or "",
            patient_age=appointment.patient_age,
            patient_gender=appointment.patient_gender,
            patient_language=appointment.patient_language or "English",
            doctor_id=appointment.doctor_id,
            doctor_name=appointment.doctor_name or "",
            doctor_specialization=appointment.doctor_specialization or "",
            google_space_name=space_name,
            google_meeting_uri=meeting_uri,
            google_meeting_code=meeting_code,
            google_oauth_user_id=user_id,
            meeting_status="waiting_for_participants",
            status="SCHEDULED",
            transcript_status="NOT_STARTED",
            has_consent=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(consultation)
        db.flush()
        # Link back to appointment
        appointment.consultation_id = consultation.id
        db.commit()
        logger.info(f"[appointments/{appointment_id}] Consultation created: {consultation.id}")
    else:
        # Update existing consultation
        consultation.google_space_name = space_name
        consultation.google_meeting_uri = meeting_uri
        consultation.google_meeting_code = meeting_code
        consultation.google_oauth_user_id = user_id
        consultation.meeting_status = "waiting_for_participants"
        consultation.updated_at = datetime.now(timezone.utc)
        if consultation.status in ("SCHEDULED", "scheduled", ""):
            consultation.status = "SCHEDULED"
        db.commit()
        logger.info(f"[appointments/{appointment_id}] Consultation updated: {consultation.id}")

    # ── Audit log ────────────────────────────────────────────────────────────
    audit = AuditLog(
        user_id=user_id,
        user_role=current_user.role.lower(),
        action="created_google_meet_for_appointment",
        resource_type="appointment",
        resource_id=appointment_id,
        details={
            "appointment_id": appointment_id,
            "consultation_id": consultation.id if consultation else None,
            "space_name": space_name,
            # Never log meeting_uri (contains code) in sensitive logs
            "is_mock": is_mock,
        },
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "idempotent": False,
        "appointmentId": appointment_id,
        "spaceName": space_name,
        "meetingUri": meeting_uri,
        "meetingCode": meeting_code,
        "meetStatus": "READY",
        "consultationId": consultation.id if consultation else None,
        "isMock": is_mock,
        "message": "Google Meet Space created successfully." if not is_mock else "Google Meet Space created (sandbox mode).",
    }


@router.get("/{appointment_id}/meet/status", summary="Get Google Meet status for appointment")
def get_appointment_meet_status(
    appointment_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Returns the current Google Meet status for an appointment."""
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": "APPOINTMENT_NOT_FOUND"},
        )

    _require_appointment_access(appointment, current_user)

    return {
        "success": True,
        "appointmentId": appointment_id,
        "meetStatus": appointment.meet_status or "NOT_CREATED",
        "meetingUri": appointment.google_meeting_uri,
        "meetingCode": appointment.google_meeting_code,
        "spaceName": appointment.google_space_name,
        "consultationId": appointment.consultation_id,
    }


def _is_mock_acceptable() -> bool:
    """
    In development/demo environments, a mock Meet is acceptable.
    In production (APP_ENV=production), we reject fake URIs.
    """
    import os
    env = os.getenv("APP_ENV", "development").lower()
    return env not in ("production", "prod")
