"""
MediBridge AI — Speech Service (NVIDIA Cloud Only)

All local speech-to-text models (faster-whisper, pyannote.audio) have been removed.
Transcription is now handled exclusively by the NVIDIA hosted API via NvidiaSpeechService.
This file is kept as a compatibility shim so existing imports do not break.
"""

from app.services.nvidia_speech_service import (
    nvidia_speech_service,
    NvidiaSpeechService,
)

# ---------------------------------------------------------------------------
# Compatibility shim — maps old names to the NVIDIA service
# ---------------------------------------------------------------------------

# Language map kept here for shared use across the codebase
LANGUAGE_MAP = {
    "en": "English",
    "ta": "Tamil",
    "hi": "Hindi",
    "te": "Telugu",
    "kn": "Kannada",
    "ml": "Malayalam",
    "mr": "Marathi",
    "bn": "Bengali",
}


class SpeechRecognitionService:
    """
    Compatibility wrapper that delegates all calls to NvidiaSpeechService.
    The local faster-whisper / pyannote models have been permanently removed.
    """

    def transcribe(self, audio_path: str):
        """Delegate to NVIDIA cloud STT service."""
        raise NotImplementedError(
            "Local faster-whisper has been removed. "
            "Use nvidia_speech_service.transcribe_audio() directly."
        )

    def identify_speakers(self, segments, audio_path=None):
        """Delegate to NVIDIA cloud STT service."""
        raise NotImplementedError(
            "Local pyannote.audio has been removed. "
            "Speaker diarization is handled inside NvidiaSpeechService."
        )


# Singleton kept for import compatibility
speech_service = SpeechRecognitionService()
