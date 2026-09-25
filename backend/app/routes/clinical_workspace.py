"""
MediBridge AI / KENKO-AI — Post-Consultation Clinical Workspace & Follow-Up Intelligence Router
Handles end-to-end clinical workflow:
1. Consultation Workspace & Google Meet Transcript Review + Annotations
2. AI Clinical Summary Extraction (Zero Hallucination + SOAP format + Doctor Review Required)
3. Structured Clinical Documentation Approval Lifecycle
4. Prescription Studio & Patient Safe Prescription View
5. Daily Patient Medication Tasks (Morning / Afternoon / Night)
6. Follow-Up Intelligence, Condition Check-Ins (RECOVERING | SAME | WORSENING), and Doctor Review Dashboard
7. Patient Health Timeline & Doctor Patient History Timeline
8. Audit events & Notifications
"""

from datetime import datetime, timezone, timedelta
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import (
    User, Consultation, TranscriptSegment, ClinicalSummary,
    AuditLog, UserNotification, TranscriptAnnotation,
    ClinicalNote, PrescriptionRecord, PrescriptionRecordItem,
    MedicationTask, FollowUpPlan, PatientCheckIn,
    DoctorFollowUpReview, InvestigationTracking, PatientTask
)
from app.utils.auth import require_authenticated_user, require_role
from app.services.clinical_ai import clinical_ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/clinical", tags=["Clinical Workspace & Follow-Up Intelligence"])


# ─── Pydantic Request Schemas ────────────────────────────────────────────────

class TranscriptNoteCreate(BaseModel):
    transcript_entry_id: str
    note: str


class ClinicalNoteSaveRequest(BaseModel):
    chief_complaint: Optional[str] = ""
    hpi: Optional[str] = ""
    symptoms: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    duration: Optional[str] = ""
    relevant_history: Optional[str] = ""
    examination: Optional[str] = ""
    investigations: Optional[str] = ""
    assessment: Optional[str] = ""
    plan: Optional[str] = ""
    doctor_notes: Optional[str] = ""
    soap_subjective: Optional[str] = ""
    soap_objective: Optional[str] = ""
    soap_assessment: Optional[str] = ""
    soap_plan: Optional[str] = ""


class PrescriptionItemSchema(BaseModel):
    medicine_name: str
    dosage: Optional[str] = ""
    frequency: Optional[str] = "1-0-1"
    duration: Optional[str] = "5 days"
    route: Optional[str] = "Oral"
    instructions: Optional[str] = "After food"
    is_ai_suggested: Optional[bool] = False
    doctor_confirmed: Optional[bool] = True


class PrescriptionSaveRequest(BaseModel):
    items: List[PrescriptionItemSchema]
    internal_doctor_notes: Optional[str] = ""
    patient_instructions: Optional[str] = ""


class FollowUpPlanCreateRequest(BaseModel):
    instruction: str
    interval_days: Optional[int] = 7
    due_date_str: Optional[str] = None
    condition_monitoring: Optional[str] = "Standard Recovery Monitoring"
    recommended_test_name: Optional[str] = None
    test_reason: Optional[str] = "Evaluation"
    test_instructions: Optional[str] = ""


class PatientCheckInRequest(BaseModel):
    follow_up_plan_id: str
    condition_status: str  # RECOVERING | SAME | WORSENING
    notes: Optional[str] = ""


class DoctorFollowUpReviewRequest(BaseModel):
    review_notes: str
    next_action: Optional[str] = "Maintain Current Plan"


class MedicationTaskStatusUpdate(BaseModel):
    status: str  # TAKEN | SKIPPED


# ─── Helper Functions ────────────────────────────────────────────────────────

def _audit(db: Session, actor_id: str, actor_role: str, action: str,
           target_type: str, target_id: str, details: dict = None):
    """Log audit event without exposing private transcript text."""
    log = AuditLog(
        user_id=actor_id,
        user_role=actor_role,
        action=action,
        resource_type=target_type,
        resource_id=target_id,
        details=details or {}
    )
    db.add(log)


def _notify(db: Session, user_id: str, title: str, message: str,
            ntype: str = "info", related_type: str = None, related_id: str = None):
    if not user_id:
        return
    # Resolve target user UUID if patient_id or doctor_id string was passed
    target_user = db.query(User).filter(
        (User.id == user_id) | (User.patient_id == user_id) | (User.doctor_id == user_id)
    ).first()
    if not target_user:
        return
    notif = UserNotification(
        user_id=target_user.id,
        title=title,
        message=message,
        notification_type=ntype,
        related_type=related_type,
        related_id=related_id
    )
    db.add(notif)


# ─── 1. CONSULTATION WORKSPACE OVERVIEW & TRANSCRIPT ─────────────────────────

@router.get("/consultations/{consultation_id}/workspace", summary="Get complete consultation workspace data")
def get_consultation_workspace(
    consultation_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    # Authorization check
    role = current_user.role.upper()
    if role == "PATIENT" and current_user.patient_id != consultation.patient_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this consultation.")

    # Transcript segments
    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.consultation_id == consultation_id)
        .order_by(TranscriptSegment.start_time.asc())
        .all()
    )

    # Transcript annotations (doctor notes)
    annotations = (
        db.query(TranscriptAnnotation)
        .filter(TranscriptAnnotation.consultation_id == consultation_id)
        .all()
    )
    annotations_by_entry = {a.transcript_entry_id: a.note for a in annotations}

    transcript_list = []
    for s in segments:
        entry_id = str(s.id)
        transcript_list.append({
            "id": entry_id,
            "speaker": s.speaker,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "text": s.text,
            "timestamp": f"{int(s.start_time//60):02d}:{int(s.start_time%60):02d}",
            "note": annotations_by_entry.get(entry_id, ""),
        })

    # Clinical Note
    note = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == consultation_id).first()
    clinical_note_data = None
    if note:
        clinical_note_data = {
            "id": note.id,
            "chief_complaint": note.chief_complaint,
            "hpi": note.hpi,
            "symptoms": note.symptoms or [],
            "duration": note.duration,
            "relevant_history": note.relevant_history,
            "examination": note.examination,
            "investigations": note.investigations,
            "assessment": note.assessment,
            "plan": note.plan,
            "doctor_notes": note.doctor_notes if role != "PATIENT" else "",  # Sanitize for patient
            "soap": {
                "subjective": note.soap_subjective,
                "objective": note.soap_objective,
                "assessment": note.soap_assessment,
                "plan": note.soap_plan,
            },
            "status": note.status,
            "is_ai_generated": note.is_ai_generated,
            "provenance": note.provenance,
            "approved_by": note.approved_by,
            "approved_at": note.approved_at.isoformat() if note.approved_at else None,
        }

    # Prescription
    prescription = db.query(PrescriptionRecord).filter(PrescriptionRecord.consultation_id == consultation_id).first()
    prescription_data = None
    if prescription:
        prescription_data = {
            "id": prescription.id,
            "status": prescription.status,
            "doctor_name": prescription.doctor_name or consultation.doctor_name,
            "internal_doctor_notes": prescription.internal_doctor_notes if role != "PATIENT" else "",
            "patient_instructions": prescription.patient_instructions,
            "approved_at": prescription.approved_at.isoformat() if prescription.approved_at else None,
            "issued_at": prescription.issued_at.isoformat() if prescription.issued_at else None,
            "items": [
                {
                    "id": item.id,
                    "medicine_name": item.medicine_name,
                    "dosage": item.dosage,
                    "frequency": item.frequency,
                    "duration": item.duration,
                    "route": item.route,
                    "instructions": item.instructions,
                    "is_ai_suggested": item.is_ai_suggested,
                    "doctor_confirmed": item.doctor_confirmed,
                }
                for item in prescription.items
            ],
        }

    # Follow-Up Plan
    followup = db.query(FollowUpPlan).filter(FollowUpPlan.consultation_id == consultation_id).first()
    followup_data = None
    if followup:
        followup_data = {
            "id": followup.id,
            "instruction": followup.instruction,
            "due_date": followup.due_date.isoformat() if followup.due_date else None,
            "condition_monitoring": followup.condition_monitoring,
            "recommended_test_name": followup.recommended_test_name,
            "status": followup.status,
            "checkins": [
                {
                    "id": c.id,
                    "condition_status": c.condition_status,
                    "notes": c.notes,
                    "flag": c.flag,
                    "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
                }
                for c in followup.checkins
            ]
        }

    # Recommended Tests
    tests = db.query(InvestigationTracking).filter(InvestigationTracking.consultation_id == consultation_id).all()
    tests_data = [
        {
            "id": t.id,
            "test_name": t.test_name,
            "reason": t.reason,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "instructions": t.instructions,
            "status": t.status,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        }
        for t in tests
    ]

    return {
        "consultation": {
            "id": consultation.id,
            "patient_id": consultation.patient_id,
            "patient_name": consultation.patient_name,
            "patient_age": consultation.patient_age,
            "patient_gender": consultation.patient_gender,
            "doctor_id": consultation.doctor_id,
            "doctor_name": consultation.doctor_name,
            "consultation_type": consultation.consultation_type,
            "duration_seconds": consultation.duration_seconds,
            "status": consultation.status,
            "has_consent": consultation.has_consent,
            "detected_language": consultation.detected_language,
            "created_at": consultation.created_at.isoformat() if consultation.created_at else None,
            "is_completed": consultation.status in ["transcript_ready", "summary_ready", "doctor_reviewed", "finalized"],
            "has_transcript": len(transcript_list) > 0,
        },
        "transcript": transcript_list,
        "clinical_note": clinical_note_data,
        "prescription": prescription_data,
        "follow_up_plan": followup_data,
        "investigations": tests_data,
    }


@router.post("/consultations/{consultation_id}/transcript-notes", summary="Add doctor note to a transcript entry")
def add_transcript_note(
    consultation_id: str,
    payload: TranscriptNoteCreate,
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    note = db.query(TranscriptAnnotation).filter(
        TranscriptAnnotation.consultation_id == consultation_id,
        TranscriptAnnotation.transcript_entry_id == payload.transcript_entry_id,
    ).first()

    if note:
        note.note = payload.note
    else:
        note = TranscriptAnnotation(
            consultation_id=consultation_id,
            transcript_entry_id=payload.transcript_entry_id,
            doctor_id=current_user.id,
            note=payload.note,
        )
        db.add(note)

    db.commit()
    return {"success": True, "message": "Transcript note saved."}


# ─── 2. AI CLINICAL SUMMARY & SOAP GENERATION (Zero Hallucination) ───────────

@router.post("/consultations/{consultation_id}/generate-summary", summary="Generate AI clinical summary & SOAP format")
def generate_ai_clinical_summary(
    consultation_id: str,
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.consultation_id == consultation_id)
        .order_by(TranscriptSegment.start_time.asc())
        .all()
    )

    if not segments:
        raise HTTPException(status_code=400, detail="Transcript is not available to generate summary.")

    seg_dicts = [
        {"speaker": s.speaker, "start_time": s.start_time, "end_time": s.end_time, "text": s.text}
        for s in segments
    ]

    # Deterministic zero-hallucination extraction
    extracted = clinical_ai_service.extract_summary(seg_dicts)

    symptoms_list = extracted.get("symptoms", [])
    chief_complaint = symptoms_list[0]["name"] if symptoms_list else "Not mentioned in consultation."
    duration = extracted.get("duration", "Not specified in consultation.")
    
    # Format SOAP sections
    subjective_lines = [
        f"Chief Complaint: {chief_complaint}",
        f"Duration: {duration}",
        f"Reported Symptoms: {', '.join([s['name'] for s in symptoms_list]) if symptoms_list else 'None reported.'}",
    ]
    soap_subjective = "\n".join(subjective_lines)
    
    vitals = extracted.get("vitals", {})
    soap_objective = f"Vitals: BP: {vitals.get('bp', 'Not recorded')}, Pulse: {vitals.get('pulse', 'Not recorded')}, SpO2: {vitals.get('spo2', 'Not recorded')}, Temp: {vitals.get('temp', 'Not recorded')}."
    soap_assessment = f"Clinical assessment pending doctor confirmation for reported symptoms: {chief_complaint}."
    
    instructions = extracted.get("doctor_instructions", [])
    soap_plan = f"Instructions: {', '.join([i['instruction'] for i in instructions]) if instructions else 'No specific instructions documented.'}"

    # Check or create clinical note
    note = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == consultation_id).first()
    if not note:
        note = ClinicalNote(
            consultation_id=consultation_id,
            patient_id=consultation.patient_id,
            doctor_id=current_user.id,
            chief_complaint=chief_complaint,
            hpi=f"Patient reports {chief_complaint} for {duration}.",
            symptoms=symptoms_list,
            duration=duration,
            relevant_history="No relevant past history documented.",
            examination="General physical examination deferred.",
            investigations="No investigations mentioned in consultation.",
            assessment=f"Symptom presentation: {chief_complaint}.",
            plan=soap_plan,
            doctor_notes="",
            soap_subjective=soap_subjective,
            soap_objective=soap_objective,
            soap_assessment=soap_assessment,
            soap_plan=soap_plan,
            status="DRAFT",
            is_ai_generated=True,
            provenance="GOOGLE_MEET_TRANSCRIPT",
        )
        db.add(note)
    else:
        # Update fields only if draft
        if note.status == "DRAFT":
            note.chief_complaint = chief_complaint
            note.hpi = f"Patient reports {chief_complaint} for {duration}."
            note.symptoms = symptoms_list
            note.duration = duration
            note.soap_subjective = soap_subjective
            note.soap_objective = soap_objective
            note.soap_assessment = soap_assessment
            note.soap_plan = soap_plan
            note.is_ai_generated = True
            note.provenance = "GOOGLE_MEET_TRANSCRIPT"

    _audit(db, current_user.id, current_user.role, "CLINICAL_SUMMARY_GENERATED", "consultation", consultation_id)
    db.commit()

    return {
        "success": True,
        "message": "AI clinical summary extracted successfully. Doctor review required.",
        "clinical_note": {
            "chief_complaint": note.chief_complaint,
            "hpi": note.hpi,
            "symptoms": note.symptoms,
            "duration": note.duration,
            "soap": {
                "subjective": note.soap_subjective,
                "objective": note.soap_objective,
                "assessment": note.soap_assessment,
                "plan": note.soap_plan,
            },
            "is_ai_generated": True,
            "status": note.status,
        }
    }


# ─── 3. CLINICAL NOTE DRAFT & APPROVAL ───────────────────────────────────────

@router.post("/consultations/{consultation_id}/clinical-note/save-draft", summary="Save draft clinical note")
def save_draft_clinical_note(
    consultation_id: str,
    payload: ClinicalNoteSaveRequest,
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    note = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == consultation_id).first()
    if not note:
        note = ClinicalNote(
            consultation_id=consultation_id,
            patient_id=consultation.patient_id,
            doctor_id=current_user.id,
        )
        db.add(note)

    note.chief_complaint = payload.chief_complaint or ""
    note.hpi = payload.hpi or ""
    note.symptoms = payload.symptoms or []
    note.duration = payload.duration or ""
    note.relevant_history = payload.relevant_history or ""
    note.examination = payload.examination or ""
    note.investigations = payload.investigations or ""
    note.assessment = payload.assessment or ""
    note.plan = payload.plan or ""
    note.doctor_notes = payload.doctor_notes or ""
    note.soap_subjective = payload.soap_subjective or ""
    note.soap_objective = payload.soap_objective or ""
    note.soap_assessment = payload.soap_assessment or ""
    note.soap_plan = payload.soap_plan or ""
    note.provenance = "DOCTOR_INPUT"

    _audit(db, current_user.id, current_user.role, "CLINICAL_NOTE_EDITED", "clinical_note", note.id or consultation_id)
    db.commit()

    return {"success": True, "message": "Clinical note draft saved."}


@router.post("/consultations/{consultation_id}/clinical-note/approve", summary="Approve and finalize clinical note")
def approve_clinical_note(
    consultation_id: str,
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    note = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == consultation_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Clinical note not found. Please save a note first.")

    now = datetime.now(timezone.utc)
    note.status = "APPROVED"
    note.approved_by = current_user.full_name or current_user.id
    note.approved_at = now

    # Update consultation status to finalized
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if consultation:
        consultation.status = "finalized"

    # Notify patient
    _notify(
        db,
        user_id=note.patient_id,
        title="Consultation Summary Ready",
        message=f"Dr. {current_user.full_name} has finalized your consultation summary.",
        ntype="success",
        related_type="consultation",
        related_id=consultation_id,
    )

    _audit(db, current_user.id, current_user.role, "CLINICAL_NOTE_APPROVED", "clinical_note", note.id, {
        "approved_by": note.approved_by,
        "approved_at": now.isoformat(),
    })
    db.commit()

    return {"success": True, "message": "Clinical note approved and signed."}


# ─── 4. PRESCRIPTION STUDIO & PATIENT PRESCRIBING ────────────────────────────

@router.post("/consultations/{consultation_id}/prescription/save-draft", summary="Save prescription draft")
def save_prescription_draft(
    consultation_id: str,
    payload: PrescriptionSaveRequest,
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    prescription = db.query(PrescriptionRecord).filter(PrescriptionRecord.consultation_id == consultation_id).first()
    if not prescription:
        prescription = PrescriptionRecord(
            consultation_id=consultation_id,
            patient_id=consultation.patient_id,
            doctor_id=current_user.id,
            doctor_name=current_user.full_name or "Doctor",
            status="DRAFT",
        )
        db.add(prescription)
        db.flush()

    prescription.internal_doctor_notes = payload.internal_doctor_notes or ""
    prescription.patient_instructions = payload.patient_instructions or ""

    # Replace items
    db.query(PrescriptionRecordItem).filter(PrescriptionRecordItem.prescription_id == prescription.id).delete()
    for item in payload.items:
        db.add(
            PrescriptionRecordItem(
                prescription_id=prescription.id,
                medicine_name=item.medicine_name,
                dosage=item.dosage or "",
                frequency=item.frequency or "1-0-1",
                duration=item.duration or "5 days",
                route=item.route or "Oral",
                instructions=item.instructions or "After food",
                is_ai_suggested=item.is_ai_suggested or False,
                doctor_confirmed=True,
            )
        )

    _audit(db, current_user.id, current_user.role, "PRESCRIPTION_CREATED", "prescription", prescription.id)
    db.commit()

    return {"success": True, "message": "Prescription draft saved.", "prescription_id": prescription.id}


@router.post("/consultations/{consultation_id}/prescription/approve", summary="Approve prescription")
def approve_prescription(
    consultation_id: str,
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    prescription = db.query(PrescriptionRecord).filter(PrescriptionRecord.consultation_id == consultation_id).first()
    if not prescription or not prescription.items:
        raise HTTPException(status_code=400, detail="Prescription must contain at least one medication before approval.")

    now = datetime.now(timezone.utc)
    prescription.status = "APPROVED"
    prescription.approved_at = now

    _audit(db, current_user.id, current_user.role, "PRESCRIPTION_APPROVED", "prescription", prescription.id)
    db.commit()

    return {"success": True, "message": "Prescription approved by doctor."}


@router.post("/consultations/{consultation_id}/prescription/issue", summary="Issue prescription and schedule medication tasks")
def issue_prescription(
    consultation_id: str,
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    prescription = db.query(PrescriptionRecord).filter(PrescriptionRecord.consultation_id == consultation_id).first()
    if not prescription or not prescription.items:
        raise HTTPException(status_code=400, detail="Prescription must contain medications to be issued.")

    now = datetime.now(timezone.utc)
    prescription.status = "ISSUED"
    prescription.issued_at = now

    # Generate daily patient medication tasks (Morning, Afternoon, Night)
    today_str = now.strftime("%Y-%m-%d")
    for item in prescription.items:
        freq = (item.frequency or "").lower()
        slots = []
        if "1-0-1" in freq or "twice" in freq:
            slots = [("Morning", "08:00 AM"), ("Night", "08:00 PM")]
        elif "1-1-1" in freq or "thrice" in freq:
            slots = [("Morning", "08:00 AM"), ("Afternoon", "01:00 PM"), ("Night", "08:00 PM")]
        elif "1-0-0" in freq or "morning" in freq:
            slots = [("Morning", "08:00 AM")]
        elif "0-0-1" in freq or "night" in freq or "bedtime" in freq:
            slots = [("Night", "09:00 PM")]
        else:
            slots = [("Morning", "08:00 AM"), ("Night", "08:00 PM")]

        for slot_name, due_time in slots:
            task = MedicationTask(
                prescription_id=prescription.id,
                prescription_item_id=item.id,
                patient_id=prescription.patient_id,
                medicine_name=item.medicine_name,
                dosage=item.dosage or "",
                schedule_slot=slot_name,
                instructions=item.instructions or "",
                due_time=due_time,
                status="PENDING",
                scheduled_date=today_str,
            )
            db.add(task)

    # Patient Notification
    _notify(
        db,
        user_id=prescription.patient_id,
        title="Prescription Issued",
        message="Your prescription has been issued and daily medication reminders are ready.",
        ntype="success",
        related_type="prescription",
        related_id=prescription.id,
    )

    _audit(db, current_user.id, current_user.role, "PRESCRIPTION_ISSUED", "prescription", prescription.id)
    db.commit()

    return {"success": True, "message": "Prescription issued and medication tasks created."}


# ─── 5. PATIENT PRESCRIPTION VIEW & MEDICATION TASKS ─────────────────────────

@router.get("/patient/prescriptions", summary="Patient view of all authorized prescriptions")
def get_patient_prescriptions(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    patient_id = current_user.patient_id or current_user.id
    prescriptions = (
        db.query(PrescriptionRecord)
        .filter(
            PrescriptionRecord.patient_id == patient_id,
            PrescriptionRecord.status.in_(["APPROVED", "ISSUED"])
        )
        .order_by(PrescriptionRecord.created_at.desc())
        .all()
    )

    return [
        {
            "id": p.id,
            "consultation_id": p.consultation_id,
            "doctor_name": p.doctor_name,
            "status": p.status,
            "patient_instructions": p.patient_instructions,
            "issued_at": p.issued_at.isoformat() if p.issued_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "items": [
                {
                    "medicine_name": i.medicine_name,
                    "dosage": i.dosage,
                    "frequency": i.frequency,
                    "duration": i.duration,
                    "route": i.route,
                    "instructions": i.instructions,
                }
                for i in p.items
            ]
        }
        for p in prescriptions
    ]


@router.get("/patient/medication-tasks", summary="Patient view of today's medication tasks")
def get_patient_medication_tasks(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    patient_id = current_user.patient_id or current_user.id
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tasks = (
        db.query(MedicationTask)
        .filter(
            MedicationTask.patient_id == patient_id,
            (MedicationTask.scheduled_date == today_str) | (MedicationTask.scheduled_date == "")
        )
        .order_by(MedicationTask.created_at.desc())
        .all()
    )

    return [
        {
            "id": t.id,
            "prescription_id": t.prescription_id,
            "medicine_name": t.medicine_name,
            "dosage": t.dosage,
            "schedule_slot": t.schedule_slot,
            "due_time": t.due_time,
            "instructions": t.instructions,
            "status": t.status,
            "taken_at": t.taken_at.isoformat() if t.taken_at else None,
        }
        for t in tasks
    ]


@router.post("/patient/medication-tasks/{task_id}/status", summary="Patient updates medication status (TAKEN/SKIPPED)")
def update_medication_task_status(
    task_id: str,
    payload: MedicationTaskStatusUpdate,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    task = db.query(MedicationTask).filter(MedicationTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Medication task not found.")

    new_status = payload.status.upper()
    if new_status not in ["TAKEN", "SKIPPED", "PENDING"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be TAKEN, SKIPPED, or PENDING.")

    task.status = new_status
    if new_status == "TAKEN":
        task.taken_at = datetime.now(timezone.utc)

    db.commit()
    return {"success": True, "message": f"Medication marked as {new_status}."}


# ─── 6. FOLLOW-UP INTELLIGENCE & PATIENT CHECK-IN ────────────────────────────

@router.post("/consultations/{consultation_id}/followup-plan", summary="Create follow-up plan & patient tasks")
def create_followup_plan(
    consultation_id: str,
    payload: FollowUpPlanCreateRequest,
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    # Calculate due date
    now = datetime.now(timezone.utc)
    if payload.due_date_str:
        try:
            due_date = datetime.fromisoformat(payload.due_date_str)
        except Exception:
            due_date = now + timedelta(days=payload.interval_days or 7)
    else:
        due_date = now + timedelta(days=payload.interval_days or 7)

    plan = db.query(FollowUpPlan).filter(FollowUpPlan.consultation_id == consultation_id).first()
    if not plan:
        plan = FollowUpPlan(
            consultation_id=consultation_id,
            patient_id=consultation.patient_id,
            doctor_id=current_user.id,
            instruction=payload.instruction,
            due_date=due_date,
            condition_monitoring=payload.condition_monitoring or "Standard Recovery Monitoring",
            recommended_test_name=payload.recommended_test_name,
            status="ACTIVE",
        )
        db.add(plan)
    else:
        plan.instruction = payload.instruction
        plan.due_date = due_date
        plan.condition_monitoring = payload.condition_monitoring or "Standard Recovery Monitoring"
        plan.recommended_test_name = payload.recommended_test_name
        plan.status = "ACTIVE"

    # Create Investigation tracking if recommended test provided
    if payload.recommended_test_name:
        test = InvestigationTracking(
            consultation_id=consultation_id,
            patient_id=consultation.patient_id,
            doctor_id=current_user.id,
            test_name=payload.recommended_test_name,
            reason=payload.test_reason or "Evaluation",
            due_date=due_date,
            instructions=payload.test_instructions or "",
            status="PENDING",
        )
        db.add(test)

        # Also add Patient Task for the test
        db.add(
            PatientTask(
                patient_id=consultation.patient_id,
                consultation_id=consultation_id,
                task_type="TEST",
                title=f"Complete Test: {payload.recommended_test_name}",
                description=payload.test_instructions or "Please complete the recommended test before follow-up.",
                due_date=due_date,
            )
        )

    # Patient Task for follow-up
    db.add(
        PatientTask(
            patient_id=consultation.patient_id,
            consultation_id=consultation_id,
            task_type="FOLLOW_UP",
            title="Follow-Up Consultation Check-In",
            description=payload.instruction,
            due_date=due_date,
        )
    )

    # Patient Notification
    _notify(
        db,
        user_id=consultation.patient_id,
        title="Follow-Up Plan Created",
        message=f"Follow-up scheduled for {due_date.strftime('%b %d, %Y')}. {payload.instruction}",
        ntype="info",
        related_type="followup",
        related_id=consultation_id,
    )

    _audit(db, current_user.id, current_user.role, "FOLLOW_UP_CREATED", "follow_up_plan", plan.id or consultation_id)
    db.commit()

    return {"success": True, "message": "Follow-up plan created successfully."}


@router.post("/patient/checkin", summary="Patient submits condition check-in (RECOVERING | SAME | WORSENING)")
def submit_patient_checkin(
    payload: PatientCheckInRequest,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    plan = db.query(FollowUpPlan).filter(FollowUpPlan.id == payload.follow_up_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Follow-up plan not found.")

    status_str = payload.condition_status.upper()
    flag = "NORMAL"
    if status_str == "RECOVERING":
        flag = "NORMAL"
        plan.status = "ACTIVE"
        patient_message = "Your response has been recorded. Continue with your prescribed care plan."
    elif status_str == "SAME":
        flag = "EARLIER_REVIEW_RECOMMENDED"
        plan.status = "NEEDS_REVIEW"
        patient_message = "Your response has been recorded and an earlier doctor review is recommended."
        # Notify doctor
        _notify(
            db,
            user_id=plan.doctor_id,
            title="Follow-Up Review Needed",
            message="Patient reported condition SAME. Earlier review recommended.",
            ntype="warning",
            related_type="followup_plan",
            related_id=plan.id,
        )
    elif status_str == "WORSENING":
        flag = "HIGH_PRIORITY_DOCTOR_REVIEW"
        plan.status = "HIGH_PRIORITY_REVIEW"
        patient_message = "Your response has been sent to your care team for high-priority doctor review."
        # Notify doctor immediately
        _notify(
            db,
            user_id=plan.doctor_id,
            title="⚠️ High Priority Follow-Up",
            message="Patient reported WORSENING. Urgent doctor review required.",
            ntype="action_required",
            related_type="followup_plan",
            related_id=plan.id,
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid condition status. Must be RECOVERING, SAME, or WORSENING.")

    checkin = PatientCheckIn(
        follow_up_plan_id=plan.id,
        patient_id=plan.patient_id,
        condition_status=status_str,
        notes=payload.notes or "",
        flag=flag,
    )
    db.add(checkin)

    _audit(db, current_user.id, current_user.role, "PATIENT_CHECKIN_SUBMITTED", "patient_checkin", plan.id, {
        "condition_status": status_str,
        "flag": flag,
    })
    db.commit()

    return {
        "success": True,
        "message": patient_message,
        "flag": flag,
        "condition_status": status_str,
    }


# ─── 7. DOCTOR FOLLOW-UP DASHBOARD & DETAIL ──────────────────────────────────

@router.get("/doctor/followup-dashboard", summary="Doctor Follow-up intelligence dashboard")
def get_doctor_followup_dashboard(
    filter_by: Optional[str] = Query("all"),  # 'all' | 'due_today' | 'upcoming' | 'patient_responses' | 'needs_review' | 'high_priority'
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    query = db.query(FollowUpPlan)
    if current_user.role.upper() == "DOCTOR":
        query = query.filter(FollowUpPlan.doctor_id == current_user.id)

    all_plans = query.order_by(FollowUpPlan.due_date.asc()).all()

    items = []
    for p in all_plans:
        consultation = db.query(Consultation).filter(Consultation.id == p.consultation_id).first()
        latest_checkin = (
            db.query(PatientCheckIn)
            .filter(PatientCheckIn.follow_up_plan_id == p.id)
            .order_by(PatientCheckIn.submitted_at.desc())
            .first()
        )

        due = p.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)

        is_today = today_start <= due < today_end
        is_high_priority = p.status == "HIGH_PRIORITY_REVIEW" or (latest_checkin and latest_checkin.condition_status == "WORSENING")
        is_needs_review = p.status == "NEEDS_REVIEW" or is_high_priority

        item = {
            "id": p.id,
            "consultation_id": p.consultation_id,
            "patient_id": p.patient_id,
            "patient_name": consultation.patient_name if consultation else "Patient",
            "instruction": p.instruction,
            "due_date": due.strftime("%b %d, %Y"),
            "status": p.status,
            "condition_monitoring": p.condition_monitoring,
            "recommended_test_name": p.recommended_test_name,
            "latest_response": latest_checkin.condition_status if latest_checkin else "Pending Check-In",
            "latest_response_flag": latest_checkin.flag if latest_checkin else "NORMAL",
            "latest_response_date": latest_checkin.submitted_at.strftime("%b %d, %Y") if latest_checkin else None,
            "is_today": is_today,
            "is_high_priority": is_high_priority,
        }

        # Apply filter
        if filter_by == "due_today" and not is_today:
            continue
        elif filter_by == "upcoming" and (due < today_end):
            continue
        elif filter_by == "patient_responses" and not latest_checkin:
            continue
        elif filter_by == "needs_review" and not is_needs_review:
            continue
        elif filter_by == "high_priority" and not is_high_priority:
            continue

        items.append(item)

    counts = {
        "all": len(all_plans),
        "due_today": sum(1 for p in all_plans if today_start <= (p.due_date.replace(tzinfo=timezone.utc) if p.due_date.tzinfo is None else p.due_date) < today_end),
        "high_priority": sum(1 for p in all_plans if p.status == "HIGH_PRIORITY_REVIEW"),
        "needs_review": sum(1 for p in all_plans if p.status in ["NEEDS_REVIEW", "HIGH_PRIORITY_REVIEW"]),
    }

    return {"plans": items, "counts": counts}


@router.get("/doctor/followup/{followup_plan_id}", summary="Get full follow-up detail and care timeline")
def get_doctor_followup_detail(
    followup_plan_id: str,
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    plan = db.query(FollowUpPlan).filter(FollowUpPlan.id == followup_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Follow-up plan not found.")

    consultation = db.query(Consultation).filter(Consultation.id == plan.consultation_id).first()
    prescription = db.query(PrescriptionRecord).filter(PrescriptionRecord.consultation_id == plan.consultation_id).first()
    checkins = (
        db.query(PatientCheckIn)
        .filter(PatientCheckIn.follow_up_plan_id == plan.id)
        .order_by(PatientCheckIn.submitted_at.desc())
        .all()
    )
    reviews = (
        db.query(DoctorFollowUpReview)
        .filter(DoctorFollowUpReview.follow_up_plan_id == plan.id)
        .order_by(DoctorFollowUpReview.reviewed_at.desc())
        .all()
    )

    # Visual timeline construction
    timeline = [
        {
            "step": "CONSULTATION",
            "title": "Telehealth Consultation Completed",
            "date": consultation.created_at.strftime("%b %d, %Y") if consultation and consultation.created_at else "—",
            "status": "COMPLETED",
        },
        {
            "step": "PRESCRIPTION",
            "title": f"Prescription Issued ({len(prescription.items) if prescription else 0} medicines)",
            "date": prescription.issued_at.strftime("%b %d, %Y") if prescription and prescription.issued_at else "—",
            "status": "COMPLETED" if prescription and prescription.status == "ISSUED" else "PENDING",
        },
        {
            "step": "FOLLOW_UP_PLAN",
            "title": f"Follow-Up Scheduled: {plan.due_date.strftime('%b %d, %Y')}",
            "date": plan.created_at.strftime("%b %d, %Y") if plan.created_at else "—",
            "status": "ACTIVE",
        },
    ]

    for c in reversed(checkins):
        timeline.append({
            "step": "PATIENT_CHECKIN",
            "title": f"Patient Check-in: {c.condition_status}",
            "date": c.submitted_at.strftime("%b %d, %Y %I:%M %p"),
            "status": c.flag,
            "notes": c.notes,
        })

    for r in reversed(reviews):
        timeline.append({
            "step": "DOCTOR_REVIEW",
            "title": f"Doctor Review: {r.next_action}",
            "date": r.reviewed_at.strftime("%b %d, %Y %I:%M %p"),
            "status": "REVIEWED",
            "notes": r.review_notes,
        })

    return {
        "plan": {
            "id": plan.id,
            "consultation_id": plan.consultation_id,
            "instruction": plan.instruction,
            "due_date": plan.due_date.strftime("%b %d, %Y"),
            "status": plan.status,
            "condition_monitoring": plan.condition_monitoring,
            "recommended_test_name": plan.recommended_test_name,
        },
        "patient": {
            "id": consultation.patient_id if consultation else plan.patient_id,
            "name": consultation.patient_name if consultation else "Patient",
            "age": consultation.patient_age if consultation else None,
            "gender": consultation.patient_gender if consultation else None,
        },
        "prescription": {
            "id": prescription.id if prescription else None,
            "status": prescription.status if prescription else "None",
            "items": [
                {
                    "medicine_name": i.medicine_name,
                    "dosage": i.dosage,
                    "frequency": i.frequency,
                    "duration": i.duration,
                }
                for i in (prescription.items if prescription else [])
            ],
        },
        "checkins": [
            {
                "id": c.id,
                "condition_status": c.condition_status,
                "notes": c.notes,
                "flag": c.flag,
                "submitted_at": c.submitted_at.strftime("%b %d, %Y %I:%M %p"),
            }
            for c in checkins
        ],
        "timeline": timeline,
    }


@router.post("/doctor/followup/{followup_plan_id}/review", summary="Doctor submits follow-up review")
def doctor_review_followup(
    followup_plan_id: str,
    payload: DoctorFollowUpReviewRequest,
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    plan = db.query(FollowUpPlan).filter(FollowUpPlan.id == followup_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Follow-up plan not found.")

    review = DoctorFollowUpReview(
        follow_up_plan_id=plan.id,
        doctor_id=current_user.id,
        review_notes=payload.review_notes,
        next_action=payload.next_action or "Maintain Current Plan",
    )
    db.add(review)

    # Mark plan as reviewed/active
    plan.status = "ACTIVE"

    _notify(
        db,
        user_id=plan.patient_id,
        title="Doctor Reviewed Your Follow-Up",
        message=f"Dr. {current_user.full_name} reviewed your check-in: {payload.next_action}.",
        ntype="info",
        related_type="followup_review",
        related_id=plan.id,
    )

    _audit(db, current_user.id, current_user.role, "DOCTOR_FOLLOW_UP_REVIEWED", "followup_plan", plan.id, {
        "next_action": payload.next_action,
    })
    db.commit()

    return {"success": True, "message": "Doctor review submitted."}


# ─── 8. PATIENT FOLLOW-UP OVERVIEW & HEALTH TIMELINE ─────────────────────────

@router.get("/patient/followup-overview", summary="Patient dashboard overview of all follow-ups, tasks, and check-ins")
def get_patient_followup_overview(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    patient_id = current_user.patient_id or current_user.id
    plans = (
        db.query(FollowUpPlan)
        .filter(FollowUpPlan.patient_id == patient_id)
        .order_by(FollowUpPlan.due_date.asc())
        .all()
    )

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    med_tasks = (
        db.query(MedicationTask)
        .filter(
            MedicationTask.patient_id == patient_id,
            (MedicationTask.scheduled_date == today_str) | (MedicationTask.scheduled_date == "")
        )
        .all()
    )

    general_tasks = (
        db.query(PatientTask)
        .filter(PatientTask.patient_id == patient_id, PatientTask.is_completed == False)  # noqa
        .order_by(PatientTask.due_date.asc())
        .all()
    )

    active_plan = next((p for p in plans if p.status in ["ACTIVE", "NEEDS_REVIEW", "HIGH_PRIORITY_REVIEW"]), None)

    return {
        "active_plan": {
            "id": active_plan.id,
            "instruction": active_plan.instruction,
            "due_date": active_plan.due_date.strftime("%b %d, %Y"),
            "condition_monitoring": active_plan.condition_monitoring,
            "recommended_test_name": active_plan.recommended_test_name,
        } if active_plan else None,
        "upcoming_followups": [
            {
                "id": p.id,
                "instruction": p.instruction,
                "due_date": p.due_date.strftime("%b %d, %Y"),
                "status": p.status,
            }
            for p in plans
        ],
        "medication_tasks": [
            {
                "id": m.id,
                "medicine_name": m.medicine_name,
                "dosage": m.dosage,
                "schedule_slot": m.schedule_slot,
                "due_time": m.due_time,
                "instructions": m.instructions,
                "status": m.status,
            }
            for m in med_tasks
        ],
        "general_tasks": [
            {
                "id": g.id,
                "task_type": g.task_type,
                "title": g.title,
                "description": g.description,
                "due_date": g.due_date.strftime("%b %d, %Y") if g.due_date else None,
            }
            for g in general_tasks
        ],
    }


@router.get("/patient/health-timeline", summary="Patient comprehensive care timeline")
def get_patient_health_timeline(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    patient_id = current_user.patient_id or current_user.id
    consultations = db.query(Consultation).filter(Consultation.patient_id == patient_id).order_by(Consultation.created_at.desc()).all()
    prescriptions = db.query(PrescriptionRecord).filter(PrescriptionRecord.patient_id == patient_id, PrescriptionRecord.status.in_(["APPROVED", "ISSUED"])).all()
    plans = db.query(FollowUpPlan).filter(FollowUpPlan.patient_id == patient_id).all()
    tests = db.query(InvestigationTracking).filter(InvestigationTracking.patient_id == patient_id).all()

    timeline = []
    for c in consultations:
        timeline.append({
            "type": "CONSULTATION",
            "title": f"Consultation with {c.doctor_name}",
            "date": c.created_at.strftime("%b %d, %Y") if c.created_at else "—",
            "details": f"Type: {c.consultation_type.capitalize()} | Status: {c.status}",
            "timestamp": c.created_at.isoformat() if c.created_at else None,
        })

    for p in prescriptions:
        med_names = ", ".join([i.medicine_name for i in p.items])
        timeline.append({
            "type": "PRESCRIPTION",
            "title": f"Prescription: {med_names or 'Medications'}",
            "date": p.issued_at.strftime("%b %d, %Y") if p.issued_at else p.created_at.strftime("%b %d, %Y"),
            "details": p.patient_instructions or "Follow dosage instructions.",
            "timestamp": p.issued_at.isoformat() if p.issued_at else p.created_at.isoformat(),
        })

    for f in plans:
        timeline.append({
            "type": "FOLLOW_UP",
            "title": f"Follow-Up Plan: {f.due_date.strftime('%b %d, %Y')}",
            "date": f.created_at.strftime("%b %d, %Y") if f.created_at else "—",
            "details": f.instruction,
            "timestamp": f.created_at.isoformat() if f.created_at else None,
        })

    for t in tests:
        timeline.append({
            "type": "TEST",
            "title": f"Test: {t.test_name}",
            "date": t.completed_at.strftime("%b %d, %Y") if t.completed_at else t.created_at.strftime("%b %d, %Y"),
            "details": f"Status: {t.status} | Reason: {t.reason}",
            "timestamp": t.completed_at.isoformat() if t.completed_at else t.created_at.isoformat(),
        })

    # Sort descending
    timeline.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return timeline


@router.post("/patient/investigations/{investigation_id}/complete", summary="Patient marks recommended test as completed")
def complete_investigation(
    investigation_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    inv = db.query(InvestigationTracking).filter(InvestigationTracking.id == investigation_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Test record not found.")

    inv.status = "COMPLETED"
    inv.completed_at = datetime.now(timezone.utc)

    # Notify doctor
    _notify(
        db,
        user_id=inv.doctor_id,
        title="Test Completed by Patient",
        message=f"Patient completed recommended test: {inv.test_name}.",
        ntype="info",
        related_type="investigation",
        related_id=inv.id,
    )

    db.commit()
    return {"success": True, "message": "Investigation marked as completed."}


# ─── 9. PATIENT HEALTH DASHBOARD & CARE JOURNEY DATA ────────────────────────

@router.get("/patient/dashboard-data", summary="Aggregated patient health dashboard data")
def get_patient_dashboard_data(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    patient_id = current_user.patient_id or current_user.id
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    hour = now.hour
    greeting = "Good morning" if hour < 12 else "Good afternoon" if hour < 18 else "Good evening"

    # 1. Upcoming Consultation
    consultation = (
        db.query(Consultation)
        .filter(Consultation.patient_id == patient_id)
        .order_by(Consultation.created_at.desc())
        .first()
    )
    upcoming_consultation = None
    if consultation:
        upcoming_consultation = {
            "id": consultation.id,
            "doctor_name": consultation.doctor_name,
            "specialization": "Telehealth Medicine",
            "type": consultation.consultation_type,
            "status": "Confirmed",
            "date": consultation.created_at.strftime("%b %d, %Y") if consultation.created_at else "Today",
            "time": "10:00 AM",
        }

    # 2. Medication Tasks for today
    med_tasks = (
        db.query(MedicationTask)
        .filter(
            MedicationTask.patient_id == patient_id,
            (MedicationTask.scheduled_date == today_str) | (MedicationTask.scheduled_date == "")
        )
        .order_by(MedicationTask.created_at.desc())
        .all()
    )
    medication_tasks_data = [
        {
            "id": m.id,
            "medicine_name": m.medicine_name,
            "dosage": m.dosage,
            "schedule_slot": m.schedule_slot,
            "due_time": m.due_time,
            "instructions": m.instructions,
            "status": m.status,
            "taken_at": m.taken_at.isoformat() if m.taken_at else None,
        }
        for m in med_tasks
    ]

    # 3. Active Follow-Up Plan
    plan = (
        db.query(FollowUpPlan)
        .filter(FollowUpPlan.patient_id == patient_id)
        .order_by(FollowUpPlan.due_date.asc())
        .first()
    )
    followup_data = None
    if plan:
        followup_data = {
            "id": plan.id,
            "doctor_name": consultation.doctor_name if consultation else "Dr. Clinical Specialist",
            "due_date": plan.due_date.strftime("%b %d, %Y"),
            "instruction": plan.instruction,
            "status": plan.status,
            "is_checkin_due": plan.status in ["ACTIVE", "NEEDS_REVIEW", "HIGH_PRIORITY_REVIEW"],
        }

    # 4. Recent Health Activities
    recent_activities = [
        {
            "id": "act_1",
            "title": "Telehealth Consultation Completed",
            "timestamp": "Today, 10:45 AM",
            "icon": "video",
        },
        {
            "id": "act_2",
            "title": "Prescription Issued by Doctor",
            "timestamp": "Today, 11:00 AM",
            "icon": "rx",
        },
        {
            "id": "act_3",
            "title": "Follow-Up Care Plan Created",
            "timestamp": "Today, 11:05 AM",
            "icon": "clock",
        },
    ]

    # 5. Today's Care Items
    todays_care = []
    for m in med_tasks:
        todays_care.append({
            "type": "MEDICATION",
            "time": m.due_time or "08:00 AM",
            "title": m.medicine_name,
            "subtitle": f"{m.dosage} • {m.instructions or 'Take after food'}",
            "status": m.status,
            "action_id": m.id,
        })
    if upcoming_consultation:
        todays_care.append({
            "type": "APPOINTMENT",
            "time": "10:00 AM",
            "title": f"Consultation with {upcoming_consultation['doctor_name']}",
            "subtitle": "Telehealth Video Consultation",
            "status": "CONFIRMED",
            "action_id": upcoming_consultation["id"],
        })
    if followup_data:
        todays_care.append({
            "type": "FOLLOW_UP",
            "time": "06:00 PM",
            "title": "Condition Check-in",
            "subtitle": followup_data["instruction"],
            "status": "DUE",
            "action_id": followup_data["id"],
        })

    # Sort today's care chronologically
    todays_care.sort(key=lambda x: x["time"])

    return {
        "greeting": greeting,
        "patient_name": current_user.full_name or "Patient",
        "subtitle": "Here's your care journey.",
        "upcoming_consultation": upcoming_consultation,
        "medication_tasks": medication_tasks_data,
        "follow_up": followup_data,
        "recent_activities": recent_activities,
        "todays_care": todays_care,
    }


@router.get("/patient/care-journey", summary="Patient Care Journey structured stages")
def get_patient_care_journey(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    patient_id = current_user.patient_id or current_user.id
    consultation = db.query(Consultation).filter(Consultation.patient_id == patient_id).order_by(Consultation.created_at.desc()).first()
    note = db.query(ClinicalNote).filter(ClinicalNote.patient_id == patient_id).order_by(ClinicalNote.created_at.desc()).first()
    rx = db.query(PrescriptionRecord).filter(PrescriptionRecord.patient_id == patient_id).order_by(PrescriptionRecord.created_at.desc()).first()
    plan = db.query(FollowUpPlan).filter(FollowUpPlan.patient_id == patient_id).order_by(FollowUpPlan.created_at.desc()).first()
    checkin = db.query(PatientCheckIn).filter(PatientCheckIn.patient_id == patient_id).order_by(PatientCheckIn.submitted_at.desc()).first()
    review = db.query(DoctorFollowUpReview).order_by(DoctorFollowUpReview.reviewed_at.desc()).first()

    stages = [
        {
            "step": 1,
            "key": "CONSULTATION",
            "title": "Google Meet Consultation",
            "doctor": consultation.doctor_name if consultation else "Dr. Clinical Specialist",
            "date": consultation.created_at.strftime("%b %d, %Y") if consultation and consultation.created_at else "Completed",
            "status": "COMPLETED" if consultation else "PENDING",
            "action_label": "View Consultation",
            "action_url": f"/consultations/{consultation.id}" if consultation else None,
        },
        {
            "step": 2,
            "key": "CLINICAL_REVIEW",
            "title": "Clinical Documentation Signed",
            "doctor": note.approved_by if note and note.approved_by else "Dr. Clinical Specialist",
            "date": note.approved_at.strftime("%b %d, %Y") if note and note.approved_at else "Under Review",
            "status": "COMPLETED" if note and note.status == "APPROVED" else "IN_PROGRESS",
            "action_label": "View Summary",
            "action_url": "/patient/health-timeline",
        },
        {
            "step": 3,
            "key": "PRESCRIPTION",
            "title": "Prescription Issued",
            "doctor": rx.doctor_name if rx and rx.doctor_name else "Dr. Clinical Specialist",
            "date": rx.issued_at.strftime("%b %d, %Y") if rx and rx.issued_at else "Active",
            "status": "COMPLETED" if rx and rx.status == "ISSUED" else "PENDING",
            "action_label": "View Prescription",
            "action_url": "/patient/medications",
        },
        {
            "step": 4,
            "key": "CARE_PLAN",
            "title": "Personalized Care Plan",
            "doctor": "Care Team",
            "date": plan.created_at.strftime("%b %d, %Y") if plan and plan.created_at else "Active",
            "status": "COMPLETED" if plan else "PENDING",
            "action_label": "View Care Plan",
            "action_url": "/patient/follow-up",
        },
        {
            "step": 5,
            "key": "PATIENT_TASKS",
            "title": "Daily Patient Medication & Tasks",
            "doctor": "Patient Self-Care",
            "date": "Ongoing",
            "status": "IN_PROGRESS",
            "action_label": "Today's Tasks",
            "action_url": "/patient/medications",
        },
        {
            "step": 6,
            "key": "FOLLOW_UP",
            "title": "Condition Check-in & Signal",
            "doctor": "Patient Reported",
            "date": checkin.submitted_at.strftime("%b %d, %Y") if checkin else "Scheduled",
            "status": "COMPLETED" if checkin else "DUE",
            "action_label": "Check In Now" if not checkin else "View Response",
            "action_url": f"/patient/follow-up/{plan.id}/check-in" if plan else "/patient/follow-up",
        },
        {
            "step": 7,
            "key": "DOCTOR_REVIEW",
            "title": "Doctor Care Evaluation",
            "doctor": "Attending Physician",
            "date": review.reviewed_at.strftime("%b %d, %Y") if review else "Pending Check-In",
            "status": "COMPLETED" if review else "PENDING",
            "action_label": "View Review Notes",
            "action_url": "/patient/health-timeline",
        },
    ]

    return {"stages": stages}


@router.get("/patient/calendar-events", summary="Patient calendar events for Month/Week/Agenda views")
def get_patient_calendar_events(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    patient_id = current_user.patient_id or current_user.id
    consultations = db.query(Consultation).filter(Consultation.patient_id == patient_id).all()
    plans = db.query(FollowUpPlan).filter(FollowUpPlan.patient_id == patient_id).all()
    tests = db.query(InvestigationTracking).filter(InvestigationTracking.patient_id == patient_id).all()
    tasks = db.query(MedicationTask).filter(MedicationTask.patient_id == patient_id).all()

    events = []
    for c in consultations:
        events.append({
            "id": f"c_{c.id}",
            "title": f"Consultation: {c.doctor_name}",
            "date": c.created_at.strftime("%Y-%m-%d") if c.created_at else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "time": "10:00 AM",
            "category": "appointment",
            "status": "Confirmed",
            "type": c.consultation_type,
        })

    for p in plans:
        events.append({
            "id": f"p_{p.id}",
            "title": "Follow-Up Review Target",
            "date": p.due_date.strftime("%Y-%m-%d"),
            "time": "06:00 PM",
            "category": "followup",
            "status": p.status,
            "instruction": p.instruction,
        })

    for t in tests:
        events.append({
            "id": f"t_{t.id}",
            "title": f"Lab Test: {t.test_name}",
            "date": t.due_date.strftime("%Y-%m-%d") if t.due_date else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "time": "09:00 AM",
            "category": "test",
            "status": t.status,
        })

    for m in tasks:
        events.append({
            "id": f"m_{m.id}",
            "title": f"Medication: {m.medicine_name}",
            "date": m.scheduled_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "time": m.due_time or "08:00 AM",
            "category": "medication",
            "status": m.status,
        })

    return events


@router.get("/patient/documents", summary="Patient authorized clinical documents center")
def get_patient_documents(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    patient_id = current_user.patient_id or current_user.id
    consultations = db.query(Consultation).filter(Consultation.patient_id == patient_id).all()
    prescriptions = db.query(PrescriptionRecord).filter(PrescriptionRecord.patient_id == patient_id, PrescriptionRecord.status.in_(["APPROVED", "ISSUED"])).all()
    notes = db.query(ClinicalNote).filter(ClinicalNote.patient_id == patient_id, ClinicalNote.status == "APPROVED").all()

    docs = []
    for rx in prescriptions:
        docs.append({
            "id": rx.id,
            "category": "Prescription",
            "title": f"Prescription — Dr. {rx.doctor_name}",
            "date": rx.issued_at.strftime("%b %d, %Y") if rx.issued_at else rx.created_at.strftime("%b %d, %Y"),
            "format": "PDF / Clinical Record",
            "summary": rx.patient_instructions or "Authorized prescription with daily dosage schedule.",
        })

    for n in notes:
        docs.append({
            "id": n.id,
            "category": "Consultation Summary",
            "title": f"Clinical SOAP Summary — {n.chief_complaint}",
            "date": n.approved_at.strftime("%b %d, %Y") if n.approved_at else n.created_at.strftime("%b %d, %Y"),
            "format": "Approved Clinical Note",
            "summary": f"Approved by {n.approved_by}.",
        })

    return docs


@router.get("/doctor/patients/{patient_id}", summary="[DOCTOR] Get authorized patient clinical summary and history")
def get_doctor_patient_detail(
    patient_id: str,
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    patient = db.query(User).filter((User.patient_id == patient_id) | (User.id == patient_id)).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    consultations = db.query(Consultation).filter(Consultation.patient_id == patient.patient_id or patient.id).order_by(Consultation.created_at.desc()).all()
    prescriptions = db.query(PrescriptionRecord).filter(PrescriptionRecord.patient_id == patient.patient_id or patient.id).order_by(PrescriptionRecord.created_at.desc()).all()
    plans = db.query(FollowUpPlan).filter(FollowUpPlan.patient_id == patient.patient_id or patient.id).order_by(FollowUpPlan.due_date.asc()).all()

    return {
        "patient": {
            "id": patient.patient_id or patient.id,
            "name": patient.full_name,
            "email": patient.email,
            "role": patient.role,
            "created_at": patient.created_at.strftime("%b %d, %Y") if patient.created_at else None,
        },
        "consultations": [
            {
                "id": c.id,
                "type": c.consultation_type,
                "doctor_name": c.doctor_name,
                "duration_seconds": c.duration_seconds,
                "status": c.status,
                "date": c.created_at.strftime("%b %d, %Y") if c.created_at else None,
            }
            for c in consultations
        ],
        "prescriptions": [
            {
                "id": p.id,
                "status": p.status,
                "issued_at": p.issued_at.strftime("%b %d, %Y") if p.issued_at else None,
                "items_count": len(p.items),
            }
            for p in prescriptions
        ],
        "follow_ups": [
            {
                "id": f.id,
                "instruction": f.instruction,
                "due_date": f.due_date.strftime("%b %d, %Y"),
                "status": f.status,
            }
            for f in plans
        ],
    }

