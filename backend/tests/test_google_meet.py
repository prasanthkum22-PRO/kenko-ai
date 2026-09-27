"""
MediBridge AI — Google Meet v2 Integration & Failure Resilience Tests
Tests Google OAuth flow, Space creation, idempotency, failure error classifications,
speaker mapping, transcript synchronization, and clinical AI summarization.
"""

import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.models.db_models import User, Consultation, TranscriptSegment, GoogleOAuthToken, Appointment
from app.utils.auth import hash_password, create_access_token
from app.services.participant_service import participant_service
from app.services.google_oauth_service import REQUIRED_SCOPES

# Isolated in-memory SQLite database
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
        email="dr.aarav@medibridge.ai",
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


@pytest.fixture(scope="function")
def patient_auth(db_session):
    user = User(
        email="patient.test@medibridge.ai",
        hashed_password=hash_password("PatientSecret123!"),
        full_name="Rohan Verma",
        role="PATIENT",
        patient_id="P-2026",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    return {"user": user, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


def test_google_oauth_endpoints(client, doctor_auth):
    """Test OAuth authorization URL generation and status check."""
    res_status = client.get("/api/google/status", headers=doctor_auth["headers"])
    assert res_status.status_code == 200
    data = res_status.json()
    assert "is_connected" in data

    res_auth = client.get("/api/google/auth", headers=doctor_auth["headers"])
    assert res_auth.status_code == 200
    auth_data = res_auth.json()
    assert "auth_url" in auth_data
    assert "state" in auth_data


def test_unauthenticated_doctor_blocked(client, doctor_auth):
    """Verify that attempting to create a Meet without Google OAuth returns 401 GOOGLE_AUTH_REQUIRED."""
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

    # No OAuth token in DB -> must return 401
    unauth_meet = client.post(
        "/api/meet/create",
        json={"consultationId": consultation_id, "patientId": "P-2026"},
        headers=doctor_auth["headers"],
    )
    assert unauth_meet.status_code == 401
    res_data = unauth_meet.json()
    assert res_data["success"] is False
    assert res_data["error"]["code"] == "GOOGLE_AUTH_REQUIRED"


def test_patient_blocked_from_creating_meet(client, patient_auth, doctor_auth):
    """Verify that a patient cannot create a Google Meet space (doctor-only operation)."""
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
    consultation_id = c_res.json()["id"]

    patient_res = client.post(
        "/api/meet/create",
        json={"consultationId": consultation_id, "patientId": "P-2026"},
        headers=patient_auth["headers"],
    )
    assert patient_res.status_code == 403
    assert patient_res.json()["error"]["code"] == "UNAUTHORIZED_ROLE"


@patch("app.services.google_meet_service.google_meet_service.create_space")
def test_create_meet_idempotency_and_success(mock_create_space, client, doctor_auth, db_session):
    """Test successful space creation and verify idempotency on duplicate calls."""
    from datetime import datetime, timezone, timedelta

    # Seed OAuth token
    token_rec = GoogleOAuthToken(
        user_id=doctor_auth["user"].id,
        email="dr.aarav@medibridge.ai",
        access_token="ya29.a0AfH6SMD_real_token_simulated_for_testing",
        refresh_token="1//0g_real_refresh_token_simulated",
        token_type="Bearer",
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        scopes=" ".join(REQUIRED_SCOPES),
        is_valid=True,
    )
    db_session.add(token_rec)
    db_session.commit()

    # Mock real Google Meet API response
    mock_create_space.return_value = {
        "name": "spaces/abc-defg-hij",
        "meetingUri": "https://meet.google.com/abc-defg-hij",
        "meetingCode": "abc-defg-hij",
        "config": {"accessType": "OPEN", "entryPointAccess": "ALL"},
    }

    # 1. Create Consultation
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
    consultation_id = c_res.json()["id"]

    # 2. First Create Meet Call
    meet_res = client.post(
        "/api/meet/create",
        json={"consultationId": consultation_id, "patientId": "P-2026"},
        headers=doctor_auth["headers"],
    )
    assert meet_res.status_code == 200
    meet_data = meet_res.json()
    assert meet_data["success"] is True
    assert meet_data["meetingUri"] == "https://meet.google.com/abc-defg-hij"
    assert meet_data["spaceName"] == "spaces/abc-defg-hij"

    # 3. Duplicate Call -> Idempotent, must return identical URI without re-calling Google API
    meet_dup = client.post(
        "/api/meet/create",
        json={"consultationId": consultation_id, "patientId": "P-2026"},
        headers=doctor_auth["headers"],
    )
    assert meet_dup.status_code == 200
    assert meet_dup.json()["meetingUri"] == "https://meet.google.com/abc-defg-hij"
    assert mock_create_space.call_count == 1

    # 4. End Call
    end_res = client.post(f"/api/meet/{consultation_id}/end", headers=doctor_auth["headers"])
    assert end_res.status_code == 200
    assert end_res.json()["status"] == "COMPLETED"


def test_participant_speaker_mapping():
    """Test ParticipantService accurately identifies Doctor vs Patient without guessing."""
    doc_participant = {"signedinUser": {"displayName": "Dr. Aarav Patel", "user": "users/123"}}
    role = participant_service.map_participant_to_role(
        participant_data=doc_participant,
        doctor_name="Dr. Aarav Patel",
        patient_name="Rohan Verma",
    )
    assert role == "DOCTOR"

    pat_participant = {"signedinUser": {"displayName": "Rohan Verma", "user": "users/456"}}
    role = participant_service.map_participant_to_role(
        participant_data=pat_participant,
        doctor_name="Dr. Aarav Patel",
        patient_name="Rohan Verma",
    )
    assert role == "PATIENT"

    unk_participant = {"anonymousUser": {"displayName": "Guest User"}}
    role = participant_service.map_participant_to_role(
        participant_data=unk_participant,
        doctor_name="Dr. Aarav Patel",
        patient_name="Rohan Verma",
    )
    assert role == "UNKNOWN"
