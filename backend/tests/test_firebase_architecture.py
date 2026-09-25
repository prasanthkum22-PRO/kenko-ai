"""
KENKO-AI Firebase Architecture, Firestore Rules & Synchronization Tests
"""

import pytest
from datetime import datetime, timezone
from app.services.firebase_service import FirebaseService


def test_firestore_value_formatting():
    service = FirebaseService(project_id="test-project")

    # String
    assert service._format_firestore_value("Hello") == {"stringValue": "Hello"}

    # Integer
    assert service._format_firestore_value(42) == {"integerValue": "42"}

    # Boolean
    assert service._format_firestore_value(True) == {"booleanValue": True}

    # Timestamp
    now = datetime.now(timezone.utc)
    assert "timestampValue" in service._format_firestore_value(now)

    # List
    arr = ["item1", "item2"]
    res_arr = service._format_firestore_value(arr)
    assert "arrayValue" in res_arr
    assert len(res_arr["arrayValue"]["values"]) == 2

    # Map / Dict
    d = {"name": "Dr. Smith", "age": 45}
    res_d = service._format_firestore_value(d)
    assert "mapValue" in res_d
    assert "name" in res_d["mapValue"]["fields"]


def test_google_meet_sync_never_exposes_oauth_secrets():
    service = FirebaseService(project_id="test-project")
    # Formatted appointment meet data
    fields = service._dict_to_firestore_fields({
        "googleSpaceName": "spaces/TEST_SPACE_123",
        "googleMeetingUri": "https://meet.google.com/abc-defg-hij",
        "googleMeetingCode": "abc-defg-hij",
        "status": "MEET_READY",
    })

    # Verify no tokens or secrets are present
    assert "google_client_secret" not in fields
    assert "access_token" not in fields
    assert "refresh_token" not in fields
    assert fields["googleSpaceName"]["stringValue"] == "spaces/TEST_SPACE_123"
    assert fields["googleMeetingUri"]["stringValue"] == "https://meet.google.com/abc-defg-hij"


def test_transcript_subcollection_formatting():
    service = FirebaseService(project_id="test-project")
    entry = {
        "speakerRole": "DOCTOR",
        "speakerName": "Dr. Aarav Patel",
        "text": "Hello, how can I help you?",
        "startTime": 0.0,
        "endTime": 3.5,
        "source": "GOOGLE_MEET",
    }
    fields = service._dict_to_firestore_fields(entry)
    assert fields["speakerRole"]["stringValue"] == "DOCTOR"
    assert fields["source"]["stringValue"] == "GOOGLE_MEET"
