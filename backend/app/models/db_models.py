"""
MediBridge AI — SQLAlchemy Database Models
Relational schema for users, consultations, versioned AI summaries,
follow-up intelligence, lab tasks, nursing tasks, prescriptions, and audit logs.
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import (
    Column,
    String,
    Text,
    Float,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship
from app.db.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(128), unique=True, nullable=False, index=True)
    hashed_password = Column(String(256), nullable=False)
    full_name = Column(String(128), nullable=False)
    role = Column(String(32), nullable=False, default="PATIENT")  # PATIENT, DOCTOR_PENDING, DOCTOR, ADMIN, NURSE, LAB
    patient_id = Column(String(64), nullable=True, index=True)   # Linked patient ID if role is PATIENT
    doctor_id = Column(String(64), nullable=True, index=True)    # Linked doctor ID if role is DOCTOR
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_type = Column(String(20), default="in_person")  # 'video' | 'in_person'
    patient_id = Column(String(64), nullable=False, index=True)
    patient_name = Column(String(128), nullable=False)
    patient_age = Column(Integer, nullable=True)
    patient_gender = Column(String(16), nullable=True)
    doctor_id = Column(String(64), nullable=True)
    doctor_name = Column(String(128), default="Dr. Aarav Patel")
    status = Column(
        String(32), default="recording"
    )  # 'recording', 'processing', 'transcript_ready', 'summary_ready', 'doctor_reviewed', 'finalized'
    audio_path = Column(String(256), nullable=True)
    audio_filename = Column(String(128), nullable=True)
    detected_language = Column(String(64), default="English")  # e.g., 'English', 'Tamil', 'Tamil + English (Mixed)'
    duration_seconds = Column(Integer, default=0)
    has_consent = Column(Boolean, default=False)
    is_demo = Column(Boolean, default=False)
    # Google Meet v2 Integration Fields
    google_space_name = Column(String(256), nullable=True, index=True)      # e.g., 'spaces/abcdef12345'
    google_meeting_uri = Column(String(512), nullable=True)                  # e.g., 'https://meet.google.com/abc-defg-hij'
    google_meeting_code = Column(String(64), nullable=True)                  # e.g., 'abc-defg-hij'
    conference_record_name = Column(String(256), nullable=True, index=True) # e.g., 'conferenceRecords/abc-123'
    google_oauth_user_id = Column(String(128), nullable=True)
    meeting_status = Column(
        String(64), default="scheduled"
    )  # 'scheduled', 'waiting_for_participants', 'meeting_active', 'meeting_ended', 'processing_transcript', 'transcript_ready', 'transcript_unavailable', 'error'
    transcript_status = Column(
        String(64), default="pending"
    )  # 'pending', 'processing', 'ready', 'unavailable'
    transcript_resource_name = Column(String(256), nullable=True)
    transcript_started_at = Column(DateTime, nullable=True)
    transcript_ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    transcript_segments = relationship(
        "TranscriptSegment",
        back_populates="consultation",
        cascade="all, delete-orphan",
        order_by="TranscriptSegment.start_time",
    )
    summaries = relationship(
        "ClinicalSummary",
        back_populates="consultation",
        cascade="all, delete-orphan",
        order_by="ClinicalSummary.version.desc()",
    )
    lab_tasks = relationship(
        "LabTask", back_populates="consultation", cascade="all, delete-orphan"
    )
    follow_ups = relationship(
        "FollowUp", back_populates="consultation", cascade="all, delete-orphan"
    )
    nursing_tasks = relationship(
        "NursingTask", back_populates="consultation", cascade="all, delete-orphan"
    )
    medications = relationship(
        "Medication", back_populates="consultation", cascade="all, delete-orphan"
    )


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_id = Column(
        String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    speaker = Column(String(32), default="Doctor")  # 'Doctor', 'Patient', 'Nurse', 'Other'
    start_time = Column(Float, default=0.0)  # in seconds
    end_time = Column(Float, default=0.0)    # in seconds
    text = Column(Text, nullable=False)
    confidence = Column(Float, default=0.95)
    is_edited = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    consultation = relationship("Consultation", back_populates="transcript_segments")


class ClinicalSummary(Base):
    """
    Versioned Clinical Summary chain:
    Original AI Extraction -> Doctor Edits -> Approved Final Record
    """
    __tablename__ = "clinical_summaries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_id = Column(
        String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version = Column(Integer, default=1)
    
    # Strict Structured Clinical Facts
    chief_complaint = Column(Text, default="Not mentioned")
    symptoms = Column(JSON, default=list)  # list of { name, duration, quote, segment_id, uncertain }
    history = Column(JSON, default=dict)   # { allergies, past_conditions, current_meds }
    vitals = Column(JSON, default=dict)    # { bp, pulse, temp, spo2, weight }
    investigations = Column(JSON, default=list) # list of { test_name, reason, quote, uncertain }
    assessment = Column(Text, default="Not mentioned")
    treatment_plan = Column(Text, default="Not mentioned")
    doctor_instructions = Column(JSON, default=list)  # list of { instruction, quote }
    medications = Column(JSON, default=list)  # list of { name, dosage, frequency, duration, route, instructions, quote, uncertain }
    follow_up = Column(JSON, default=dict)    # { interval_days, date_str, reason, quote, action, status }
    follow_up_items = Column(JSON, default=list)  # list of { action, timeReference, source, status }
    
    # Role-transformed views
    patient_view = Column(JSON, default=dict)
    nurse_view = Column(JSON, default=dict)
    
    summary_text = Column(Text, default="")
    uncertainty_flags = Column(JSON, default=list)
    raw_json = Column(JSON, default=dict)
    
    is_doctor_approved = Column(Boolean, default=False)
    approved_by = Column(String(128), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    consultation = relationship("Consultation", back_populates="summaries")


class Medication(Base):
    __tablename__ = "medications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_id = Column(
        String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    prescription_id = Column(String(36), nullable=True, index=True)
    patient_id = Column(String(64), nullable=False, index=True)
    drug_name = Column(String(128), nullable=False)
    dosage = Column(String(64), default="Not specified")
    frequency = Column(String(64), default="1-0-1")
    duration = Column(String(64), default="5 days")
    route = Column(String(32), default="Oral")
    instructions = Column(String(256), default="After food")
    source = Column(String(32), default="consultation")  # 'consultation' | 'prescription_ocr'
    source_quote = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    consultation = relationship("Consultation", back_populates="medications")


class LabTask(Base):
    __tablename__ = "lab_tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_id = Column(
        String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    patient_id = Column(String(64), nullable=False, index=True)
    patient_name = Column(String(128), nullable=False)
    test_name = Column(String(128), nullable=False)
    reason = Column(String(256), default="Evaluation")
    priority = Column(String(20), default="normal")  # 'normal' | 'urgent' | 'stat'
    status = Column(
        String(32), default="Requested"
    )  # 'Requested' -> 'Sample Collected' -> 'Processing' -> 'Completed' -> 'Result Uploaded' -> 'Reviewed'
    requesting_doctor = Column(String(128), default="Dr. Aarav Patel")
    result_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    consultation = relationship("Consultation", back_populates="lab_tasks")


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_id = Column(
        String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    patient_id = Column(String(64), nullable=False, index=True)
    patient_name = Column(String(128), nullable=False)
    action = Column(String(256), nullable=False)
    time_reference = Column(String(64), default="7 days")
    interval_days = Column(Integer, default=7)
    due_date = Column(DateTime, nullable=False)
    # Statuses: PENDING_DOCTOR_CONFIRMATION, CONFIRMED, REMINDER_SCHEDULED, COMPLETED, CANCELLED
    status = Column(String(32), default="PENDING_DOCTOR_CONFIRMATION")
    category = Column(String(32), default="doctor_review")  # 'doctor_review', 'lab_test', 'nurse_check'
    source = Column(String(64), default="doctor_statement")
    source_quote = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    consultation = relationship("Consultation", back_populates="follow_ups")


class NursingTask(Base):
    __tablename__ = "nursing_tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_id = Column(
        String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    patient_id = Column(String(64), nullable=False, index=True)
    patient_name = Column(String(128), nullable=False)
    task_description = Column(Text, nullable=False)
    vitals_to_monitor = Column(String(128), nullable=True)
    priority = Column(String(20), default="normal")  # 'normal' | 'high'
    status = Column(String(20), default="pending")    # 'pending' | 'in_progress' | 'completed'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    consultation = relationship("Consultation", back_populates="nursing_tasks")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(64), nullable=True, index=True)
    patient_name = Column(String(128), default="Not identified")
    doctor_name = Column(String(128), default="Not identified")
    date_str = Column(String(32), default="Not specified")
    image_path = Column(String(256), nullable=True)
    raw_ocr_text = Column(Text, nullable=False)
    parsed_json = Column(JSON, default=dict)
    is_verified = Column(Boolean, default=False)
    verified_by = Column(String(128), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(64), nullable=False, index=True)
    patient_name = Column(String(128), nullable=False)
    doctor_name = Column(String(128), default="Dr. Aarav Patel")
    appointment_type = Column(String(32), default="in_person")  # 'in_person' | 'video'
    scheduled_at = Column(DateTime, nullable=False)
    reason = Column(String(256), default="Follow-up consultation")
    status = Column(String(32), default="scheduled")  # 'scheduled', 'completed', 'cancelled'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(64), nullable=False, index=True)
    title = Column(String(128), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(32), default="reminder")  # 'reminder', 'lab_ready', 'follow_up'
    is_read = Column(Boolean, default=False)
    scheduled_for = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), default="system")
    user_role = Column(String(32), default="doctor")
    action = Column(String(64), nullable=False)
    resource_type = Column(String(32), nullable=False)
    resource_id = Column(String(64), nullable=False)
    details = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class GoogleOAuthToken(Base):
    """
    Secure server-side storage for Google OAuth 2.0 refresh & access tokens.
    Tokens are NEVER exposed to the frontend browser or localStorage.
    """
    __tablename__ = "google_oauth_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), nullable=False, unique=True, index=True) # Linked User ID or Doctor ID
    email = Column(String(128), nullable=True)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_type = Column(String(32), default="Bearer")
    expires_at = Column(DateTime, nullable=True)
    scopes = Column(Text, nullable=True)
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ──────────────────────────────────────────────────────────────────────────────
# DOCTOR APPLICATION & APPROVAL SYSTEM
# ──────────────────────────────────────────────────────────────────────────────

class DoctorApplication(Base):
    """
    Tracks a user's application to become a verified doctor.
    Statuses: PENDING | UNDER_REVIEW | APPROVED | REJECTED | REQUIRES_MORE_INFORMATION
    """
    __tablename__ = "doctor_applications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Personal Information
    full_name = Column(String(128), nullable=False)
    email = Column(String(128), nullable=False)
    phone = Column(String(32), nullable=True)
    date_of_birth = Column(String(32), nullable=True)
    profile_photo_path = Column(String(512), nullable=True)
    # Professional Information
    medical_degree = Column(String(128), nullable=False)
    specialization = Column(String(128), nullable=False)
    registration_number = Column(String(64), nullable=False)
    years_of_experience = Column(Integer, default=0)
    organization = Column(String(256), nullable=True)
    professional_bio = Column(Text, nullable=True)
    # Additional
    languages = Column(JSON, default=list)
    areas_of_practice = Column(JSON, default=list)
    # Document paths (private — never exposed publicly)
    qualification_doc_path = Column(String(512), nullable=True)
    registration_doc_path = Column(String(512), nullable=True)
    supporting_doc_paths = Column(JSON, default=list)
    # Status workflow
    status = Column(String(48), default="PENDING")
    review_message = Column(Text, nullable=True)
    reviewed_by = Column(String(36), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    applicant = relationship("User", foreign_keys=[user_id])


class DoctorProfile(Base):
    """
    Public professional profile for approved/verified doctors.
    Populated when a DoctorApplication is APPROVED.
    """
    __tablename__ = "doctor_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    verification_status = Column(String(32), default="VERIFIED")
    specialization = Column(String(128), nullable=False)
    medical_degree = Column(String(128), nullable=False)
    registration_number = Column(String(64), nullable=True)
    years_of_experience = Column(Integer, default=0)
    organization = Column(String(256), nullable=True)
    professional_bio = Column(Text, nullable=True)
    languages = Column(JSON, default=list)
    areas_of_practice = Column(JSON, default=list)
    profile_photo_path = Column(String(512), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(String(36), nullable=True)
    application_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    doctor = relationship("User", foreign_keys=[user_id])


class Post(Base):
    """
    Educational/professional posts created by verified doctors.
    Statuses: DRAFT | PENDING_REVIEW | APPROVED | PUBLISHED | REJECTED | CHANGES_REQUESTED
    """
    __tablename__ = "posts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    author_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    content = Column(Text, nullable=False)
    cover_image_path = Column(String(512), nullable=True)
    category = Column(String(64), default="General Health")
    tags = Column(JSON, default=list)
    specialization = Column(String(128), nullable=True)
    references = Column(JSON, default=list)
    status = Column(String(48), default="DRAFT")
    review_message = Column(Text, nullable=True)
    reviewed_by = Column(String(36), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    author = relationship("User", foreign_keys=[author_id])


class UserNotification(Base):
    """In-app notifications for doctor application status updates, post approvals, etc."""
    __tablename__ = "user_notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(64), default="info")
    related_type = Column(String(32), nullable=True)
    related_id = Column(String(36), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    recipient = relationship("User", foreign_keys=[user_id])


# ─── Post-Consultation Clinical Documentation & Follow-Up Models ─────────────

class TranscriptAnnotation(Base):
    """Doctor notes attached to specific transcript lines."""
    __tablename__ = "transcript_annotations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_id = Column(String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False, index=True)
    transcript_entry_id = Column(String(64), nullable=False)
    doctor_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    doctor = relationship("User", foreign_keys=[doctor_id])


class ClinicalNote(Base):
    """Structured clinical documentation (SOAP + Clinical sections) with approval lifecycle."""
    __tablename__ = "clinical_notes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_id = Column(String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    patient_id = Column(String(64), nullable=False, index=True)
    doctor_id = Column(String(36), nullable=False, index=True)

    chief_complaint = Column(Text, default="")
    hpi = Column(Text, default="")
    symptoms = Column(JSON, default=list)
    duration = Column(String(128), default="")
    relevant_history = Column(Text, default="")
    examination = Column(Text, default="")
    investigations = Column(Text, default="")
    assessment = Column(Text, default="")
    plan = Column(Text, default="")
    doctor_notes = Column(Text, default="")

    # SOAP components
    soap_subjective = Column(Text, default="")
    soap_objective = Column(Text, default="")
    soap_assessment = Column(Text, default="")
    soap_plan = Column(Text, default="")

    status = Column(String(32), default="DRAFT")  # 'DRAFT' | 'APPROVED'
    is_ai_generated = Column(Boolean, default=False)
    provenance = Column(String(64), default="AI_GENERATED")  # 'GOOGLE_MEET_TRANSCRIPT', 'DOCTOR_INPUT', 'PATIENT_INPUT', 'AI_GENERATED'
    
    approved_by = Column(String(36), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class PrescriptionRecord(Base):
    """Formal doctor prescription record linked to consultation."""
    __tablename__ = "prescription_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_id = Column(String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(String(64), nullable=False, index=True)
    doctor_id = Column(String(36), nullable=False, index=True)
    doctor_name = Column(String(128), default="")
    
    status = Column(String(32), default="DRAFT")  # 'DRAFT' | 'DOCTOR_REVIEW' | 'APPROVED' | 'ISSUED'
    internal_doctor_notes = Column(Text, default="")
    patient_instructions = Column(Text, default="")
    
    approved_at = Column(DateTime, nullable=True)
    issued_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    items = relationship("PrescriptionRecordItem", back_populates="prescription", cascade="all, delete-orphan")


class PrescriptionRecordItem(Base):
    """Items inside a prescription with dosage, frequency, route, and AI suggestion provenance."""
    __tablename__ = "prescription_record_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    prescription_id = Column(String(36), ForeignKey("prescription_records.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_name = Column(String(128), nullable=False)
    dosage = Column(String(64), default="")
    frequency = Column(String(64), default="1-0-1")
    duration = Column(String(64), default="5 days")
    route = Column(String(32), default="Oral")
    instructions = Column(String(256), default="After food")
    is_ai_suggested = Column(Boolean, default=False)
    doctor_confirmed = Column(Boolean, default=True)

    prescription = relationship("PrescriptionRecord", back_populates="items")


class MedicationTask(Base):
    """Daily schedule tasks for patient medication intake (Morning / Afternoon / Night)."""
    __tablename__ = "medication_tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    prescription_id = Column(String(36), ForeignKey("prescription_records.id", ondelete="CASCADE"), nullable=False, index=True)
    prescription_item_id = Column(String(36), nullable=True)
    patient_id = Column(String(64), nullable=False, index=True)
    medicine_name = Column(String(128), nullable=False)
    dosage = Column(String(64), default="")
    schedule_slot = Column(String(32), default="Morning")  # 'Morning' | 'Afternoon' | 'Night'
    instructions = Column(String(256), default="")
    due_time = Column(String(32), default="08:00 AM")
    status = Column(String(32), default="PENDING")  # 'PENDING' | 'TAKEN' | 'SKIPPED'
    taken_at = Column(DateTime, nullable=True)
    scheduled_date = Column(String(32), default="")  # YYYY-MM-DD
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class FollowUpPlan(Base):
    """Core Follow-Up Intelligence plan created upon doctor approval."""
    __tablename__ = "follow_up_plans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_id = Column(String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(String(64), nullable=False, index=True)
    doctor_id = Column(String(36), nullable=False, index=True)
    
    instruction = Column(Text, nullable=False)
    due_date = Column(DateTime, nullable=False)
    condition_monitoring = Column(String(256), default="Standard Recovery Monitoring")
    recommended_test_name = Column(String(128), nullable=True)
    status = Column(String(32), default="ACTIVE")  # 'ACTIVE' | 'NEEDS_REVIEW' | 'HIGH_PRIORITY_REVIEW' | 'COMPLETED'
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    checkins = relationship("PatientCheckIn", back_populates="plan", cascade="all, delete-orphan")


class PatientCheckIn(Base):
    """Patient condition reports (RECOVERING | SAME | WORSENING) — patient reported signals, not AI diagnosis."""
    __tablename__ = "patient_checkins"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    follow_up_plan_id = Column(String(36), ForeignKey("follow_up_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(String(64), nullable=False, index=True)
    
    condition_status = Column(String(32), nullable=False)  # 'RECOVERING' | 'SAME' | 'WORSENING'
    notes = Column(Text, default="")
    flag = Column(String(64), default="NORMAL")  # 'NORMAL' | 'EARLIER_REVIEW_RECOMMENDED' | 'HIGH_PRIORITY_DOCTOR_REVIEW'
    
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    plan = relationship("FollowUpPlan", back_populates="checkins")


class DoctorFollowUpReview(Base):
    """Doctor's evaluation and action taken on follow-up check-ins."""
    __tablename__ = "doctor_followup_reviews"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    follow_up_plan_id = Column(String(36), ForeignKey("follow_up_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    checkin_id = Column(String(36), nullable=True)
    doctor_id = Column(String(36), nullable=False, index=True)
    review_notes = Column(Text, nullable=False)
    next_action = Column(String(128), default="Maintain Current Plan")
    reviewed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class InvestigationTracking(Base):
    """Recommended tests and investigations with patient confirmation and doctor review."""
    __tablename__ = "investigation_trackings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    consultation_id = Column(String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(String(64), nullable=False, index=True)
    doctor_id = Column(String(36), nullable=False, index=True)
    
    test_name = Column(String(128), nullable=False)
    reason = Column(String(256), default="Evaluation")
    due_date = Column(DateTime, nullable=True)
    instructions = Column(String(256), default="")
    status = Column(String(32), default="PENDING")  # 'PENDING' | 'COMPLETED'
    completed_at = Column(DateTime, nullable=True)
    doctor_review_status = Column(String(32), default="UNREVIEWED")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PatientTask(Base):
    """General actionable tasks for patient care (MEDICATION | APPOINTMENT | TEST | FOLLOW_UP | DOCTOR_INSTRUCTION)."""
    __tablename__ = "patient_tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(64), nullable=False, index=True)
    consultation_id = Column(String(36), nullable=True)
    task_type = Column(String(32), default="DOCTOR_INSTRUCTION")  # 'MEDICATION' | 'APPOINTMENT' | 'TEST' | 'FOLLOW_UP' | 'DOCTOR_INSTRUCTION'
    title = Column(String(256), nullable=False)
    description = Column(Text, default="")
    due_date = Column(DateTime, nullable=True)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

