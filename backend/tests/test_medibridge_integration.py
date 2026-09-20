"""
Comprehensive Integration Test Suite for MediBridge AI
Validates the complete clinical consultation workflow, security, follow-up intelligence, and chatbot grounding.
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.db.database import engine, Base

# Ensure all database tables are created
Base.metadata.create_all(bind=engine)

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "MediBridge AI" in data["service"]

def test_auth_and_roles():
    # 1. Register a doctor
    doc_email = f"doc_test_{os.urandom(3).hex()}@hospital.org"
    reg_resp = client.post("/api/auth/register", json={
        "email": doc_email,
        "password": "SecurePassword123!",
        "full_name": "Dr. Sarah Chen",
        "role": "DOCTOR",
        "specialty": "Cardiology"
    })
    assert reg_resp.status_code in (200, 201)
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["role"] == "DOCTOR"
    doc_token = reg_data["access_token"]

    # 2. Login
    login_resp = client.post("/api/auth/login", json={
        "email": doc_email,
        "password": "SecurePassword123!"
    })
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()

    # 3. Verify /api/auth/me
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {doc_token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == doc_email

    # 4. Register Admin and verify admin overview
    admin_email = f"admin_{os.urandom(3).hex()}@hospital.org"
    admin_reg = client.post("/api/auth/register", json={
        "email": admin_email,
        "password": "AdminPassword123!",
        "full_name": "System Administrator",
        "role": "ADMIN"
    })
    assert admin_reg.status_code in (200, 201)
    admin_token = admin_reg.json()["access_token"]

    admin_overview = client.get("/api/admin/overview", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_overview.status_code == 200
    assert admin_overview.json()["status"] == "healthy"
    assert "total_users" in admin_overview.json()["metrics"]

def test_complete_consultation_workflow():
    # 1. Create a consultation with a realistic transcript (Tamil/English code-mixed)
    sample_transcript = """Doctor: Good morning Priya. Ungalukku eppadi irukku? How is your knee pain?
Patient: Doctor, romba valikudhu past 3 days-a. Right knee is swollen and I cannot climb stairs easily.
Doctor: I see the swelling. Take Ibuprofen 400mg twice daily after food for 5 days. We need an X-Ray of the right knee. Please come back for follow-up in 10 days."""

    create_resp = client.post("/api/consultations", json={
        "patient_name": "Priya Sharma",
        "patient_id": "P-TEST-101",
        "doctor_name": "Dr. Rajesh Kumar",
        "consultation_type": "IN_PERSON",
        "transcript": sample_transcript,
        "detected_language": "Tamil / English"
    })
    assert create_resp.status_code in (200, 201)

    cons_data = create_resp.json()
    cons_id = cons_data["id"]
    assert cons_data["detected_language"] == "Tamil / English"
    assert cons_data["patient_name"] == "Priya Sharma"

    # 2. Trigger AI Summarization & Extraction
    sum_resp = client.post(f"/api/consultations/{cons_id}/summarize")
    assert sum_resp.status_code == 200
    summary_data = sum_resp.json()
    assert summary_data["consultation_id"] == cons_id
    assert "medications" in summary_data
    assert "follow_up" in summary_data
    assert summary_data["follow_up"]["interval_days"] is not None or summary_data["follow_up"]["date_str"] is not None


    # 3. Doctor Finalize & Confirmation
    finalize_payload = {
        "chief_complaint": summary_data.get("chief_complaint"),
        "symptoms": summary_data.get("symptoms", []),
        "medications": summary_data.get("medications", []),
        "investigations": summary_data.get("investigations", []),
        "follow_up": summary_data.get("follow_up", {}),
        "approved_by": "Dr. Rajesh Kumar"
    }
    fin_resp = client.post(f"/api/consultations/{cons_id}/finalize", json=finalize_payload)
    assert fin_resp.status_code == 200
    fin_data = fin_resp.json()
    assert fin_data["success"] is True
    assert "routing" in fin_data


    # 4. Grounded Chatbot Q&A
    chat_resp_1 = client.post(f"/api/consultations/{cons_id}/chat", json={
        "question": "What medication was prescribed and what is the dosage?"
    })
    assert chat_resp_1.status_code == 200
    ans_1 = chat_resp_1.json()
    assert ans_1["is_grounded"] is True
    assert "Ibuprofen" in ans_1["answer"] or "400mg" in ans_1["answer"]

    # Test out-of-scope question (Strict zero hallucination)
    chat_resp_2 = client.post(f"/api/consultations/{cons_id}/chat", json={
        "question": "What is my cholesterol level?"
    })
    assert chat_resp_2.status_code == 200
    ans_2 = chat_resp_2.json()
    assert "could not find that information" in ans_2["answer"].lower()

    # 5. Dynamic Patient Timeline
    timeline_resp = client.get("/api/patients/P-TEST-101/timeline")
    assert timeline_resp.status_code == 200
    timeline = timeline_resp.json()
    assert timeline["patient_id"] == "P-TEST-101"
    assert len(timeline["timeline_events"]) >= 1
    assert len(timeline["active_medications"]) >= 1
    assert any("Ibuprofen" in m["drug_name"] for m in timeline["active_medications"])


    # 6. Follow-up Hub & Lifecycle status update
    fu_resp = client.get("/api/followups")
    assert fu_resp.status_code == 200
    followups_data = fu_resp.json()
    all_fus = (
        followups_data.get("upcoming", [])
        + followups_data.get("pending_confirmation", [])
        + followups_data.get("today", [])
    )
    patient_fu = next((f for f in all_fus if f["patient_id"] == "P-TEST-101"), None)
    assert patient_fu is not None
    assert patient_fu["status"] == "CONFIRMED"

    # Update follow up status to COMPLETED
    update_fu = client.patch(f"/api/followups/{patient_fu['id']}/status", json={
        "status": "COMPLETED"
    })
    assert update_fu.status_code == 200
    assert update_fu.json()["new_status"] == "COMPLETED"


def test_demo_scenarios():
    resp = client.get("/api/demo/scenarios")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 3
    for item in data:
        assert item["is_demo"] is True
        assert "disclaimer" in item
