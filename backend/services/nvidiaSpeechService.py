"""
MediBridge AI — NVIDIA Speech Service Wrapper
Alias for app.services.nvidia_speech_service
"""

from app.services.nvidia_speech_service import (
    nvidia_speech_service,
    NvidiaSpeechService,
    SUPPORTED_AUDIO_MIME_TYPES,
)

# Export standard interfaces
transcribe_audio = nvidia_speech_service.transcribe_audio
validate_audio = nvidia_speech_service.validate_audio

__all__ = [
    "nvidia_speech_service",
    "NvidiaSpeechService",
    "transcribe_audio",
    "validate_audio",
    "SUPPORTED_AUDIO_MIME_TYPES",
]
