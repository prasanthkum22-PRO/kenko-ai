# Local faster-whisper / pyannote.audio models have been removed.
# speech.py is now a compatibility shim; retained only for legacy imports.
from app.services.speech import speech_service, SpeechRecognitionService
from app.services.clinical_ai import clinical_ai_service, ClinicalAIService
from app.services.prescription_parser import parse_prescription_text
from app.services.router import route_approved_consultation
from app.services.audit import log_action
from app.services.google_oauth_service import google_oauth_service, GoogleOAuthService
from app.services.google_meet_service import google_meet_service, GoogleMeetService
from app.services.participant_service import participant_service, ParticipantService
from app.services.transcript_service import transcript_service, TranscriptService
from app.services.nvidia_speech_service import nvidia_speech_service, NvidiaSpeechService

__all__ = [
    # --- NVIDIA Cloud STT (primary / only STT engine) ---
    "nvidia_speech_service",
    "NvidiaSpeechService",
    # --- Compatibility shim (local models removed) ---
    "speech_service",
    "SpeechRecognitionService",
    # --- Other services ---
    "clinical_ai_service",
    "ClinicalAIService",
    "parse_prescription_text",
    "route_approved_consultation",
    "log_action",
    "google_oauth_service",
    "GoogleOAuthService",
    "google_meet_service",
    "GoogleMeetService",
    "participant_service",
    "ParticipantService",
    "transcript_service",
    "TranscriptService",
]
