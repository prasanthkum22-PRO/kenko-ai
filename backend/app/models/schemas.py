"""
MediBridge AI — Pydantic Request & Response Schemas
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


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


# ── Consultation Schemas ──────────────────────────────────────

class CreateConsultationRequest(BaseModel):
    patient_id: str = "P-1002"
    patient_name: str = "Aarav Sharma"
    patient_age: Optional[int] = 38
    patient_gender: Optional[str] = "Male"
    doctor_id: Optional[str] = "D-101"
    doctor_name: str = "Dr. Aarav Patel"
    consultation_type: str = "in_person"  # 'video' | 'in_person'
    has_consent: bool = True
    detected_language: Optional[str] = "English"
    transcript: Optional[str] = None
    is_demo: Optional[bool] = False



class ConsultationResponse(BaseModel):
    id: str
    consultation_type: str
    patient_id: str
    patient_name: str
    patient_age: Optional[int]
    patient_gender: Optional[str]
    doctor_name: str
    status: str
    detected_language: Optional[str] = "English"
    duration_seconds: int
    has_consent: bool
    is_demo: bool = False
    created_at: datetime
    updated_at: datetime
    transcript_count: int = 0
    is_approved: bool = False


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
