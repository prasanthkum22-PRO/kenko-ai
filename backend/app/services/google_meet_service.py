"""
MediBridge AI — Google Meet REST API v2 Service
Production integration for creating Google Meet spaces, retrieving conference records,
tracking participants, and synchronizing transcript artifacts.
No mock/dummy fallback URLs are generated; all operations strictly hit Google APIs.
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

import httpx
from sqlalchemy.orm import Session

from app.services.google_oauth_service import google_oauth_service

logger = logging.getLogger(__name__)

MEET_API_BASE = "https://meet.googleapis.com/v2"


class GoogleMeetService:
    def __init__(self):
        self.api_base = MEET_API_BASE

    async def create_space(
        self,
        user_id: str,
        db: Session,
        access_type: str = "OPEN",
        request_id: Optional[str] = None,
        consultation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Calls Google Meet REST API v2: POST https://meet.googleapis.com/v2/spaces
        Creates a durable Google Meet space for the consultation.

        Returns dict with keys: name, meetingUri, meetingCode, config.
        Raises structured exceptions on any failure.
        """
        req_id = request_id or f"req_{uuid.uuid4().hex[:10]}"

        # 1. Check configuration
        if not google_oauth_service.is_configured:
            logger.error(
                f"[GoogleMeet] requestId={req_id} operation=spaces.create user_id={user_id} "
                f"consultationId={consultation_id} error=GOOGLE_OAUTH_NOT_CONFIGURED "
                f"message='Google OAuth credentials missing on backend'"
            )
            raise RuntimeError("GOOGLE_OAUTH_NOT_CONFIGURED: Google OAuth client ID/secret are not configured.")

        # 2. Get valid real access token
        access_token = await google_oauth_service.get_valid_access_token(user_id, db)
        if not access_token:
            logger.error(
                f"[GoogleMeet] requestId={req_id} operation=spaces.create user_id={user_id} "
                f"consultationId={consultation_id} error=GOOGLE_AUTH_REQUIRED "
                f"message='No valid Google OAuth token available for doctor'"
            )
            raise PermissionError("GOOGLE_AUTH_REQUIRED: Doctor must authenticate with Google OAuth before creating a Meet space.")

        # 3. Call Google Meet REST API v2
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

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.api_base}/spaces",
                    headers=headers,
                    json=body,
                )
        except Exception as net_err:
            logger.error(
                f"[GoogleMeet] requestId={req_id} operation=spaces.create user_id={user_id} "
                f"consultationId={consultation_id} status=NETWORK_ERROR error=GOOGLE_MEET_CREATE_FAILED "
                f"message={str(net_err)} exc={type(net_err).__name__}"
            )
            raise RuntimeError(f"GOOGLE_MEET_CREATE_FAILED: Network error communicating with Google Meet API: {net_err}")

        # 4. Handle non-2xx responses from Google API
        if resp.status_code not in (200, 201):
            error_text = resp.text
            try:
                err_json = resp.json().get("error", {})
                err_status = err_json.get("status", "")
                err_message = err_json.get("message", error_text)
            except Exception:
                err_status = ""
                err_message = error_text

            logger.error(
                f"[GoogleMeet] requestId={req_id} operation=spaces.create user_id={user_id} "
                f"consultationId={consultation_id} status={resp.status_code} "
                f"error={err_status or 'HTTP_' + str(resp.status_code)} message='{err_message}'"
            )

            if resp.status_code == 401:
                raise PermissionError("GOOGLE_TOKEN_EXPIRED: Google token rejected. Reauthentication required.")
            if resp.status_code == 403:
                if "PERMISSION_DENIED" in err_status or "Permission" in err_message:
                    raise PermissionError("GOOGLE_MEET_PERMISSION_DENIED: Google did not allow this account to create a Meet space. Verify Google Workspace access.")
                if "API_NOT_ENABLED" in err_status or "has not used" in err_message or "disabled" in err_message:
                    raise RuntimeError("GOOGLE_MEET_API_NOT_ENABLED: Google Meet API is not enabled in Google Cloud Console.")
                if "SCOPE" in err_status or "scope" in err_message.lower():
                    raise PermissionError("GOOGLE_MEET_SCOPE_MISSING: Missing required Google Meet OAuth scope (meet.spaces.create).")
                raise PermissionError(f"GOOGLE_MEET_PERMISSION_DENIED: {err_message}")
            if resp.status_code == 429:
                raise RuntimeError("GOOGLE_MEET_RATE_LIMITED: Google Meet API rate limit reached. Please retry in a few moments.")

            raise RuntimeError(f"GOOGLE_MEET_CREATE_FAILED: Google Meet API returned HTTP {resp.status_code}: {err_message}")

        # 5. Parse and validate response
        data = resp.json()
        space_name = data.get("name")
        meeting_uri = data.get("meetingUri", "")
        meeting_code = data.get("meetingCode")

        if not space_name or not meeting_uri:
            logger.error(
                f"[GoogleMeet] requestId={req_id} operation=spaces.create user_id={user_id} "
                f"consultationId={consultation_id} error=GOOGLE_MEET_RESPONSE_INVALID "
                f"message='Missing space name or meeting URI in response'"
            )
            raise ValueError("GOOGLE_MEET_RESPONSE_INVALID: Google Meet API returned an incomplete response payload.")

        if not meeting_code and meeting_uri:
            meeting_code = meeting_uri.rstrip("/").split("/")[-1]

        logger.info(
            f"[GoogleMeet] requestId={req_id} space_created={space_name} "
            f"user_id={user_id} consultationId={consultation_id}"
        )
        return {
            "name": space_name,
            "meetingUri": meeting_uri,
            "meetingCode": meeting_code,
            "config": data.get("config", {}),
        }

    async def get_space(self, space_name: str, user_id: str, db: Session) -> Optional[Dict[str, Any]]:
        """Retrieves Google Meet space metadata: GET https://meet.googleapis.com/v2/{name=spaces/*}."""
        access_token = await google_oauth_service.get_valid_access_token(user_id, db)
        if not access_token:
            return None

        headers = {"Authorization": f"Bearer {access_token}"}
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(f"{self.api_base}/{space_name}", headers=headers)
                if resp.status_code == 200:
                    return resp.json()
                logger.warning(f"[GoogleMeet] Failed to fetch space {space_name}: HTTP {resp.status_code}")
                return None
        except Exception as e:
            logger.error(f"[GoogleMeet] get_space error: {e}")
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
        if not access_token:
            return []

        headers = {"Authorization": f"Bearer {access_token}"}
        params = {"filter": f'space.name="{space_name}"'}

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.get(
                    f"{self.api_base}/conferenceRecords",
                    headers=headers,
                    params=params,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("conferenceRecords", [])
                logger.warning(f"[GoogleMeet] Conference records query for {space_name} returned HTTP {resp.status_code}")
                return []
        except Exception as e:
            logger.error(f"[GoogleMeet] find_conference_records error: {e}")
            return []

    async def get_conference_record(
        self,
        conference_record_name: str,
        user_id: str,
        db: Session,
    ) -> Optional[Dict[str, Any]]:
        """Gets details of a single conference record."""
        access_token = await google_oauth_service.get_valid_access_token(user_id, db)
        if not access_token:
            return None

        headers = {"Authorization": f"Bearer {access_token}"}
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(f"{self.api_base}/{conference_record_name}", headers=headers)
                if resp.status_code == 200:
                    return resp.json()
                return None
        except Exception as e:
            logger.error(f"[GoogleMeet] get_conference_record error: {e}")
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
        if not access_token:
            return []

        headers = {"Authorization": f"Bearer {access_token}"}
        all_participants = []
        page_token = None

        try:
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
                        logger.warning(f"[GoogleMeet] Error fetching participants: HTTP {resp.status_code}")
                        break

                    data = resp.json()
                    all_participants.extend(data.get("participants", []))
                    page_token = data.get("nextPageToken")
                    if not page_token:
                        break
        except Exception as e:
            logger.error(f"[GoogleMeet] get_participants error: {e}")

        return all_participants


google_meet_service = GoogleMeetService()
