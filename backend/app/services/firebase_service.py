"""
MediBridge AI / KENKO-AI — Firebase Data Service Bridge
Provides server-side synchronization between relational models and Cloud Firestore,
safely handling Firestore collections, subcollections, and FCM push notifications.
CRITICAL: Never writes Google OAuth client secrets or access/refresh tokens to Firestore.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import httpx

logger = logging.getLogger(__name__)

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "kenko-ai-4edb8")
FIRESTORE_REST_BASE = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents"


class FirebaseService:
    """Server-side Firebase integration using Firestore REST API & FCM."""

    def __init__(self, project_id: str = FIREBASE_PROJECT_ID):
        self.project_id = project_id
        self.base_url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents"

    def _format_firestore_value(self, val: Any) -> Dict[str, Any]:
        """Convert Python types into Firestore REST field values."""
        if val is None:
            return {"nullValue": None}
        elif isinstance(val, bool):
            return {"booleanValue": val}
        elif isinstance(val, int):
            return {"integerValue": str(val)}
        elif isinstance(val, float):
            return {"doubleValue": val}
        elif isinstance(val, str):
            return {"stringValue": val}
        elif isinstance(val, datetime):
            return {"timestampValue": val.isoformat()}
        elif isinstance(val, list):
            return {"arrayValue": {"values": [self._format_firestore_value(item) for item in val]}}
        elif isinstance(val, dict):
            return {"mapValue": {"fields": {k: self._format_firestore_value(v) for k, v in val.items()}}}
        return {"stringValue": str(val)}

    def _dict_to_firestore_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return {k: self._format_firestore_value(v) for k, v in data.items()}

    async def write_document(self, collection_path: str, doc_id: str, data: Dict[str, Any]) -> bool:
        """Write a document to Firestore via REST."""
        url = f"{self.base_url}/{collection_path}/{doc_id}"
        fields = self._dict_to_firestore_fields(data)
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.patch(url, json={"fields": fields})
                return res.status_code in [200, 201]
        except Exception as e:
            logger.debug(f"Firestore write note ({collection_path}/{doc_id}): {e}")
            return False

    async def write_subcollection_document(
        self, parent_collection: str, parent_id: str, subcollection: str, doc_id: str, data: Dict[str, Any]
    ) -> bool:
        """Write to a nested subcollection (e.g. consultations/{id}/transcriptEntries/{id})."""
        path = f"{parent_collection}/{parent_id}/{subcollection}"
        return await self.write_document(path, doc_id, data)

    # ─── Synchronization Helpers ─────────────────────────────────────────────

    async def sync_user(self, user_id: str, email: str, display_name: str, role: str):
        data = {
            "uid": user_id,
            "email": email,
            "displayName": display_name,
            "role": role.upper(),
            "accountStatus": "ACTIVE",
            "updatedAt": datetime.now(timezone.utc),
        }
        await self.write_document("users", user_id, data)

    async def sync_appointment_meet(self, appointment_id: str, space_name: str, meet_uri: str, meet_code: str):
        """Store Google Meet meeting info without exposing OAuth credentials."""
        data = {
            "googleSpaceName": space_name,
            "googleMeetingUri": meet_uri,
            "googleMeetingCode": meet_code,
            "status": "MEET_READY",
            "updatedAt": datetime.now(timezone.utc),
        }
        await self.write_document("appointments", appointment_id, data)

    async def sync_transcript_entry(self, consultation_id: str, entry_id: str, speaker_role: str, speaker_name: str, text: str, start_time: float, end_time: float):
        data = {
            "speakerRole": speaker_role,
            "speakerName": speaker_name,
            "text": text,
            "startTime": start_time,
            "endTime": end_time,
            "source": "GOOGLE_MEET",
            "createdAt": datetime.now(timezone.utc),
        }
        await self.write_subcollection_document("consultations", consultation_id, "transcriptEntries", entry_id, data)

    async def sync_clinical_note(self, consultation_id: str, note_data: Dict[str, Any]):
        await self.write_document("clinicalNotes", consultation_id, note_data)

    async def sync_follow_up_plan(self, consultation_id: str, plan_data: Dict[str, Any]):
        await self.write_document("followUpPlans", consultation_id, plan_data)


firebase_service = FirebaseService()
