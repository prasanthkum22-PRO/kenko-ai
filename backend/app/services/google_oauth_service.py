"""
MediBridge AI — Google OAuth 2.0 Backend Service
Handles secure Google OAuth authorization, code exchange, token refresh, and server-side persistence.
OAuth secrets and tokens are strictly kept on the backend and NEVER exposed to frontend clients.
"""

import os
import json
import logging
import secrets
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import httpx
from sqlalchemy.orm import Session

from app.models.db_models import GoogleOAuthToken, User

from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# Minimum required Google Meet scopes as requested
REQUIRED_SCOPES = [
    "https://www.googleapis.com/auth/meetings.space.created",
    "https://www.googleapis.com/auth/meetings.space.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"


class GoogleOAuthService:
    @property
    def client_id(self) -> str:
        return os.getenv("GOOGLE_CLIENT_ID", "")

    @property
    def client_secret(self) -> str:
        return os.getenv("GOOGLE_CLIENT_SECRET", "")

    @property
    def redirect_uri(self) -> str:
        return os.getenv(
            "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/google/callback"
        )

    @property
    def frontend_url(self) -> str:
        return os.getenv("FRONTEND_URL", "http://localhost:5173")

    @property
    def is_configured(self) -> bool:
        """Checks whether real Google Cloud OAuth credentials have been provided."""
        return bool(self.client_id and self.client_secret)

    # is_mock_mode removed — production only, no mock mode supported

    def get_redirect_uri_for_request(self, return_url: Optional[str] = None) -> str:
        """Determines the appropriate redirect_uri based on the originating request."""
        if return_url and ("localhost" in return_url or "127.0.0.1" in return_url):
            return os.getenv("GOOGLE_LOCAL_REDIRECT_URI", "http://localhost:8000/api/google/callback")
        return self.redirect_uri

    def generate_auth_url(
        self,
        user_id: str,
        return_url: Optional[str] = None,
        consultation_id: Optional[str] = None,
        appointment_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Builds the Google OAuth 2.0 authorization URL.
        Includes a state parameter with a cryptographic token, user identifier, consultation/appointment IDs, and return_url.
        """
        nonce = secrets.token_urlsafe(16)
        state_payload = {
            "uid": user_id,
            "nonce": nonce,
            "exp": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
        }
        if return_url:
            state_payload["return_url"] = return_url
        if consultation_id:
            state_payload["consultation_id"] = consultation_id
        if appointment_id:
            state_payload["appointment_id"] = appointment_id

        # Also extract consultation_id or appointment_id from return_url if present
        if return_url:
            try:
                parsed = urllib.parse.urlparse(return_url)
                qs = urllib.parse.parse_qs(parsed.query)
                if not consultation_id and "id" in qs:
                    state_payload["consultation_id"] = qs["id"][0]
                if not consultation_id and "consultation_id" in qs:
                    state_payload["consultation_id"] = qs["consultation_id"][0]
                if not appointment_id and "appointment_id" in qs:
                    state_payload["appointment_id"] = qs["appointment_id"][0]
            except Exception:
                pass

        state_data = json.dumps(state_payload)
        redirect_uri = self.get_redirect_uri_for_request(return_url)

        logger.info(
            f"[OAuth Start] Generating auth URL: user={user_id}, redirect_uri={redirect_uri}, "
            f"consultation={state_payload.get('consultation_id')}, appt={state_payload.get('appointment_id')}"
        )

        if not self.is_configured:
            return {
                "auth_url": "",
                "state": state_data,
                "is_configured": False,
                "error": "GOOGLE_OAUTH_NOT_CONFIGURED",
                "message": "Google Cloud OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not configured.",
            }

        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(REQUIRED_SCOPES),
            "access_type": "offline",              # Required to receive a refresh token
            "prompt": "consent select_account",    # Guarantees Google returns refresh_token
            "include_granted_scopes": "true",
            "state": state_data,
        }
        auth_url = f"{GOOGLE_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"
        return {
            "auth_url": auth_url,
            "state": state_data,
            "is_configured": True,
            "message": "Directing to official Google OAuth consent screen.",
        }

    async def exchange_code(self, code: str, state: str, db: Session) -> Dict[str, Any]:
        """
        Exchanges authorization code for access_token and refresh_token.
        Saves tokens keyed to the specific user_id from state.
        Returns context for callback redirection — does NOT create a Meet space.
        SECURITY: user_id must come from the validated state — no default fallback.
        """
        user_id = None
        return_url = None
        consultation_id = None
        appointment_id = None

        if state:
            curr = str(state).strip()
            parsed_dict = None
            # Multi-pass decode to unwrap any double or triple URL-encoding
            for _ in range(4):
                try:
                    if curr.startswith("{") and curr.endswith("}"):
                        parsed_dict = json.loads(curr)
                        if isinstance(parsed_dict, dict):
                            break
                except Exception:
                    pass
                unquoted = urllib.parse.unquote(curr)
                if unquoted == curr:
                    break
                curr = unquoted

            if isinstance(parsed_dict, dict):
                user_id = parsed_dict.get("uid") or parsed_dict.get("user_id")
                return_url = parsed_dict.get("return_url")
                consultation_id = parsed_dict.get("consultation_id") or parsed_dict.get("consultId") or parsed_dict.get("id")
                appointment_id = parsed_dict.get("appointment_id") or parsed_dict.get("apptId")
            else:
                try:
                    qs = urllib.parse.parse_qs(curr)
                    if "return_url" in qs:
                        return_url = qs["return_url"][0]
                    if "consultation_id" in qs:
                        consultation_id = qs["consultation_id"][0]
                    if "appointment_id" in qs:
                        appointment_id = qs["appointment_id"][0]
                    if "uid" in qs:
                        user_id = qs["uid"][0]
                except Exception:
                    logger.warning(f"[OAuth Callback] Could not parse state string: {state}")

        # Fallback extract from return_url
        if return_url:
            try:
                parsed = urllib.parse.urlparse(return_url)
                path_parts = [p for p in parsed.path.split('/') if p]
                if not consultation_id and path_parts:
                    for part in reversed(path_parts):
                        if part not in ("consultation", "consultations", "telehealth", "workspace", "video", "doctor", "patient"):
                            consultation_id = part
                            break
                qs = urllib.parse.parse_qs(parsed.query)
                if not consultation_id and "id" in qs:
                    consultation_id = qs["id"][0]
                if not consultation_id and "consultation_id" in qs:
                    consultation_id = qs["consultation_id"][0]
                if not appointment_id and "appointment_id" in qs:
                    appointment_id = qs["appointment_id"][0]
            except Exception:
                pass

        if not user_id:
            logger.error("[OAuth Callback] SECURITY: No valid user_id in OAuth state — rejecting.")
            raise ValueError("GOOGLE_OAUTH_STATE_INVALID: OAuth state missing user identity. Cannot store token.")

        logger.info(
            f"[OAuth Callback] Code exchange: user={user_id}, consult={consultation_id}, appt={appointment_id}"
        )

        if not self.is_configured:
            logger.error("[OAuth Callback] GOOGLE_OAUTH_NOT_CONFIGURED during code exchange.")
            raise ValueError("GOOGLE_OAUTH_NOT_CONFIGURED: Google OAuth client credentials missing on backend.")

        redirect_uri_used = self.get_redirect_uri_for_request(return_url)
        logger.info(f"[OAuth Callback] Initiating token exchange with redirect_uri={redirect_uri_used}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                GOOGLE_TOKEN_ENDPOINT,
                data={
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": redirect_uri_used,
                    "grant_type": "authorization_code",
                },
            )

            if resp.status_code != 200:
                logger.error(f"[OAuth Callback] Token exchange failed with HTTP {resp.status_code}")
                raise ValueError(f"Failed to exchange Google OAuth code: HTTP {resp.status_code}")

            tokens = resp.json()
            access_token = tokens.get("access_token")
            refresh_token = tokens.get("refresh_token")
            expires_in = tokens.get("expires_in", 3600)
            scopes = tokens.get("scope", " ".join(REQUIRED_SCOPES))

            logger.info(f"[OAuth Callback] Token exchange successful. Scope: {scopes}")

            # Fetch user email if possible
            email = None
            try:
                userinfo_resp = await client.get(
                    GOOGLE_USERINFO_ENDPOINT,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if userinfo_resp.status_code == 200:
                    email = userinfo_resp.json().get("email")
                    logger.info(f"[OAuth Callback] Authenticated Google Account: {email}")
            except Exception as e:
                logger.warning(f"[OAuth Callback] Failed to fetch Google userinfo: {e}")

            token_rec = self._save_or_update_token(
                db=db,
                user_id=user_id,
                email=email,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=expires_in,
                scopes=scopes,
            )

            return {
                "success": True,
                "user_id": user_id,
                "email": token_rec.email,
                "return_url": return_url,
                "consultation_id": consultation_id,
                "appointment_id": appointment_id,
                # No meetingUri — Meet creation is only done via POST /api/meet/create
            }

    async def get_valid_access_token(self, user_id: str, db: Session) -> Optional[str]:
        """
        Retrieves a valid access token for the given user_id ONLY.
        Does NOT fall back to any other user's token.
        Raises RuntimeError if token refresh fails.
        """
        if not user_id:
            return None

        # Strict: only this doctor's token — no fallback to any other user
        token_rec = db.query(GoogleOAuthToken).filter(
            GoogleOAuthToken.user_id == user_id,
            GoogleOAuthToken.is_valid == True,
        ).first()

        if not token_rec or not token_rec.access_token:
            return None

        # Check expiration (with a 2-minute safety buffer)
        now = datetime.now(timezone.utc)
        if token_rec.expires_at and token_rec.expires_at > (now + timedelta(minutes=2)):
            return token_rec.access_token

        # Token is expired or about to expire; refresh it
        if not token_rec.refresh_token:
            logger.error(f"[OAuth] No refresh_token for user_id={user_id}. Must reconnect.")
            token_rec.is_valid = False
            db.commit()
            raise RuntimeError(f"GOOGLE_TOKEN_REFRESH_FAILED: No refresh token stored for user {user_id}. Doctor must reconnect Google.")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    GOOGLE_TOKEN_ENDPOINT,
                    data={
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "refresh_token": token_rec.refresh_token,
                        "grant_type": "refresh_token",
                    },
                )
                if resp.status_code == 200:
                    new_tokens = resp.json()
                    token_rec.access_token = new_tokens["access_token"]
                    expires_in = new_tokens.get("expires_in", 3600)
                    token_rec.expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                    if "refresh_token" in new_tokens:
                        token_rec.refresh_token = new_tokens["refresh_token"]
                    token_rec.is_valid = True
                    token_rec.updated_at = datetime.now(timezone.utc)
                    db.commit()
                    return token_rec.access_token
                else:
                    logger.error(f"[OAuth] Token refresh HTTP {resp.status_code} for user_id={user_id}")
                    token_rec.is_valid = False
                    db.commit()
                    raise RuntimeError(
                        f"GOOGLE_TOKEN_REFRESH_FAILED: Google returned HTTP {resp.status_code}. "
                        f"Doctor must reconnect Google account."
                    )
        except RuntimeError:
            raise
        except Exception as exc:
            logger.error(f"[OAuth] Refresh network error for user_id={user_id}: {exc}")
            raise RuntimeError(f"GOOGLE_TOKEN_REFRESH_FAILED: Network error during token refresh: {exc}")

    def get_connection_status(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Returns the current user's Google OAuth connection status. Strictly per-user only."""
        if not user_id:
            return {"connected": False, "is_connected": False, "googleEmail": None, "email": None,
                    "status": "AUTHENTICATION_REQUIRED", "scopes": [], "expires_at": None}

        token_rec = db.query(GoogleOAuthToken).filter(
            GoogleOAuthToken.user_id == user_id,
            GoogleOAuthToken.is_valid == True,
        ).first()

        if not token_rec or not token_rec.is_valid:
            return {
                "connected": False,
                "is_connected": False,
                "googleEmail": None,
                "email": None,
                "status": "GOOGLE_NOT_CONNECTED",
                "scopes": [],
                "expires_at": None,
            }

        return {
            "connected": True,
            "is_connected": True,
            "googleEmail": token_rec.email,
            "email": token_rec.email,
            "status": "GOOGLE_CONNECTED",
            "scopes": (token_rec.scopes or "").split(" ") if token_rec.scopes else REQUIRED_SCOPES,
            "expires_at": token_rec.expires_at.isoformat() if token_rec.expires_at else None,
        }

    # update_google_email removed: creating fake tokens is not allowed in production.
    # Doctors must connect via real OAuth flow (GET /api/google/auth).

    async def disconnect(self, user_id: str, db: Session) -> bool:
        """Revokes token with Google and deletes stored credentials for this user only."""
        if not user_id:
            return False
        token_rec = db.query(GoogleOAuthToken).filter(
            GoogleOAuthToken.user_id == user_id
        ).first()
        if token_rec:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        GOOGLE_REVOKE_ENDPOINT,
                        params={"token": token_rec.access_token},
                    )
                logger.info(f"[OAuth] Revoked Google token for user_id={user_id}")
            except Exception as e:
                logger.warning(f"[OAuth] Google revoke non-critical error: {e}")
            db.delete(token_rec)
            db.commit()
            logger.info(f"[OAuth] Deleted token record for user_id={user_id}")
            return True
        return False

    def _save_or_update_token(
        self,
        db: Session,
        user_id: str,
        email: Optional[str],
        access_token: str,
        refresh_token: Optional[str],
        expires_in: int,
        scopes: str,
    ) -> GoogleOAuthToken:
        token_rec = db.query(GoogleOAuthToken).filter(
            GoogleOAuthToken.user_id == user_id
        ).first()

        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        if token_rec:
            token_rec.access_token = access_token
            if refresh_token:
                token_rec.refresh_token = refresh_token
            if email:
                token_rec.email = email
            token_rec.expires_at = expires_at
            token_rec.scopes = scopes
            token_rec.is_valid = True
            token_rec.updated_at = datetime.now(timezone.utc)
        else:
            token_rec = GoogleOAuthToken(
                user_id=user_id,
                email=email,
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="Bearer",
                expires_at=expires_at,
                scopes=scopes,
                is_valid=True,
            )
            db.add(token_rec)

        # Token is strictly per user_id — no mirroring to default_doctor or any other record

        db.commit()
        db.refresh(token_rec)
        return token_rec


google_oauth_service = GoogleOAuthService()
