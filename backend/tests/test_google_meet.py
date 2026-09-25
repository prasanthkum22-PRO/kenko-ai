"""
MediBridge AI — Google Meet v2 Integration Tests
Tests Google OAuth flow, Space creation, meeting status tracking,
participant speaker mapping, transcript pagination & synchronization, and clinical AI summarization.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.models.db_models import User, Consultation, TranscriptSegment, GoogleOAuthToken
from app.utils.auth import hash_password, create_access_token
from app.services.participant_service import participant_service

# Use in-memory SQLite database for isolated test runs
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def doctor_auth(db_session):
    user = User(
        email="doctor.test@medibridge.ai",
        hashed_password=hash_password("DoctorSecret123!"),
        full_name="Dr. Aarav Patel",
        role="DOCTOR",
        doctor_id="D-101",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    return {"user": user, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


def test_google_oauth_endpoints(client, doctor_auth):
    """Test OAuth authorization URL generation and status check."""
    # 1. Check Auth Status (initially mock/not connected)
    res_status = client.get("/api/google/status", headers=doctor_auth["headers"])
    assert res_status.status_code == 200
    data = res_status.json()
    assert "is_connected" in data

    # 2. Get Auth URL
    res_auth = client.get("/api/google/auth", headers=doctor_auth["headers"])
    assert res_auth.status_code == 200
    auth_data = res_auth.json()
    assert "auth_url" in auth_data
    assert "state" in auth_data


def test_participant_speaker_mapping():
    """Test ParticipantService accurately identifies Doctor vs Patient without guessing."""
    # Test Doctor mapping by display name
    doc_participant = {"signedinUser": {"displayName": "Dr. Aarav Patel", "user": "users/123"}}
    role = participant_service.map_participant_to_role(
        participant_data=doc_participant,
        doctor_name="Dr. Aarav Patel",
        patient_name="Priya Sharma",
    )
    assert role == "DOCTOR"

    # Test Patient mapping by display name
    pat_participant = {"signedinUser": {"displayName": "Priya Sharma", "user": "users/456"}}
    role = participant_service.map_participant_to_role(
        participant_data=pat_participant,
        doctor_name="Dr. Aarav Patel",
        patient_name="Priya Sharma",
    )
    assert role == "PATIENT"

    # Test Unknown / unmapped participant
    unk_participant = {"anonymousUser": {"displayName": "Anonymous Guest"}}
    role = participant_service.map_participant_to_role(
        participant_data=unk_participant,
        doctor_name="Dr. Aarav Patel",
        patient_name="Priya Sharma",
    )
    assert role == "UNKNOWN"


def test_create_google_meet_and_transcript_sync(client, doctor_auth, db_session):
    """Test end-to-end Google Meet Space creation, status checking, and transcript synchronization."""
    # 1. Initialize Consultation
    c_res = client.post(
        "/api/consultations",
        json={
            "patient_id": "P-2026",
            "patient_name": "Rohan Verma",
            "patient_age": 42,
            "patient_gender": "Male",
            "doctor_name": "Dr. Aarav Patel",
            "consultation_type": "video",
            "has_consent": True,
        },
        headers=doctor_auth["headers"],
    )
    assert c_res.status_code == 200
    consultation_id = c_res.json()["id"]

    # 2. Call POST /api/meet/create
    meet_res = client.post(
        "/api/meet/create",
        json={"consultationId": consultation_id, "patientId": "P-2026"},
        headers=doctor_auth["headers"],
    )
    assert meet_res.status_code == 200
    meet_data = meet_res.json()
    assert meet_data["success"] is True
    assert meet_data["consultationId"] == consultation_id
    assert "spaces/" in meet_data["spaceName"]
    assert "meet.google.com" in meet_data["meetingUri"]

    # 3. Check GET /api/meet/{consultationId}/status
    status_res = client.get(f"/api/meet/{consultation_id}/status", headers=doctor_auth["headers"])
    assert status_res.status_code == 200
    assert status_res.json()["spaceName"] == meet_data["spaceName"]

    # 4. End Call POST /api/meet/{consultationId}/end
    end_res = client.post(f"/api/meet/{consultation_id}/end", headers=doctor_auth["headers"])
    assert end_res.status_code == 200
    assert end_res.json()["meetingStatus"] == "meeting_ended"

    # 5. Sync Transcript POST /api/meet/{consultationId}/sync-transcript
    sync_res = client.post(f"/api/meet/{consultation_id}/sync-transcript", headers=doctor_auth["headers"])
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert sync_data["transcriptStatus"] == "ready"
    assert len(sync_data["entries"]) > 0

    # Verify speaker roles in entries
    speakers = [e["speakerRole"] for e in sync_data["entries"]]
    assert "DOCTOR" in speakers
    assert "PATIENT" in speakers

    # 6. Retrieve Normalized Transcript GET /api/meet/{consultationId}/transcript
    t_res = client.get(f"/api/meet/{consultation_id}/transcript", headers=doctor_auth["headers"])
    assert t_res.status_code == 200
    t_data = t_res.json()
    assert len(t_data["entries"]) == len(sync_data["entries"])
    assert t_data["doctorName"] == "Dr. Aarav Patel"
    assert t_data["patientName"] == "Rohan Verma"

    # 7. Extract Clinical Summary with AI from Google Meet transcript
    summary_res = client.post(f"/api/consultations/{consultation_id}/summarize", headers=doctor_auth["headers"])
    assert summary_res.status_code == 200
    summary_data = summary_res.json()
    assert "symptoms" in summary_data or "patient_view" in summary_data

    # 8. Approve and Finalize -> Follow-up Intelligence
    fin_res = client.post(
        f"/api/consultations/{consultation_id}/finalize",
        json={
            "chief_complaint": "Persistent right knee joint pain",
            "assessment": "Right knee strain and mild inflammation",
            "approved_by": "Dr. Aarav Patel",
        },
        headers=doctor_auth["headers"],
    )
    assert fin_res.status_code == 200
    assert fin_res.json()["success"] is True
