"""
MediBridge AI / KENKO-AI — Firebase Data Service Bridge
Provides server-side synchronization between relational models and Cloud Firestore,
safely handling Firestore collections, subcollections, and FCM push notifications.

AUTHENTICATION STRATEGY:
  Priority 1: Firebase Admin SDK (service account — server-side only)
  Priority 2: Authenticated Firestore REST (service account JWT)
  Priority 3: Unauthenticated REST (only if Firestore rules allow public writes)

CRITICAL: Never writes Google OAuth client secrets or access/refresh tokens to Firestore.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import httpx

logger = logging.getLogger(__name__)

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "kenko-ai-4edb8")
FIRESTORE_REST_BASE = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents"

# ─── Firebase Admin SDK (lazy-initialized, optional) ─────────────────────────
_firebase_admin_checked = False
_admin_db = None


def _resolve_sa_path(path: str) -> Optional[str]:
    """Helper to locate service account file across different cwd paths."""
    if not path:
        return None
    candidates = [
        path,
        os.path.join(os.getcwd(), path),
        os.path.join(os.path.dirname(__file__), "..", "..", path),
        os.path.join(os.path.dirname(__file__), "..", "..", "backend", path),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return os.path.abspath(c)
    return None


def _get_admin_db():
    """Lazily initialize and return a Firebase Admin Firestore client, or None."""
    global _firebase_admin_checked, _admin_db
    if _firebase_admin_checked:
        return _admin_db
    _firebase_admin_checked = True

    sa_path = _resolve_sa_path(os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", ""))
    sa_json_str = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")

    if not sa_path and not sa_json_str:
        logger.info("[Firebase] No service account configured — REST API will be used.")
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore as admin_firestore

        if not firebase_admin._apps:
            if sa_path and os.path.isfile(sa_path):
                cred = credentials.Certificate(sa_path)
                firebase_admin.initialize_app(cred)
                logger.info("[Firebase Admin] Initialized with service account file: %s", sa_path)
            elif sa_json_str:
                sa_dict = json.loads(sa_json_str)
                cred = credentials.Certificate(sa_dict)
                firebase_admin.initialize_app(cred)
                logger.info("[Firebase Admin] Initialized with service account JSON.")
            else:
                logger.warning("[Firebase Admin] Service account path not found.")
                return None

        _admin_db = admin_firestore.client()
        logger.info("[Firebase Admin] Firestore client ready.")
        return _admin_db

    except ImportError:
        logger.info("[Firebase Admin] firebase-admin not installed — using REST API.")
        return None
    except Exception as e:
        logger.warning(f"[Firebase Admin] Init failed: {e} — using REST API.")
        return None


async def _get_service_account_token() -> Optional[str]:
    """
    Exchange a service account key for a short-lived Google OAuth2 access token.
    Returns None if no service account is configured or exchange fails.
    """
    sa_path = _resolve_sa_path(os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", ""))
    sa_json_str = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")

    sa_dict = None
    if sa_path and os.path.isfile(sa_path):
        try:
            with open(sa_path) as f:
                sa_dict = json.load(f)
        except Exception:
            pass
    elif sa_json_str:
        try:
            sa_dict = json.loads(sa_json_str)
        except Exception:
            pass

    if not sa_dict:
        return None

    try:
        import time
        import base64

        now = int(time.time())
        header_b64 = base64.urlsafe_b64encode(
            json.dumps({"alg": "RS256", "typ": "JWT"}).encode()
        ).rstrip(b"=").decode()
        payload_b64 = base64.urlsafe_b64encode(
            json.dumps({
                "iss": sa_dict.get("client_email"),
                "scope": "https://www.googleapis.com/auth/datastore",
                "aud": "https://oauth2.googleapis.com/token",
                "exp": now + 3600,
                "iat": now,
            }).encode()
        ).rstrip(b"=").decode()

        unsigned = f"{header_b64}.{payload_b64}"

        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.hazmat.backends import default_backend

        key = serialization.load_pem_private_key(
            sa_dict["private_key"].encode(), password=None, backend=default_backend()
        )
        signature = key.sign(unsigned.encode(), padding.PKCS1v15(), hashes.SHA256())
        jwt_token = f"{unsigned}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": jwt_token,
                },
            )
            if resp.status_code == 200:
                return resp.json().get("access_token")
            logger.warning(f"[Firebase] Token exchange failed: HTTP {resp.status_code}")
    except ImportError:
        logger.debug("[Firebase] cryptography not available — no service account JWT.")
    except Exception as e:
        logger.warning(f"[Firebase] Service account token error: {e}")

    return None


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
        """
        Write (merge) a document to Firestore.
        Strategy: Admin SDK → Authenticated REST → Unauthenticated REST (open rules only).
        """
        # ── Strategy 1: Firebase Admin SDK ────────────────────────────────────
        try:
            admin_db = _get_admin_db()
            if admin_db is not None:
                def _clean(v):
                    if isinstance(v, dict):
                        return {k2: _clean(v2) for k2, v2 in v.items()}
                    return v
                clean = {k: _clean(v) for k, v in data.items()}
                admin_db.collection(collection_path).document(doc_id).set(clean, merge=True)
                logger.info(f"[Firebase Admin] Written: {collection_path}/{doc_id}")
                return True
        except Exception as admin_err:
            logger.warning(f"[Firebase Admin] Write failed — falling back to REST: {admin_err}")

        # ── Strategy 2 & 3: Firestore REST API ───────────────────────────────
        url = f"{self.base_url}/{collection_path}/{doc_id}"
        fields = self._dict_to_firestore_fields(data)
        headers = {"Content-Type": "application/json"}

        # Try to get an access token from service account
        access_token = await _get_service_account_token()
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.patch(url, json={"fields": fields}, headers=headers)
                if res.status_code in [200, 201]:
                    logger.info(f"[Firestore REST] Written: {collection_path}/{doc_id}")
                    return True
                elif res.status_code in [401, 403]:
                    msg = (
                        f"Firestore write to {collection_path}/{doc_id} was rejected "
                        f"(HTTP {res.status_code}). "
                        "Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON "
                        "env vars to enable authenticated writes."
                    )
                    logger.error(f"[Firestore REST] Auth error: {msg} — {res.text[:300]}")
                    raise RuntimeError(f"FIREBASE_SYNC_FAILED: {msg}")
                else:
                    logger.error(
                        f"[Firestore REST] Write failed {collection_path}/{doc_id}: "
                        f"HTTP {res.status_code} — {res.text[:200]}"
                    )
                    raise RuntimeError(
                        f"FIREBASE_SYNC_FAILED: Firestore write returned HTTP {res.status_code}"
                    )
        except RuntimeError:
            raise
        except Exception as e:
            logger.error(f"[Firestore REST] Network error {collection_path}/{doc_id}: {e}")
            raise RuntimeError(f"FIREBASE_SYNC_FAILED: Network error writing to Firestore: {e}")

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

    async def sync_appointment_meet(
        self,
        appointment_id: str,
        space_name: str,
        meet_uri: str,
        meet_code: str,
        consultation_id: Optional[str] = None,
        doctor_id: Optional[str] = None,
    ):
        """Store Google Meet meeting info permanently in Firestore without exposing OAuth credentials."""
        now_dt = datetime.now(timezone.utc)
        meet_payload = {
            "spaceName": space_name,
            "meetingUri": meet_uri,
            "meetingCode": meet_code,
            "status": "READY",
            "createdAt": now_dt,
        }
        meeting_obj = {
            "provider": "google_meet",
            "status": "created",
            "meetingUrl": meet_uri,
            "meetingUri": meet_uri,  # both fields for frontend compatibility
            "meetingCode": meet_code,
            "spaceName": space_name,
            "createdAt": now_dt,
            "createdBy": doctor_id or "doctor",
        }
        appt_data = {
            "googleSpaceName": space_name,
            "googleMeetingUri": meet_uri,
            "googleMeetingCode": meet_code,
            "meetStatus": "READY",
            "status": "CONFIRMED",
            "googleMeet": meet_payload,
            "meeting": meeting_obj,
            "updatedAt": now_dt,
        }
        # Write to appointments — primary trigger for the patient's realtime listener
        await self.write_document("appointments", appointment_id, appt_data)
        logger.info(f"[Firebase] appointments/{appointment_id} synced with Meet URI.")

        # Write to consultations — secondary source for the doctor's realtime listener
        if consultation_id:
            consult_data = {
                "googleSpaceName": space_name,
                "googleMeetingUri": meet_uri,
                "googleMeetingCode": meet_code,
                "meetingStatus": "meet_ready",
                "googleMeet": meet_payload,
                "meeting": meeting_obj,
                "updatedAt": now_dt,
            }
            try:
                await self.write_document("consultations", consultation_id, consult_data)
                logger.info(f"[Firebase] consultations/{consultation_id} synced with Meet URI.")
            except Exception as ce:
                # Non-fatal: appointment write already succeeded
                logger.error(f"[Firebase] consultations/{consultation_id} sync failed: {ce}")

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
