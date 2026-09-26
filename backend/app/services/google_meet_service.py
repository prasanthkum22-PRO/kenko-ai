"""
MediBridge AI — Google Meet REST API v2 Service
Official Google Meet REST API v2 integration for creating spaces,
retrieving conference records, tracking participants, and polling transcript artifacts.
"""

import os
import logging
import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

import httpx
from sqlalchemy.orm import Session

from app.services.google_oauth_service import google_oauth_service

logger = logging.getLogger(__name__)

MEET_API_BASE = "https://meet.googleapis.com/v2"


def generate_meet_code() -> str:
    """Generates a realistic 3-4-3 Google Meet code format: xxx-yyyy-zzz."""
    def rand_letters(n):
        return "".join(secrets.choice(string.ascii_lowercase) for _ in range(n))
    return f"{rand_letters(3)}-{rand_letters(4)}-{rand_letters(3)}"


class GoogleMeetService:
    def __init__(self):
        self.api_base = MEET_API_BASE

    async def create_space(
        self,
        user_id: str,
        db: Session,
        access_type: str = "OPEN",
    ) -> Dict[str, Any]:
        """
        Calls Google Meet REST API v2: POST https://meet.googleapis.com/v2/spaces
        Creates a durable Google Meet space for the consultation.

        Returns dict with keys: name, meetingUri, meetingCode, config, isMock

        If no valid access token is available (sandbox/demo mode), isMock=True
        and a sandbox-format URI is returned so the app can transparently handle it.

        If the Google API call fails with a real token, raises an exception —
        we NEVER silently substitute a fake URI when real OAuth is configured.
        """
        access_token = await google_oauth_service.get_valid_access_token(user_id, db)

        # No access token → sandbox/mock mode only
        if not access_token or access_token.startswith("mock_"):
            meet_code = generate_meet_code()
            space_id = secrets.token_urlsafe(12)
            space_name = f"spaces/{space_id}"
            meeting_uri = f"https://meet.google.com/{meet_code}"
            logger.info(f"[GoogleMeet] No OAuth token — sandbox mode: {meeting_uri}")
            return {
                "name": space_name,
                "meetingUri": meeting_uri,
                "meetingCode": meet_code,
                "config": {"accessType": access_type, "entryPointAccess": "ALL"},
                "isMock": True,
            }

        # Real Google Meet REST API v2 call
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        body = {
            "config": {
                "accessType": access_type,
                "entryPointAccess": "ALL",
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.api_base}/spaces",
                headers=headers,
                json=body,
            )

        if resp.status_code not in (200, 201):
            # Log the error type but never log the full response body (may contain tokens)
            logger.error(
                f"[GoogleMeet] create_space failed: HTTP {resp.status_code} "
                f"(user={user_id}). Check Google Workspace Meet API permissions and OAuth scopes."
            )
            # Raise — callers must handle this and return a proper FAILED status
            raise RuntimeError(
                f"Google Meet API returned HTTP {resp.status_code}. "
                "Verify Meet API is enabled, OAuth scopes include meet.spaces.create, "
                "and the authenticated account has Google Workspace access."
            )

        data = resp.json()
        meeting_uri = data.get("meetingUri", "")
        meeting_code = data.get("meetingCode")
        if not meeting_code and meeting_uri:
            meeting_code = meeting_uri.rstrip("/").split("/")[-1]

        logger.info(f"[GoogleMeet] Space created: {data.get('name')} (user={user_id})")
        return {
            "name": data.get("name"),
            "meetingUri": meeting_uri,
            "meetingCode": meeting_code,
            "config": data.get("config", {}),
            "isMock": False,
        }

    async def get_space(self, space_name: str, user_id: str, db: Session) -> Optional[Dict[str, Any]]:
        """Retrieves Google Meet space metadata: GET https://meet.googleapis.com/v2/{name=spaces/*}."""
        access_token = await google_oauth_service.get_valid_access_token(user_id, db)
        if not access_token or access_token.startswith("mock_"):
            return {
                "name": space_name,
                "meetingUri": f"https://meet.google.com/{space_name.replace('spaces/', '')}",
                "meetingCode": space_name.replace("spaces/", ""),
                "isMock": True,
            }

        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(f"{self.api_base}/{space_name}", headers=headers)
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"Failed to fetch space {space_name}: {resp.status_code}")
            return None

    async def find_conference_records_for_space(
        self,
        space_name: str,
        user_id: str,
        db: Session,
    ) -> List[Dict[str, Any]]:
        """
        Finds conference records associated with a Google Meet space:
        GET https://meet.googleapis.com/v2/conferenceRecords?filter=space.name="{space_name}"
        """
        access_token = await google_oauth_service.get_valid_access_token(user_id, db)
        if not access_token or access_token.startswith("mock_"):
            return [
                {
                    "name": f"conferenceRecords/{space_name.replace('spaces/', 'cr-')}",
                    "startTime": (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat(),
                    "endTime": datetime.now(timezone.utc).isoformat(),
                    "space": space_name,
                    "isMock": True,
                }
            ]

        headers = {"Authorization": f"Bearer {access_token}"}
        params = {"filter": f'space.name="{space_name}"'}

        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.get(
                f"{self.api_base}/conferenceRecords",
                headers=headers,
                params=params,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("conferenceRecords", [])
            logger.warning(f"Error querying conference records for {space_name}: {resp.status_code}")
            return []

    async def get_conference_record(
        self,
        conference_record_name: str,
        user_id: str,
        db: Session,
    ) -> Optional[Dict[str, Any]]:
        """Gets details of a single conference record."""
        access_token = await google_oauth_service.get_valid_access_token(user_id, db)
        if not access_token or access_token.startswith("mock_"):
            return {
                "name": conference_record_name,
                "startTime": (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat(),
                "endTime": datetime.now(timezone.utc).isoformat(),
                "isMock": True,
            }

        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(f"{self.api_base}/{conference_record_name}", headers=headers)
            if resp.status_code == 200:
                return resp.json()
            return None

    async def get_participants(
        self,
        conference_record_name: str,
        user_id: str,
        db: Session,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves participants for a conference record:
        GET https://meet.googleapis.com/v2/{parent=conferenceRecords/*}/participants
        """
        access_token = await google_oauth_service.get_valid_access_token(user_id, db)
        if not access_token or access_token.startswith("mock_"):
            return [
                {
                    "name": f"{conference_record_name}/participants/p_doctor",
                    "signedinUser": {"user": "users/doctor", "displayName": "Doctor"},
                    "earliestStartTime": (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat(),
                    "latestEndTime": datetime.now(timezone.utc).isoformat(),
                },
                {
                    "name": f"{conference_record_name}/participants/p_patient",
                    "signedinUser": {"user": "users/patient", "displayName": "Patient"},
                    "earliestStartTime": (datetime.now(timezone.utc) - timedelta(minutes=14)).isoformat(),
                    "latestEndTime": datetime.now(timezone.utc).isoformat(),
                },
            ]

        headers = {"Authorization": f"Bearer {access_token}"}
        all_participants = []
        page_token = None

        async with httpx.AsyncClient(timeout=25.0) as client:
            while True:
                params = {"pageSize": 50}
                if page_token:
                    params["pageToken"] = page_token

                resp = await client.get(
                    f"{self.api_base}/{conference_record_name}/participants",
                    headers=headers,
                    params=params,
                )
                if resp.status_code != 200:
                    logger.warning(f"Error fetching participants: {resp.status_code}")
                    break

                data = resp.json()
                all_participants.extend(data.get("participants", []))
                page_token = data.get("nextPageToken")
                if not page_token:
                    break

        return all_participants


google_meet_service = GoogleMeetService()
