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
        state_payload = {"uid": user_id, "nonce": nonce}
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
        state_encoded = urllib.parse.quote(state_data)
        redirect_uri = self.get_redirect_uri_for_request(return_url)

        logger.info(
            f"[OAuth Start] Generating auth URL: user={user_id}, redirect_uri={redirect_uri}, "
            f"consultation={state_payload.get('consultation_id')}, appt={state_payload.get('appointment_id')}"
        )

        if not self.is_configured:
            mock_target = return_url or f"{self.frontend_url}/consultations"
            sep = "&" if "?" in mock_target else "?"
            mock_auth_url = f"{mock_target}{sep}google_mock_auth=success&uid={user_id}&state={state_encoded}"
            return {
                "auth_url": mock_auth_url,
                "state": state_encoded,
                "is_configured": False,
                "message": "Google Cloud Client ID not set in .env. Running in test mode.",
            }

        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(REQUIRED_SCOPES),
            "access_type": "offline",      # Required to receive a refresh token
            "prompt": "select_account consent",  # Allows doctor to choose or switch Google account
            "include_granted_scopes": "true",
            "state": state_encoded,
        }
        auth_url = f"{GOOGLE_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"
        return {
            "auth_url": auth_url,
            "state": state_encoded,
            "is_configured": True,
            "message": "Directing to official Google OAuth consent screen.",
        }

    async def exchange_code(self, code: str, state: str, db: Session) -> Dict[str, Any]:
        """
        Exchanges authorization code for access_token and refresh_token.
        Saves tokens securely in the database and returns user, consultation, and appointment context.
        """
        user_id = "default_doctor"
        return_url = None
        consultation_id = None
        appointment_id = None
        try:
            state_data = json.loads(urllib.parse.unquote(state))
            user_id = state_data.get("uid", "default_doctor")
            return_url = state_data.get("return_url")
            consultation_id = state_data.get("consultation_id")
            appointment_id = state_data.get("appointment_id")
        except Exception:
            logger.warning(f"[OAuth Callback] Could not parse state string: {state}")

        # Fallback extract from return_url
        if return_url:
            try:
                parsed = urllib.parse.urlparse(return_url)
                qs = urllib.parse.parse_qs(parsed.query)
                if not consultation_id and "id" in qs:
                    consultation_id = qs["id"][0]
                if not consultation_id and "consultation_id" in qs:
                    consultation_id = qs["consultation_id"][0]
                if not appointment_id and "appointment_id" in qs:
                    appointment_id = qs["appointment_id"][0]
            except Exception:
                pass

        logger.info(
            f"[OAuth Callback] Authorization code received (code_len={len(code)}). "
            f"user={user_id}, consult={consultation_id}, appt={appointment_id}, return_url={return_url}"
        )

        if not self.is_configured:
            mock_token = self._save_or_update_token(
                db=db,
                user_id=user_id,
                email="doctor@medibridge.ai",
                access_token="mock_meet_access_token_" + secrets.token_hex(16),
                refresh_token="mock_meet_refresh_token_" + secrets.token_hex(16),
                expires_in=86400 * 30,
                scopes=" ".join(REQUIRED_SCOPES),
            )
            return {
                "success": True,
                "user_id": user_id,
                "email": mock_token.email,
                "return_url": return_url,
                "consultation_id": consultation_id,
                "appointment_id": appointment_id,
                "is_mock": True,
            }

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
                "is_mock": False,
            }

    async def get_valid_access_token(self, user_id: str, db: Session) -> Optional[str]:
        """
        Retrieves a valid access token for the given user.
        Refreshes the token automatically if it is close to expiry.
        """
        token_rec = db.query(GoogleOAuthToken).filter(
            GoogleOAuthToken.user_id == user_id,
            GoogleOAuthToken.is_valid == True,
        ).first()

        # Fallback to any active token in DB if specific user_id not found (e.g. system default)
        if not token_rec:
            token_rec = db.query(GoogleOAuthToken).filter(GoogleOAuthToken.is_valid == True).first()

        if not token_rec:
            if not self.is_configured:
                # Auto-create mock token for offline/development use
                token_rec = self._save_or_update_token(
                    db=db,
                    user_id=user_id,
                    email="doctor@medibridge.ai",
                    access_token="mock_meet_access_token_" + secrets.token_hex(16),
                    refresh_token="mock_meet_refresh_token_" + secrets.token_hex(16),
                    expires_in=86400 * 30,
                    scopes=" ".join(REQUIRED_SCOPES),
                )
                return token_rec.access_token
            return None

        # Check if token is mock or custom
        if token_rec.access_token and token_rec.access_token.startswith(("mock_", "custom_")):
            return token_rec.access_token

        # Check expiration (with a 5-minute safety buffer)
        now = datetime.now(timezone.utc)
        if token_rec.expires_at and token_rec.expires_at > (now + timedelta(minutes=5)):
            return token_rec.access_token

        # Token is expired or about to expire; refresh it
        if not token_rec.refresh_token:
            logger.warning("No refresh token stored for Google OAuth user.")
            return None

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
                    token_rec.updated_at = datetime.now(timezone.utc)
                    db.commit()
                    return token_rec.access_token
                else:
                    logger.error(f"Google token refresh failed: {resp.status_code} - {resp.text}")
                    token_rec.is_valid = False
                    db.commit()
                    return None
        except Exception as exc:
            logger.error(f"Error refreshing Google OAuth token: {exc}")
            return None

    def get_connection_status(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Returns the current user's Google Meet OAuth connection status."""
        token_rec = db.query(GoogleOAuthToken).filter(
            GoogleOAuthToken.user_id == user_id,
            GoogleOAuthToken.is_valid == True,
        ).first()

        if not token_rec:
            token_rec = db.query(GoogleOAuthToken).filter(GoogleOAuthToken.is_valid == True).first()

        if not token_rec:
            return {
                "is_connected": False,
                "email": None,
                "scopes": [],
                "expires_at": None,
                "is_mock": not self.is_configured,
            }

        return {
            "is_connected": True,
            "email": token_rec.email,
            "scopes": (token_rec.scopes or "").split(" ") if token_rec.scopes else REQUIRED_SCOPES,
            "expires_at": token_rec.expires_at.isoformat() if token_rec.expires_at else None,
            "is_mock": token_rec.access_token.startswith("mock_") if token_rec.access_token else False,
        }

    def update_google_email(self, user_id: str, email: str, db: Session) -> Dict[str, Any]:
        """
        Updates the doctor's Google Account email specifically for Google Meet.
        """
        token_rec = db.query(GoogleOAuthToken).filter(
            GoogleOAuthToken.user_id == user_id,
        ).first()

        if not token_rec:
            token_rec = db.query(GoogleOAuthToken).first()

        clean_email = email.strip() if email else ""
        if token_rec:
            token_rec.email = clean_email
            token_rec.is_valid = True
            token_rec.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(token_rec)
        else:
            token_rec = self._save_or_update_token(
                db=db,
                user_id=user_id,
                email=clean_email,
                access_token="custom_meet_token_" + secrets.token_hex(16),
                refresh_token="custom_meet_refresh_" + secrets.token_hex(16),
                expires_in=86400 * 30,
                scopes=" ".join(REQUIRED_SCOPES),
            )

        return {
            "success": True,
            "email": token_rec.email,
            "is_connected": True,
            "message": f"Google Meet account updated to {token_rec.email}",
        }

    async def disconnect(self, user_id: str, db: Session) -> bool:
        """Revokes token and removes stored credentials."""
        token_rec = db.query(GoogleOAuthToken).filter(
            GoogleOAuthToken.user_id == user_id
        ).first()
        if not token_rec:
            token_rec = db.query(GoogleOAuthToken).first()

        if token_rec:
            # Best effort revoke with Google
            if not token_rec.access_token.startswith("mock_"):
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        await client.post(
                            GOOGLE_REVOKE_ENDPOINT,
                            params={"token": token_rec.access_token},
                        )
                except Exception as e:
                    logger.warning(f"Google revoke call note: {e}")

            db.delete(token_rec)
            db.commit()
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

        db.commit()
        db.refresh(token_rec)
        return token_rec


google_oauth_service = GoogleOAuthService()
