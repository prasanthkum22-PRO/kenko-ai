"""
KENKO-AI Comprehensive Post-Consultation Clinical Workspace, Prescription & Follow-Up Tests
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, init_db
from app.models.db_models import (
    User, Consultation, TranscriptSegment, ClinicalNote,
    PrescriptionRecord, PrescriptionRecordItem, MedicationTask,
    FollowUpPlan, PatientCheckIn, DoctorFollowUpReview,
    InvestigationTracking, AuditLog, UserNotification
)
from app.utils.auth import hash_password, create_access_token

init_db()
client = TestClient(app)


@pytest.fixture
def test_setup():
    db = SessionLocal()

    # Create test doctor
    doctor = db.query(User).filter(User.email == "doctor.clinical.test@kenko.ai").first()
    if not doctor:
        doctor = User(
            email="doctor.clinical.test@kenko.ai",
            hashed_password=hash_password("DoctorPass123!"),
            full_name="Dr. Clinical Specialist",
            role="DOCTOR",
            doctor_id="DOC-TEST-001",
        )
        db.add(doctor)
        db.commit()
        db.refresh(doctor)

    doc_token = create_access_token(data={"sub": doctor.id, "email": doctor.email, "role": doctor.role})
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    # Create test patient
    patient = db.query(User).filter(User.email == "patient.clinical.test@kenko.ai").first()
    if not patient:
        patient = User(
            email="patient.clinical.test@kenko.ai",
            hashed_password=hash_password("PatientPass123!"),
            full_name="Jane Doe",
            role="PATIENT",
            patient_id="PAT-TEST-001",
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

    pat_token = create_access_token(data={"sub": patient.id, "email": patient.email, "role": patient.role})
    pat_headers = {"Authorization": f"Bearer {pat_token}"}

    # Create test consultation
    consultation = db.query(Consultation).filter(Consultation.patient_id == "PAT-TEST-001").first()
    if not consultation:
        consultation = Consultation(
            patient_id="PAT-TEST-001",
            patient_name="Jane Doe",
            patient_age=34,
            patient_gender="Female",
            doctor_id=doctor.id,
            doctor_name="Dr. Clinical Specialist",
            consultation_type="video",
            status="transcript_ready",
            duration_seconds=480,
            has_consent=True,
        )
        db.add(consultation)
        db.commit()
        db.refresh(consultation)

        # Add transcript segments
        db.add(TranscriptSegment(
            consultation_id=consultation.id,
            speaker="Doctor",
            start_time=0.0,
            end_time=5.0,
            text="Hello Jane, what symptoms are you having today?",
        ))
        db.add(TranscriptSegment(
            consultation_id=consultation.id,
            speaker="Patient",
            start_time=5.5,
            end_time=12.0,
            text="I have had fever, headache, and severe sore throat for 4 days.",
        ))
        db.add(TranscriptSegment(
            consultation_id=consultation.id,
            speaker="Doctor",
            start_time=12.5,
            end_time=22.0,
            text="Take Paracetamol 650mg twice daily for 5 days. Get a CBC blood test and follow up in 7 days.",
        ))
        db.commit()

    consultation_id = consultation.id
    db.close()

    return {
        "consultation_id": consultation_id,
        "doc_headers": doc_headers,
        "pat_headers": pat_headers,
        "doctor": doctor,
        "patient": patient,
    }


def test_clinical_workspace_endpoint_and_transcript(test_setup):
    cid = test_setup["consultation_id"]
    response = client.get(
        f"/api/clinical/consultations/{cid}/workspace",
        headers=test_setup["doc_headers"]
    )
    assert response.status_code == 200
    data = response.json()
    assert data["consultation"]["id"] == cid
    assert data["consultation"]["has_transcript"] is True
    assert len(data["transcript"]) >= 3


def test_add_transcript_annotation(test_setup):
    cid = test_setup["consultation_id"]
    response = client.post(
        f"/api/clinical/consultations/{cid}/transcript-notes",
        json={"transcript_entry_id": "seg_test_1", "note": "Patient presents with acute pharyngitis signs."},
        headers=test_setup["doc_headers"]
    )
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_ai_clinical_summary_generation_and_soap(test_setup):
    cid = test_setup["consultation_id"]
    response = client.post(
        f"/api/clinical/consultations/{cid}/generate-summary",
        headers=test_setup["doc_headers"]
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    note = data["clinical_note"]
    assert note["is_ai_generated"] is True
    assert "symptoms" in note
    assert "subjective" in note["soap"]
    assert "plan" in note["soap"]


def test_clinical_note_draft_and_approval(test_setup):
    cid = test_setup["consultation_id"]
    # Save draft
    draft_res = client.post(
        f"/api/clinical/consultations/{cid}/clinical-note/save-draft",
        json={
            "chief_complaint": "Acute Pharyngitis & Fever",
            "hpi": "Fever for 4 days",
            "soap_subjective": "S: Fever, sore throat x 4 days",
            "soap_objective": "O: Throat inflamed, Temp 100.2F",
            "soap_assessment": "A: Acute viral pharyngitis",
            "soap_plan": "P: Paracetamol 650mg PO BID, CBC, Follow-up 7d",
            "doctor_notes": "Internal: Patient allergic to penicillin.",
        },
        headers=test_setup["doc_headers"]
    )
    assert draft_res.status_code == 200

    # Approve note
    approve_res = client.post(
        f"/api/clinical/consultations/{cid}/clinical-note/approve",
        headers=test_setup["doc_headers"]
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["success"] is True


def test_prescription_studio_and_issue_workflow(test_setup):
    cid = test_setup["consultation_id"]
    # Save prescription draft
    save_res = client.post(
        f"/api/clinical/consultations/{cid}/prescription/save-draft",
        json={
            "items": [
                {
                    "medicine_name": "Paracetamol",
                    "dosage": "650mg",
                    "frequency": "1-0-1",
                    "duration": "5 days",
                    "route": "Oral",
                    "instructions": "After meals",
                    "is_ai_suggested": False,
                    "doctor_confirmed": True,
                }
            ],
            "internal_doctor_notes": "Monitor hepatic enzymes if symptoms persist.",
            "patient_instructions": "Drink plenty of fluids and rest.",
        },
        headers=test_setup["doc_headers"]
    )
    assert save_res.status_code == 200

    # Approve prescription
    app_res = client.post(
        f"/api/clinical/consultations/{cid}/prescription/approve",
        headers=test_setup["doc_headers"]
    )
    assert app_res.status_code == 200

    # Issue prescription (generates medication tasks)
    issue_res = client.post(
        f"/api/clinical/consultations/{cid}/prescription/issue",
        headers=test_setup["doc_headers"]
    )
    assert issue_res.status_code == 200
    assert issue_res.json()["success"] is True


def test_patient_prescriptions_and_medication_tasks(test_setup):
    # Patient Prescriptions view (sanitizes private doctor notes)
    rx_res = client.get(
        "/api/clinical/patient/prescriptions",
        headers=test_setup["pat_headers"]
    )
    assert rx_res.status_code == 200
    rxs = rx_res.json()
    assert isinstance(rxs, list)

    # Patient Medication Tasks
    tasks_res = client.get(
        "/api/clinical/patient/medication-tasks",
        headers=test_setup["pat_headers"]
    )
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()
    assert isinstance(tasks, list)
    if len(tasks) > 0:
        task_id = tasks[0]["id"]
        # Mark as taken
        up_res = client.post(
            f"/api/clinical/patient/medication-tasks/{task_id}/status",
            json={"status": "TAKEN"},
            headers=test_setup["pat_headers"]
        )
        assert up_res.status_code == 200
        assert up_res.json()["success"] is True


def test_followup_plan_and_checkin_lifecycle(test_setup):
    cid = test_setup["consultation_id"]
    # Create Follow-Up Plan + Recommended Test
    create_res = client.post(
        f"/api/clinical/consultations/{cid}/followup-plan",
        json={
            "instruction": "Review CBC lab report and evaluate throat recovery.",
            "interval_days": 7,
            "condition_monitoring": "Temperature and throat symptom tracking",
            "recommended_test_name": "Complete Blood Count (CBC)",
            "test_reason": "Infection evaluation",
        },
        headers=test_setup["doc_headers"]
    )
    assert create_res.status_code == 200

    # Patient Follow-up overview
    overview_res = client.get(
        "/api/clinical/patient/followup-overview",
        headers=test_setup["pat_headers"]
    )
    assert overview_res.status_code == 200
    overview = overview_res.json()
    assert overview["active_plan"] is not None
    plan_id = overview["active_plan"]["id"]

    # Patient submits condition check-in: RECOVERING
    checkin_rec = client.post(
        "/api/clinical/patient/checkin",
        json={
            "follow_up_plan_id": plan_id,
            "condition_status": "RECOVERING",
            "notes": "Fever resolved, mild throat tickle remaining.",
        },
        headers=test_setup["pat_headers"]
    )
    assert checkin_rec.status_code == 200
    assert checkin_rec.json()["flag"] == "NORMAL"

    # Patient submits condition check-in: WORSENING (triggers HIGH_PRIORITY_DOCTOR_REVIEW)
    checkin_worse = client.post(
        "/api/clinical/patient/checkin",
        json={
            "follow_up_plan_id": plan_id,
            "condition_status": "WORSENING",
            "notes": "Fever spiked to 102F and difficulty swallowing.",
        },
        headers=test_setup["pat_headers"]
    )
    assert checkin_worse.status_code == 200
    assert checkin_worse.json()["flag"] == "HIGH_PRIORITY_DOCTOR_REVIEW"

    # Doctor Follow-up Dashboard contains the plan
    dash_res = client.get(
        "/api/clinical/doctor/followup-dashboard?filter_by=high_priority",
        headers=test_setup["doc_headers"]
    )
    assert dash_res.status_code == 200
    dash = dash_res.json()
    assert len(dash["plans"]) >= 1

    # Doctor Follow-up Detail & Care Timeline
    detail_res = client.get(
        f"/api/clinical/doctor/followup/{plan_id}",
        headers=test_setup["doc_headers"]
    )
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert len(detail["timeline"]) >= 3

    # Doctor reviews the check-in
    review_res = client.post(
        f"/api/clinical/doctor/followup/{plan_id}/review",
        json={
            "review_notes": "Evaluated high fever response. Advised immediate hydration and in-person review.",
            "next_action": "Schedule In-Person Consultation",
        },
        headers=test_setup["doc_headers"]
    )
    assert review_res.status_code == 200


def test_patient_health_timeline(test_setup):
    response = client.get(
        "/api/clinical/patient/health-timeline",
        headers=test_setup["pat_headers"]
    )
    assert response.status_code == 200
    timeline = response.json()
    assert isinstance(timeline, list)


def test_audit_log_events_recorded():
    db = SessionLocal()
    audit_events = db.query(AuditLog).all()
    actions = [a.action for a in audit_events]
    assert "CLINICAL_NOTE_APPROVED" in actions or "PRESCRIPTION_ISSUED" in actions or "FOLLOW_UP_CREATED" in actions
    db.close()
