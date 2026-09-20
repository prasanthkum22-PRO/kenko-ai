"""
MediBridge AI — Clinical AI Facade Service
Delegates to ai_service for Ollama LLM extraction and structured parsing.
"""

from typing import List, Dict, Any, Optional
from app.services.ai_service import ai_service


class ClinicalAIService:
    """
    Facade interface delegating to Ollama LLM AI service.
    """

    def extract_summary(
        self,
        segments: List[Dict[str, Any]],
        patient_info: Optional[Dict[str, Any]] = None,
        detected_language: str = "English",
    ) -> Dict[str, Any]:
        """
        Extracts structured clinical summary from transcript segments using Ollama LLM.
        """
        return ai_service.summarize_and_extract(
            segments=segments,
            patient_info=patient_info,
            detected_language=detected_language,
        )


clinical_ai_service = ClinicalAIService()
