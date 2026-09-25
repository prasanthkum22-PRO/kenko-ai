"""
MediBridge AI — NVIDIA Hosted Speech-to-Text Service
Integrates NVIDIA's hosted AI ASR API (Whisper-Large-v3 / Canary) for medical consultation speech transcription.
All API communication is executed securely server-side.
API keys and raw audio contents are never exposed to the frontend or logged.   

"""

import os
import io
import logging
from typing import Dict, Any, List, Optional
import httpx
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

# Supported audio MIME types for medical consultations
SUPPORTED_AUDIO_MIME_TYPES = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/mp3": ".mp3",
    "audio/mpeg": ".mp3",
    "audio/webm": ".webm",
    "audio/webm;codecs=opus": ".webm",
    "audio/ogg": ".ogg",
    "audio/ogg;codecs=opus": ".ogg",
    "audio/m4a": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/mp4": ".mp4",
    "audio/flac": ".flac",
    "audio/x-flac": ".flac",
}

SUPPORTED_EXTENSIONS = {".wav", ".mp3", ".webm", ".ogg", ".m4a", ".mp4", ".flac"}


class NvidiaSpeechService:
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY", "").strip()
        self.stt_model = os.getenv("NVIDIA_STT_MODEL", "openai/whisper-large-v3").strip()
        self.endpoint = os.getenv(
            "NVIDIA_STT_ENDPOINT",
            "https://integrate.api.nvidia.com/v1/audio/transcriptions"
        ).strip()
        
        try:
            self.max_audio_size_mb = int(os.getenv("NVIDIA_MAX_AUDIO_SIZE_MB", "25"))
        except ValueError:
            self.max_audio_size_mb = 25

    @property
    def is_configured(self) -> bool:
        """Checks if the NVIDIA API Key is present in the environment."""
        # Refresh from env in case it was updated dynamically
        self.api_key = os.getenv("NVIDIA_API_KEY", "").strip()
        return bool(self.api_key)

    def validate_audio(
        self,
        audio_bytes: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> None:
        """
        Validates the audio payload format, non-empty condition, and file size limits.
        Raises HTTPException with safe clinical error messages on failure.
        """
        if not audio_bytes or len(audio_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid audio payload: Audio file is empty.",
            )

        # Enforce configurable maximum file size
        max_bytes = self.max_audio_size_mb * 1024 * 1024
        if len(audio_bytes) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Audio file size ({round(len(audio_bytes) / (1024 * 1024), 2)}MB) exceeds the maximum allowed limit of {self.max_audio_size_mb}MB.",
            )

        # Validate MIME type or file extension
        is_valid_mime = False
        if content_type:
            clean_mime = content_type.lower().split(";")[0].strip()
            if clean_mime in SUPPORTED_AUDIO_MIME_TYPES or content_type.lower() in SUPPORTED_AUDIO_MIME_TYPES:
                is_valid_mime = True

        is_valid_ext = False
        if filename:
            ext = os.path.splitext(filename)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                is_valid_ext = True

        if not is_valid_mime and not is_valid_ext:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported audio format. Supported formats include WAV, MP3, WebM, OGG, M4A, and FLAC.",
            )

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        filename: str = "consultation_recording.wav",
        content_type: str = "audio/wav",
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Transcribes authorized medical consultation audio using NVIDIA's hosted Speech-to-Text API.
        Normalizes the response into a structured format with timestamps.
        Never logs audio content or the API key.
        """
        # 1. Validate audio inputs
        self.validate_audio(audio_bytes, filename=filename, content_type=content_type)

        # Refresh API key & Model
        self.api_key = os.getenv("NVIDIA_API_KEY", "").strip()
        self.stt_model = os.getenv("NVIDIA_STT_MODEL", "openai/whisper-large-v3").strip()

        # 2. Check configuration / Mock mode fallback
        if not self.is_configured:
            logger.info("NVIDIA_API_KEY not configured. Running in mock/simulation mode.")
            return self._generate_mock_transcript(filename=filename, language=language)

        # 3. Clean MIME type for multipart upload
        clean_mime = content_type.split(";")[0].strip() if content_type else "audio/wav"
        if not clean_mime or clean_mime == "application/octet-stream":
            ext = os.path.splitext(filename)[1].lower()
            clean_mime = "audio/webm" if ext == ".webm" else "audio/wav"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }

        form_fields = {
            "model": self.stt_model,
            "response_format": "verbose_json",
            "temperature": "0.0",
        }
        if language:
            form_fields["language"] = language

        files = {
            "file": (filename, audio_bytes, clean_mime),
        }

        # 4. Execute request to hosted NVIDIA endpoint
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.endpoint,
                    headers=headers,
                    data=form_fields,
                    files=files,
                )

                if response.status_code == 200:
                    raw_data = response.json()
                    return self._normalize_nvidia_response(raw_data)

                # Error handling based on HTTP status
                if response.status_code == 401:
                    logger.error("NVIDIA STT API 401: Authentication failed.")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Speech transcription service authentication failed. Please verify API key configuration.",
                    )
                elif response.status_code == 403:
                    logger.error("NVIDIA STT API 403: Model access forbidden.")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access to the speech transcription model is forbidden.",
                    )
                elif response.status_code == 429:
                    logger.warning("NVIDIA STT API 429: Rate limit exceeded.")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Speech transcription rate limit reached. Please try again shortly.",
                    )
                elif response.status_code == 400:
                    logger.warning(f"NVIDIA STT API 400: Bad request.")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid audio payload submitted for speech transcription.",
                    )
                elif response.status_code == 413:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Audio payload exceeds the provider maximum file size limit.",
                    )
                else:
                    logger.error(f"NVIDIA STT API Error: Status {response.status_code}")
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Speech transcription service is temporarily unavailable.",
                    )

        except httpx.TimeoutException:
            logger.error("NVIDIA STT API request timed out.")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Speech transcription request timed out. Please try with a shorter audio segment.",
            )
        except httpx.RequestError as exc:
            logger.error(f"NVIDIA STT network connection error: {exc.__class__.__name__}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Speech transcription service is temporarily unavailable.",
            )

    def _normalize_nvidia_response(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalizes NVIDIA STT API response into standardized structure:
        {
          "text": "...",
          "language": "...",
          "segments": [
            {
              "start": 0.0,
              "end": 4.0,
              "text": "..."
            }
          ]
        }
        """
        full_text = raw.get("text", "").strip()
        detected_lang = raw.get("language", "english")
        raw_segments = raw.get("segments", [])

        normalized_segments: List[Dict[str, Any]] = []

        if raw_segments and isinstance(raw_segments, list):
            for seg in raw_segments:
                seg_text = seg.get("text", "").strip()
                if not seg_text:
                    continue
                normalized_segments.append({
                    "start": float(seg.get("start", 0.0)),
                    "end": float(seg.get("end", 0.0)),
                    "text": seg_text,
                    "confidence": float(seg.get("confidence", 0.98)) if "confidence" in seg else 0.98,
                })

        # Fallback if no segments were provided by API
        if not normalized_segments and full_text:
            normalized_segments.append({
                "start": 0.0,
                "end": float(raw.get("duration", 5.0)),
                "text": full_text,
                "confidence": 0.95,
            })

        return {
            "text": full_text,
            "language": detected_lang,
            "duration": float(raw.get("duration", 0.0)),
            "segments": normalized_segments,
            "words": raw.get("words", []),
            "provider": f"NVIDIA Hosted AI ({self.stt_model})",
        }

    def _generate_mock_transcript(
        self,
        filename: str = "mock_audio.wav",
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Provides realistic clinical conversation transcript for testing and offline environments.
        """
        segments = [
            {
                "start": 0.0,
                "end": 3.8,
                "text": "Hello, thank you for joining the consultation today. How have you been feeling?",
                "confidence": 0.99,
            },
            {
                "start": 4.2,
                "end": 9.5,
                "text": "Good morning Doctor. I've been having continuous knee stiffness and mild swelling over the past week.",
                "confidence": 0.98,
            },
            {
                "start": 10.0,
                "end": 14.8,
                "text": "I see. Does the pain worsen when you walk upstairs or when you stand for prolonged periods?",
                "confidence": 0.99,
            },
            {
                "start": 15.2,
                "end": 20.1,
                "text": "Yes, especially in the mornings and after climbing stairs at work.",
                "confidence": 0.97,
            },
            {
                "start": 20.6,
                "end": 27.0,
                "text": "Understood. I will prescribe a mild anti-inflammatory medication and order a bilateral knee X-ray to evaluate the joint space.",
                "confidence": 0.99,
            },
        ]
        full_text = " ".join([s["text"] for s in segments])

        return {
            "text": full_text,
            "language": language or "english",
            "duration": 27.0,
            "segments": segments,
            "words": [],
            "provider": f"NVIDIA Hosted AI Mock Mode ({self.stt_model})",
            "is_mock": True,
        }


# Singleton service instance
nvidia_speech_service = NvidiaSpeechService()
