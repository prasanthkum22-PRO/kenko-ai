"""
MediBridge AI — Speech Recognition & Speaker Diarization Service
Powered by faster-whisper (CTranslate2) with multilingual support (English, Tamil, Code-Mixed)
and speaker diarization. Runs 100% locally on CPU/GPU.
"""

import os
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# Model configuration from environment
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
HF_TOKEN = os.getenv("HF_TOKEN", "")

_whisper_model = None
_whisper_available = True

# Language code to human name mapping
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


def _get_whisper_model():
    """Lazy-load the faster-whisper model singleton on CPU with safety check."""
    global _whisper_model, _whisper_available
    if not _whisper_available:
        return None

    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            logger.info(f"Loading faster-whisper model '{WHISPER_MODEL_SIZE}' on CPU (int8)...")
            _whisper_model = WhisperModel(
                WHISPER_MODEL_SIZE,
                device="cpu",
                compute_type="int8",
            )
            logger.info("faster-whisper model loaded successfully.")
        except Exception as exc:
            logger.warning(f"faster-whisper initialization note: {exc}")
            _whisper_available = False
            _whisper_model = None
    return _whisper_model


class SpeechRecognitionService:
    """
    Standardized SpeechRecognitionService interface providing:
    - transcribe(audio_path) -> Tuple[List[Dict[str, Any]], str] (segments, detected_language)
    - identify_speakers(segments, audio_path)
    """

    def __init__(self, model_size: str = WHISPER_MODEL_SIZE):
        self.model_size = model_size

    def transcribe(self, audio_path: str) -> Tuple[List[Dict[str, Any]], str]:
        """
        Transcribes audio file to timestamped segments with multilingual support (English, Tamil, Code-Mixed).
        Returns: (segments_list, detected_language_name)
        """
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found at: {audio_path}")

        model = _get_whisper_model()
        if model is None:
            raise RuntimeError(
                "Whisper speech recognition model is unavailable on this system. "
                "Please verify faster-whisper installation or use Demo Mode."
            )

        try:
            # Note: language=None enables automatic multilingual language detection (English, Tamil, etc.)
            segments_generator, info = model.transcribe(
                str(path),
                beam_size=5,
                language=None,  # Auto-detect language! Supports English, Tamil, Code-Mixed
                condition_on_previous_text=False,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
            )

            detected_code = getattr(info, "language", "en")
            detected_prob = getattr(info, "language_probability", 1.0)
            lang_name = LANGUAGE_MAP.get(detected_code, detected_code.title())

            raw_segments = []
            has_tamil_chars = False
            has_english_words = False

            for seg in segments_generator:
                text = seg.text.strip()
                if text:
                    # Check for code-mixed speech characteristics
                    if any("\u0b80" <= char <= "\u0bff" for char in text):
                        has_tamil_chars = True
                    if any(char.isascii() and char.isalpha() for char in text):
                        has_english_words = True

                    raw_segments.append({
                        "start": round(seg.start, 2),
                        "end": round(seg.end, 2),
                        "text": text,
                        "confidence": round(float(getattr(seg, "avg_logprob", -0.2)), 3),
                    })

            if not raw_segments:
                raise ValueError("No speech could be detected or transcribed from the provided audio file.")

            # Identify code-mixed speech
            if (has_tamil_chars and has_english_words) or (detected_code == "ta" and has_english_words):
                detected_language_label = "Tamil + English (Mixed)"
            else:
                detected_language_label = lang_name

            diarized_segments = self.identify_speakers(raw_segments, audio_path)
            return diarized_segments, detected_language_label

        except Exception as exc:
            logger.error(f"faster-whisper transcription error: {exc}")
            raise RuntimeError(f"Speech transcription failed: {exc}")

    def identify_speakers(
        self, segments: List[Dict[str, Any]], audio_path: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Assigns speaker roles ('Doctor', 'Patient', 'Nurse') to transcript segments.
        Uses pyannote.audio if HF_TOKEN is configured; otherwise uses a clinical conversational turn heuristic.
        """
        if HF_TOKEN:
            try:
                from pyannote.audio import Pipeline
                pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-community-1",
                    use_auth_token=HF_TOKEN,
                )
                if audio_path and Path(audio_path).exists():
                    diarization = pipeline(audio_path)
                    aligned = []
                    for seg in segments:
                        midpoint = (seg["start"] + seg["end"]) / 2.0
                        assigned_speaker = "Doctor"
                        for turn, _, speaker_label in diarization.itertracks(yield_label=True):
                            if turn.start <= midpoint <= turn.end:
                                assigned_speaker = (
                                    "Doctor" if "0" in speaker_label else "Patient"
                                )
                                break
                        seg["speaker"] = assigned_speaker
                        aligned.append(seg)
                    return aligned
            except Exception as exc:
                logger.warning(
                    f"pyannote.audio diarization unavailable ({exc}), falling back to turn heuristic."
                )

        # Fallback: Conversational Turn & Clinical Marker Heuristic (Multilingual English + Tamil keywords)
        current_speaker = "Doctor"
        doctor_markers = [
            "how are you", "what brings you", "let me examine", "blood pressure", "take",
            "tablet", "capsule", "prescription", "tests", "follow up", "diagnosis", "listen",
            "breathe", "how long", "any fever", "i am prescribing", "mg", "twice a day",
            "vaanga", "kudunga", "saapudunga", "marundhu", "test edunga", "review-ku"
        ]
        patient_markers = [
            "i feel", "i have had", "since monday", "it hurts", "coughing", "chest pain",
            "headache", "doctor", "i took", "vomiting", "feeling dizzy", "my throat", "yes doctor",
            "irukku", "valikidhu", "fever irukku", "aaguthu", "doctor ayya", "sari doctor"
        ]

        result = []
        for i, seg in enumerate(segments):
            text_lower = seg["text"].lower()

            doc_score = sum(1 for m in doctor_markers if m in text_lower)
            pat_score = sum(1 for m in patient_markers if m in text_lower)

            if doc_score > pat_score:
                speaker = "Doctor"
            elif pat_score > doc_score:
                speaker = "Patient"
            else:
                if i > 0 and (seg["start"] - segments[i - 1]["end"]) > 1.2:
                    current_speaker = "Patient" if current_speaker == "Doctor" else "Doctor"
                speaker = current_speaker

            current_speaker = speaker
            seg["speaker"] = speaker
            result.append(seg)

        return result


# Singleton service instance
speech_service = SpeechRecognitionService()
