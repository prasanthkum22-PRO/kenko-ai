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
    role = Column(String(32), nullable=False, default="PATIENT")  # PATIENT, DOCTOR, ADMIN, NURSE, LAB
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
