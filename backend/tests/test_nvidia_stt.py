"""
MediBridge AI — NVIDIA Speech-to-Text Integration Tests
Validates:
1. NVIDIA API authentication & configuration
2. Missing API key handling & fallback mode
3. Invalid audio & empty payload rejection
4. Successful transcription & segment extraction
5. NVIDIA API failure & safe error responses (503)
6. Rate limit (429) error handling
7. Transcript normalization & timestamp preservation
8. Consultation authorization & access control
9. Doctor/patient speaker separation
10. Transcript status endpoint (/status)
"""

import os
import asyncio
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.models.db_models import User, Consultation, TranscriptSegment
from app.utils.auth import hash_password, create_access_token
from app.services.nvidia_speech_service import NvidiaSpeechService, nvidia_speech_service

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
        email="doctor@medibridge.ai",
        hashed_password=hash_password("DoctorPass123!"),
        full_name="Dr. Sarah Jenkins",
        role="DOCTOR",
        doctor_id="D-2001",
    )
    db_session.add(user)
    db_session.commit()
    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    return {"token": token, "user": user}


@pytest.fixture(scope="function")
def patient_auth(db_session):
    user = User(
        email="patient.test@gmail.com",
        hashed_password=hash_password("PatientPass123!"),
        full_name="John Doe",
        role="PATIENT",
        patient_id="PT-9999",
    )
    db_session.add(user)
    db_session.commit()
    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    return {"token": token, "user": user}


@pytest.fixture(scope="function")
def test_consultation(db_session):
    c = Consultation(
        patient_id="PT-1002",
        patient_name="Eleanor Vance",
        doctor_name="Dr. Sarah Jenkins",
        doctor_id="D-2001",
        consultation_type="video",
        has_consent=True,
        status="recording",
        transcript_status="pending",
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c


# ── Test 1: NVIDIA Service Configuration ──────────────────────────────────────
def test_nvidia_service_config():
    service = NvidiaSpeechService()
    assert service.stt_model is not None
    assert "nvidia" in service.endpoint or "audio" in service.endpoint
    assert service.max_audio_size_mb == 25


# ── Test 2: Missing API Key / Mock Mode Fallback ──────────────────────────────
def test_missing_api_key_mock_mode():
    with patch.dict(os.environ, {"NVIDIA_API_KEY": ""}):
        service = NvidiaSpeechService()
        dummy_wav = b"RIFF" + b"\x00" * 40 + b"WAVEfmt " + b"\x00" * 32
        result = asyncio.run(service.transcribe_audio(dummy_wav, filename="test.wav", content_type="audio/wav"))
        assert result is not None
        assert "text" in result
        assert "segments" in result
        assert len(result["segments"]) > 0
        assert result["segments"][0]["start"] == 0.0


# ── Test 3: Audio Validation (Empty Payload & Unsupported Format) ─────────────
def test_invalid_audio_validation():
    service = NvidiaSpeechService()
    
    # Test empty audio
    with pytest.raises(Exception) as exc_info:
        service.validate_audio(b"", filename="empty.wav", content_type="audio/wav")
    assert "empty" in str(exc_info.value).lower()

    # Test unsupported MIME type and extension
    with pytest.raises(Exception) as exc_info:
        service.validate_audio(b"12345", filename="document.pdf", content_type="application/pdf")
    assert "unsupported" in str(exc_info.value).lower()


# ── Test 4: Successful Transcription & Normalization ──────────────────────────
def test_successful_transcription_normalization():
    service = NvidiaSpeechService()
    mock_raw_response = {
        "text": "Hello, how can I help you today? I have a persistent cough.",
        "language": "english",
        "duration": 6.2,
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 2.5,
                "text": "Hello, how can I help you today?",
                "confidence": 0.99,
            },
            {
                "id": 1,
                "start": 2.8,
                "end": 6.2,
                "text": "I have a persistent cough.",
                "confidence": 0.97,
            },
        ],
    }

    normalized = service._normalize_nvidia_response(mock_raw_response)
    assert normalized["text"] == "Hello, how can I help you today? I have a persistent cough."
    assert normalized["language"] == "english"
    assert len(normalized["segments"]) == 2
    assert normalized["segments"][0]["start"] == 0.0
    assert normalized["segments"][0]["end"] == 2.5
    assert normalized["segments"][1]["text"] == "I have a persistent cough."


# ── Test 5: NVIDIA API Failure Handling (500 Error -> Safe 503) ───────────────
def test_nvidia_api_failure_handling():
    with patch.dict(os.environ, {"NVIDIA_API_KEY": "test-nvapi-key-12345"}):
        service = NvidiaSpeechService()
        dummy_wav = b"RIFF" + b"\x00" * 40 + b"WAVEfmt " + b"\x00" * 32

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch("httpx.AsyncClient.post", return_value=mock_response):
            with pytest.raises(Exception) as exc_info:
                asyncio.run(service.transcribe_audio(dummy_wav, filename="test.wav", content_type="audio/wav"))
            assert "temporarily unavailable" in str(exc_info.value).lower()


# ── Test 6: Rate Limit Handling (429 Error) ───────────────────────────────────
def test_nvidia_rate_limit_handling():
    with patch.dict(os.environ, {"NVIDIA_API_KEY": "test-nvapi-key-12345"}):
        service = NvidiaSpeechService()
        dummy_wav = b"RIFF" + b"\x00" * 40 + b"WAVEfmt " + b"\x00" * 32

        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = "Rate limit exceeded"

        with patch("httpx.AsyncClient.post", return_value=mock_response):
            with pytest.raises(Exception) as exc_info:
                asyncio.run(service.transcribe_audio(dummy_wav, filename="test.wav", content_type="audio/wav"))
            assert "rate limit" in str(exc_info.value).lower()


# ── Test 7: API Endpoint POST /api/transcription/transcribe ───────────────────
def test_transcribe_api_endpoint(client, doctor_auth, test_consultation):
    token = doctor_auth["token"]
    dummy_wav = b"RIFF" + b"\x00" * 40 + b"WAVEfmt " + b"\x00" * 32
    
    mock_stt_result = {
        "text": "Hello doctor. I have knee pain.",
        "language": "English",
        "duration": 5.0,
        "segments": [
            {"start": 0.0, "end": 2.2, "text": "Hello doctor.", "confidence": 0.99},
            {"start": 2.5, "end": 5.0, "text": "I have knee pain.", "confidence": 0.98},
        ],
        "provider": "NVIDIA Hosted AI (Whisper Large-v3)",
    }

    with patch("app.routes.transcription_routes.nvidia_speech_service.transcribe_audio", return_value=mock_stt_result):
        files = {"audio": ("consultation.wav", dummy_wav, "audio/wav")}
        data = {"consultationId": test_consultation.id}
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post("/api/transcription/transcribe", files=files, data=data, headers=headers)
        assert response.status_code == 200
        res_data = response.json()
        assert res_data["success"] is True
        assert res_data["consultation_id"] == test_consultation.id
        assert res_data["status"] == "ready"
        assert "segments" in res_data
        assert len(res_data["segments"]) == 2
        assert res_data["notice"] == "AI-generated — Doctor review required"


# ── Test 8: Consultation Access Authorization ──────────────────────────────────
def test_consultation_access_authorization(client, patient_auth, test_consultation):
    token = patient_auth["token"]
    dummy_wav = b"RIFF" + b"\x00" * 40 + b"WAVEfmt " + b"\x00" * 32
    
    files = {"audio": ("consultation.wav", dummy_wav, "audio/wav")}
    data = {"consultationId": test_consultation.id}
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/api/transcription/transcribe", files=files, data=data, headers=headers)
    assert response.status_code == 403
    assert "not authorized" in response.json()["detail"].lower()


# ── Test 9: Doctor / Patient Speaker Mapping & Persistence ────────────────────
def test_speaker_mapping_persistence(client, doctor_auth, test_consultation, db_session):
    token = doctor_auth["token"]
    dummy_wav = b"RIFF" + b"\x00" * 40 + b"WAVEfmt " + b"\x00" * 32

    mock_stt_result = {
        "text": "How are you? I feel better.",
        "language": "English",
        "duration": 4.0,
        "segments": [
            {"start": 0.0, "end": 2.0, "text": "How are you?", "confidence": 0.99},
            {"start": 2.2, "end": 4.0, "text": "I feel better.", "confidence": 0.98},
        ],
        "provider": "NVIDIA Hosted AI (Whisper Large-v3)",
    }

    with patch("app.routes.transcription_routes.nvidia_speech_service.transcribe_audio", return_value=mock_stt_result):
        files = {"audio": ("consultation.wav", dummy_wav, "audio/wav")}
        data = {"consultationId": test_consultation.id}
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post("/api/transcription/transcribe", files=files, data=data, headers=headers)
        assert response.status_code == 200

        # Verify segments in database
        segments = (
            db_session.query(TranscriptSegment)
            .filter(TranscriptSegment.consultation_id == test_consultation.id)
            .all()
        )
        assert len(segments) == 2
        assert segments[0].speaker == "Doctor"
        assert segments[1].speaker == "Patient"


# ── Test 10: Status Endpoint GET /api/consultations/:id/transcript/status ──────
def test_transcript_status_endpoint(client, doctor_auth, test_consultation):
    token = doctor_auth["token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get(
        f"/api/consultations/{test_consultation.id}/transcript/status",
        headers=headers,
    )
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["consultation_id"] == test_consultation.id
    assert res_data["status"] in ["pending", "ready", "processing"]
    assert "notice" in res_data
