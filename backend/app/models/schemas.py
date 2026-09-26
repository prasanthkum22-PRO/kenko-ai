"""
MediBridge AI — Pydantic Request & Response Schemas
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# ── Auth Schemas ───────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "PATIENT"  # PATIENT, DOCTOR, ADMIN, NURSE, LAB
    patient_id: Optional[str] = None
    doctor_id: Optional[str] = None


class UserLoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    patient_id: Optional[str] = None
    doctor_id: Optional[str] = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Transcript Schemas ─────────────────────────────────────────

class SegmentSchema(BaseModel):
    id: Optional[str] = None
    speaker: str = "Doctor"
    start_time: float = 0.0
    end_time: float = 0.0
    text: str
    confidence: float = 0.95
    is_edited: bool = False


class UpdateSegmentsRequest(BaseModel):
    segments: List[SegmentSchema]


# ── Strict Clinical Fact Schemas ──────────────────────────────

class SymptomItem(BaseModel):
    name: str
    duration: Optional[str] = "Not mentioned"
    quote: Optional[str] = None


class MedicationItem(BaseModel):
    name: str
    dosage: Optional[str] = "Not specified"
    frequency: Optional[str] = "1-0-1"
    duration: Optional[str] = "5 days"
    route: Optional[str] = "Oral"
    instructions: Optional[str] = "After food"
    quote: Optional[str] = None


class TestItem(BaseModel):
    name: str
    reason: Optional[str] = None
    quote: Optional[str] = None


class DoctorInstructionItem(BaseModel):
    instruction: str
    quote: Optional[str] = None


class FollowUpItemSchema(BaseModel):
    action: str
    timeReference: str = "7 days"
    source: str = "doctor_statement"
    status: str = "PENDING_DOCTOR_CONFIRMATION"  # PENDING_DOCTOR_CONFIRMATION, CONFIRMED, REMINDER_SCHEDULED, COMPLETED, CANCELLED
    quote: Optional[str] = None


class StructuredClinicalJSON(BaseModel):
    chiefConcern: str = "Not mentioned"
    patientReportedSymptoms: List[SymptomItem] = []
    medicationsMentioned: List[MedicationItem] = []
    testsMentioned: List[TestItem] = []
    doctorInstructions: List[DoctorInstructionItem] = []
    followUpItems: List[FollowUpItemSchema] = []
    summary: str = ""
    uncertainInformation: List[str] = []


# ── Doctor Verification & Finalize Schema ─────────────────────

class FinalizeSummaryRequest(BaseModel):
    chief_complaint: Optional[str] = None
    symptoms: Optional[List[Dict[str, Any]]] = None
    history: Optional[Dict[str, Any]] = None
    vitals: Optional[Dict[str, Any]] = None
    investigations: Optional[List[Dict[str, Any]]] = None
    assessment: Optional[str] = None
    treatment_plan: Optional[str] = None
    doctor_instructions: Optional[List[Dict[str, Any]]] = None
    medications: Optional[List[Dict[str, Any]]] = None
    follow_up_items: Optional[List[Dict[str, Any]]] = None
    follow_up: Optional[Dict[str, Any]] = None
    approved_by: str = "Dr. Aarav Patel"


# ── Appointment Schemas ───────────────────────────────────────

class CreateAppointmentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    patient_id: Optional[str] = Field(None, alias="patientId")
    patient_name: Optional[str] = Field(None, alias="patientName")
    patient_age: Optional[int] = Field(None, alias="patientAge")
    patient_gender: Optional[str] = Field(None, alias="patientGender")
    patient_language: Optional[str] = Field("English", alias="patientLanguage")
    doctor_id: Optional[str] = Field(None, alias="doctorId")
    doctor_name: Optional[str] = Field("Dr. Aarav Patel", alias="doctorName")
    doctor_specialization: Optional[str] = Field("General Medicine", alias="doctorSpecialization")
    appointment_type: str = Field("video", alias="appointmentType")  # 'video' | 'in_person'
    scheduled_at: Optional[datetime] = Field(None, alias="scheduledAt")
    reason: Optional[str] = "Video Consultation"


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    patient_language: Optional[str] = "English"
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_specialization: Optional[str] = "General Medicine"
    appointment_type: str = "video"
    scheduled_at: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    reason: Optional[str] = "Video Consultation"
    status: str = "scheduled"
    google_space_name: Optional[str] = None
    google_meeting_uri: Optional[str] = None
    google_meeting_code: Optional[str] = None
    meet_status: Optional[str] = "SCHEDULED"
    consultation_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── Consultation Schemas ──────────────────────────────────────

class CreateConsultationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    appointment_id: Optional[str] = Field(None, alias="appointmentId")
    patient_id: str = "P-1002"
    patient_name: str = "Aarav Sharma"
    patient_age: Optional[int] = 38
    patient_gender: Optional[str] = "Male"
    patient_language: Optional[str] = "English"
    doctor_id: Optional[str] = "D-101"
    doctor_name: str = "Dr. Aarav Patel"
    doctor_specialization: Optional[str] = "General Medicine"
    consultation_type: str = "video"  # 'video' | 'in_person'
    has_consent: bool = True
    detected_language: Optional[str] = "English"
    transcript: Optional[str] = None
    is_demo: Optional[bool] = False



class ConsultationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    appointment_id: Optional[str] = None
    consultation_type: str = "in_person"
    patient_id: str = "P-1002"
    patient_name: str = "Patient"
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    patient_language: Optional[str] = "English"
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = "Dr. Aarav Patel"
    doctor_specialization: Optional[str] = "General Medicine"
    status: str = "recording"
    detected_language: Optional[str] = "English"
    duration_seconds: int = 0
    has_consent: bool = True
    is_demo: bool = False
    google_space_name: Optional[str] = None
    google_meeting_uri: Optional[str] = None
    google_meeting_code: Optional[str] = None
    conference_record_name: Optional[str] = None
    meeting_status: Optional[str] = "scheduled"
    transcript_status: Optional[str] = "pending"
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    transcript_count: int = 0
    is_approved: bool = False



# ── Google Meet & OAuth Schemas ───────────────────────────────

class GoogleAuthUrlResponse(BaseModel):
    auth_url: str
    state: str
    is_configured: bool = True
    message: Optional[str] = None


class GoogleAuthStatusResponse(BaseModel):
    is_connected: bool
    email: Optional[str] = None
    scopes: Optional[List[str]] = None
    expires_at: Optional[str] = None
    is_mock: bool = False


class UpdateGoogleAccountRequest(BaseModel):
    email: str


class CreateGoogleMeetRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    consultationId: Optional[str] = Field(None, alias="consultationId")
    consultation_id: Optional[str] = None
    appointmentId: Optional[str] = Field(None, alias="appointmentId")
    appointment_id: Optional[str] = None
    patientId: Optional[str] = Field(None, alias="patientId")
    patient_id: Optional[str] = None


class CreateGoogleMeetResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    success: bool
    consultationId: Optional[str] = None
    appointmentId: Optional[str] = None
    spaceName: str
    meetingUri: str
    meetingCode: Optional[str] = None
    meetStatus: Optional[str] = "MEET_READY"
    message: Optional[str] = None


class GoogleMeetStatusResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    consultationId: Optional[str] = None
    appointmentId: Optional[str] = None
    meetingStatus: str
    meetStatus: Optional[str] = None
    transcriptStatus: str
    spaceName: Optional[str] = None
    meetingUri: Optional[str] = None
    meetingCode: Optional[str] = None
    conferenceRecordName: Optional[str] = None
    hasTranscript: bool = False
    participantCount: int = 0
    message: Optional[str] = None


class NormalizedTranscriptEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    speakerRole: str = "UNKNOWN"  # DOCTOR, PATIENT, UNKNOWN
    speaker: Optional[str] = None
    participantId: Optional[str] = None
    participantName: Optional[str] = None
    participantResourceName: Optional[str] = None
    text: str
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    createdAt: Optional[str] = None


class NormalizedTranscriptResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    consultationId: str
    entries: List[NormalizedTranscriptEntry]
    transcriptStatus: str
    googleSpaceName: Optional[str] = None
    doctorName: Optional[str] = None
    patientName: Optional[str] = None
    isReviewed: bool = False



# ── Chatbot Grounded Q&A Schemas ──────────────────────────────

class ConsultationChatRequest(BaseModel):
    question: str


class ConsultationChatResponse(BaseModel):
    answer: str
    source: str = "Current Consultation"
    found: bool = True
    is_grounded: bool = True
    relevant_quotes: List[str] = []



# ── Prescription Schemas ──────────────────────────────────────

class PrescriptionConfirmRequest(BaseModel):
    patient_name: str
    patient_id: Optional[str] = "P-1002"
    doctor_name: str
    date_str: str
    medicines: List[Dict[str, Any]]
    investigations: List[str] = []
    follow_up: Optional[str] = None
    verified_by: str = "Dr. Aarav Patel"


# ── Task & Followup Schemas ───────────────────────────────────

class LabTaskUpdateStatus(BaseModel):
    status: str = Field(
        ...,
        description="Requested, Sample Collected, Processing, Completed, Result Uploaded, Reviewed"
    )
    result_summary: Optional[str] = None


class FollowUpUpdateStatusRequest(BaseModel):
    status: str = Field(
        ...,
        description="PENDING_DOCTOR_CONFIRMATION, CONFIRMED, REMINDER_SCHEDULED, COMPLETED, CANCELLED"
    )
    due_date: Optional[str] = None
    action: Optional[str] = None
