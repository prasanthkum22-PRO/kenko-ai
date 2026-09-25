"""
KENKO-AI Backend Test Suite
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import Base, engine, SessionLocal, init_db
from app.services.clinical_ai import clinical_ai_service
from app.services.prescription_parser import parse_prescription_text

# Ensure DB tables exist for tests
init_db()

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json().get("status") == "ok"



def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert "differentiator" in response.json()


def test_clinical_ai_zero_hallucination():
    segments = [
        {"speaker": "Doctor", "start_time": 0.0, "end_time": 4.0, "text": "What symptoms do you have?"},
        {"speaker": "Patient", "start_time": 4.5, "end_time": 9.0, "text": "I have had fever and cough for 3 days."},
        {"speaker": "Doctor", "start_time": 9.5, "end_time": 15.0, "text": "Take Paracetamol 650mg twice a day for 5 days. Follow up in 7 days."},
    ]
    summary = clinical_ai_service.extract_summary(segments)

    assert len(summary["symptoms"]) == 2
    assert summary["symptoms"][0]["name"] in ["Fever", "Cough"]
    assert summary["symptoms"][0]["quote"] is not None
    assert summary["vitals"]["bp"] in ["Not mentioned", "Not documented"]
    assert summary["vitals"]["pulse"] in ["Not mentioned", "Not documented"]
    assert summary["history"]["allergies"] in ["Not mentioned", "Not documented", "No known allergies documented"]


    assert len(summary["medications"]) >= 1
    assert summary["medications"][0]["name"] == "Paracetamol"
    assert summary["follow_up"]["interval_days"] == 7


def test_prescription_parser():
    ocr_text = """
    Dr. Aarav Patel MBBS MD
    City Health Clinic
    Date: 18/09/2026
    Patient Name: Aarav Sharma  Age: 38  Sex: Male
    Rx:
    1. Tab. Telmisartan 40mg 1-0-0 30 days
    2. Tab. Metformin 500mg 1-0-1 30 days
    Tests: Fasting Blood Sugar, Lipid Profile
    Review in 14 days
    """
    parsed = parse_prescription_text(ocr_text)

    assert "Aarav" in parsed["patient_name"]
    assert "Patel" in parsed["doctor_name"]
    assert len(parsed["medicines"]) >= 1
    assert len(parsed["investigations"]) >= 1


def test_consultations_lifecycle_api():
    # 1. Create Consultation
    create_res = client.post(
        "/api/consultations",
        json={
            "patient_id": "TEST-P01",
            "patient_name": "Test Patient",
            "patient_age": 45,
            "patient_gender": "Male",
            "doctor_name": "Dr. Aarav Patel",
            "consultation_type": "in_person",
            "has_consent": True,
        },
    )
    assert create_res.status_code == 200
    consultation_id = create_res.json()["id"]

    # 2. Update transcript
    put_trans_res = client.put(
        f"/api/consultations/{consultation_id}/transcript",
        json={
            "segments": [
                {"speaker": "Doctor", "start_time": 0.0, "end_time": 3.0, "text": "Hello, how are you feeling?", "confidence": 0.98},
                {"speaker": "Patient", "start_time": 3.5, "end_time": 7.0, "text": "I have headache and high blood pressure.", "confidence": 0.95},
                {"speaker": "Doctor", "start_time": 7.5, "end_time": 12.0, "text": "Your BP is 140/90 mmHg. Take Telmisartan 40mg once a day. Review in 7 days.", "confidence": 0.97},
            ]
        },
    )
    assert put_trans_res.status_code == 200

    # 3. Summarize
    sum_res = client.post(f"/api/consultations/{consultation_id}/summarize")
    assert sum_res.status_code == 200
    summary_data = sum_res.json()
    assert summary_data["vitals"]["bp"] == "140/90 mmHg"

    # 4. Finalize & Auto-Route
    fin_res = client.post(
        f"/api/consultations/{consultation_id}/finalize",
        json={
            "approved_by": "Dr. Aarav Patel",
        },
    )
    assert fin_res.status_code == 200
    routing = fin_res.json()["routing"]
    assert routing["medications_recorded"] >= 1
    assert routing["follow_ups_created"] >= 1


def test_followup_intelligence_api():
    res = client.get("/api/followups")
    assert res.status_code == 200
    data = res.json()
    assert "today" in data
    assert "upcoming" in data
    assert "overdue" in data
    assert "pending_lab_tests" in data


def test_role_dashboards_api():
    doc_res = client.get("/api/doctor/workspace")
    assert doc_res.status_code == 200
    assert "metrics" in doc_res.json()

    nurse_res = client.get("/api/nurse/tasks")
    assert nurse_res.status_code == 200

    lab_res = client.get("/api/lab/tasks")
    assert lab_res.status_code == 200
