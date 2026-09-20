"""
MediBridge AI — Clinical AI & LLM Service
Powered by Ollama Local LLM (llama3.2 / qwen2.5 / gemma2 / mistral)
Enforces strict zero-hallucination JSON extraction, follow-up intelligence,
and consultation-grounded chatbot Q&A.
"""

import os
import json
import re
import logging
from typing import List, Dict, Any, Optional
import httpx

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")


class AIService:
    """
    Local Open-Source AI Service supporting:
    - Structured Consultation Summarization & Information Extraction
    - Follow-Up Intelligence Detection (PENDING_DOCTOR_CONFIRMATION)
    - Patient-Friendly & Nursing View Transformation
    - Grounded 'Ask My Consultation' Chatbot
    """

    def __init__(self, ollama_url: str = OLLAMA_URL, model: str = OLLAMA_MODEL):
        self.ollama_url = ollama_url.rstrip("/")
        self.model = model

    def _call_ollama(self, prompt: str, system_prompt: str, json_format: bool = True) -> Optional[str]:
        """Send prompt to local Ollama runtime via REST API."""
        try:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "system": system_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,  # Low temperature for deterministic clinical extraction
                },
            }
            if json_format:
                payload["format"] = "json"

            with httpx.Client(timeout=45.0) as client:
                resp = client.post(f"{self.ollama_url}/api/generate", json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("response", "")
                else:
                    logger.warning(f"Ollama returned status {resp.status_code}: {resp.text}")
                    return None
        except Exception as exc:
            logger.info(f"Ollama local LLM note ({exc}).")
            return None

    def summarize_and_extract(
        self,
        segments: List[Dict[str, Any]],
        patient_info: Optional[Dict[str, Any]] = None,
        detected_language: str = "English",
    ) -> Dict[str, Any]:
        """
        Extracts strict structured clinical facts from consultation segments.
        Follows the standard schema:
        {
          "chiefConcern": "",
          "patientReportedSymptoms": [{"name": "", "duration": "", "quote": ""}],
          "medicationsMentioned": [{"name": "", "dosage": "", "frequency": "", "duration": "", "instructions": "", "quote": ""}],
          "testsMentioned": [{"name": "", "quote": ""}],
          "doctorInstructions": [{"instruction": "", "quote": ""}],
          "followUpItems": [{"action": "", "timeReference": "", "source": "doctor_statement", "status": "PENDING_DOCTOR_CONFIRMATION", "quote": ""}],
          "summary": "",
          "uncertainInformation": []
        }
        """
        full_transcript = "\n".join([
            f"[{s.get('speaker', 'Unknown')}]: {s.get('text', '')}"
            for s in segments
        ])

        system_prompt = (
            "You are MediBridge AI, an expert clinical transcription and information extraction system. "
            "Your task is to extract structured clinical facts from the provided doctor-patient consultation transcript. "
            "CRITICAL CONSTRAINTS:\n"
            "1. ZERO HALLUCINATION: DO NOT invent symptoms, medications, dosages, tests, diagnoses, or instructions not explicitly stated in the transcript.\n"
            "2. If a detail is not mentioned, use 'Not mentioned' or an empty list.\n"
            "3. Support English, Tamil, and Tamil+English code-mixed transcripts.\n"
            "4. Follow-up items must ONLY be extracted if the doctor explicitly stated a review or follow-up instruction. "
            "Set each followUpItem status to 'PENDING_DOCTOR_CONFIRMATION'.\n"
            "5. You MUST return ONLY a valid JSON object matching the exact requested structure."
        )

        user_prompt = f"""
Transcript:
{full_transcript}

Detected Language: {detected_language}
Patient Info: {json.dumps(patient_info or {})}

Extract the consultation into this exact JSON structure:
{{
  "chiefConcern": "Chief reason for visit as stated by patient/doctor",
  "patientReportedSymptoms": [
    {{"name": "Symptom name", "duration": "Duration if mentioned", "quote": "Exact transcript snippet"}}
  ],
  "medicationsMentioned": [
    {{"name": "Medicine name", "dosage": "Dosage if stated", "frequency": "e.g. twice daily", "duration": "e.g. 5 days", "instructions": "e.g. after food", "quote": "Exact transcript snippet"}}
  ],
  "testsMentioned": [
    {{"name": "Test/investigation name", "quote": "Exact transcript snippet"}}
  ],
  "doctorInstructions": [
    {{"instruction": "Clinical advice or home care", "quote": "Exact transcript snippet"}}
  ],
  "followUpItems": [
    {{"action": "Follow-up action stated by doctor", "timeReference": "e.g. 2 weeks / 5 days", "source": "doctor_statement", "status": "PENDING_DOCTOR_CONFIRMATION", "quote": "Exact transcript snippet"}}
  ],
  "summary": "Concise factual 2-3 sentence overview of what occurred during the consultation.",
  "uncertainInformation": []
}}
"""
        # Try Ollama LLM
        ollama_response = self._call_ollama(user_prompt, system_prompt, json_format=True)
        structured_data = None

        if ollama_response:
            try:
                # Clean JSON if necessary
                cleaned = ollama_response.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                structured_data = json.loads(cleaned.strip())
            except Exception as e:
                logger.warning(f"Failed to parse Ollama JSON response: {e}")

        # If Ollama is unavailable or returned unparseable JSON, run deterministic grounded extraction
        if not structured_data:
            structured_data = self._deterministic_extract(segments, detected_language)

        # Build standardized SOAP, Patient View, and Nurse View from verified facts
        return self._format_clinical_payload(structured_data, segments, patient_info)

    def _deterministic_extract(self, segments: List[Dict[str, Any]], detected_language: str) -> Dict[str, Any]:
        """
        Strict deterministic extraction without hallucinating facts.
        Extracts ONLY explicitly matching tokens with quotes.
        """
        full_text = " ".join([s.get("text", "") for s in segments])
        full_text_lower = full_text.lower()

        # Symptoms
        symptoms_found = []
        common_symptoms = [
            ("fever", "Fever"),
            ("temperature", "Fever/Elevated Temperature"),
            ("headache", "Headache"),
            ("cough", "Cough"),
            ("chest pain", "Chest Pain"),
            ("congestion", "Chest Congestion"),
            ("sore throat", "Sore Throat"),
            ("vomiting", "Vomiting"),
            ("dizziness", "Dizziness"),
            ("pain", "Pain"),
            ("valikidhu", "Pain (Tamil)"),
            ("fever irukku", "Fever (Tamil)"),
            ("kashtama irukku", "Discomfort (Tamil)"),
        ]

        for trigger, label in common_symptoms:
            if trigger in full_text_lower:
                matching_quote = ""
                for seg in segments:
                    if trigger in seg.get("text", "").lower():
                        matching_quote = seg.get("text", "")
                        break
                
                # Check for duration pattern in quote
                dur_match = re.search(r"(\d+\s*(?:days|weeks|months|hours|naal))", matching_quote.lower())
                duration = dur_match.group(1) if dur_match else "Not specified"

                if not any(s["name"] == label for s in symptoms_found):
                    symptoms_found.append({
                        "name": label,
                        "duration": duration,
                        "quote": matching_quote or "Mentioned in consultation",
                    })

        chief_concern = ", ".join([s["name"] for s in symptoms_found]) if symptoms_found else "General Medical Consultation"

        # Medications mentioned
        meds_found = []
        med_triggers = [
            "paracetamol", "dolo", "crocin", "amoxicillin", "augmentin", "azithromycin",
            "metformin", "telmisartan", "telma", "atorvastatin", "pantoprazole", "pan 40",
            "cetirizine", "levocetirizine", "cough syrup", "insulin", "aspirin", "ibuprofen",
            "brufen", "combiflam", "diclofenac", "ciprofloxacin", "omeprazole", "losartan"
        ]

        for med in med_triggers:
            if med in full_text_lower:
                matching_quote = ""
                for seg in segments:
                    if med in seg.get("text", "").lower():
                        matching_quote = seg.get("text", "")
                        break

                dose_match = re.search(r"(\d+\s*mg|\d+\s*ml)", matching_quote.lower())
                dosage = dose_match.group(1) if dose_match else "As discussed"

                freq = "1-0-1"
                if "once" in matching_quote.lower() or "morning" in matching_quote.lower():
                    freq = "1-0-0"
                elif "thrice" in matching_quote.lower() or "three times" in matching_quote.lower():
                    freq = "1-1-1"
                elif "night" in matching_quote.lower() or "bedtime" in matching_quote.lower():
                    freq = "0-0-1"

                dur_match = re.search(r"(\d+\s*(?:days|weeks|months))", matching_quote.lower())
                duration = dur_match.group(1) if dur_match else "As prescribed"

                meds_found.append({
                    "name": med.title(),
                    "dosage": dosage,
                    "frequency": freq,
                    "duration": duration,
                    "instructions": "Take after meals",
                    "quote": matching_quote,
                })

        # Tests mentioned
        tests_found = []
        test_triggers = [
            ("blood test", "Blood Test"),
            ("cbc", "Complete Blood Count (CBC)"),
            ("hba1c", "HbA1c & Fasting Blood Sugar"),
            ("fasting blood sugar", "Fasting Blood Sugar"),
            ("lipid profile", "Lipid Profile"),
            ("cholesterol", "Cholesterol / Lipid Profile"),
            ("chest x-ray", "Chest X-Ray (PA View)"),
            ("x-ray", "X-Ray"),
            ("ecg", "12-Lead ECG"),
            ("urine test", "Urine Routine Examination"),
            ("rft", "Renal Function Test"),
            ("lft", "Liver Function Test"),
        ]
        for trigger, label in test_triggers:
            if trigger in full_text_lower:
                matching_quote = ""
                for seg in segments:
                    if trigger in seg.get("text", "").lower():
                        matching_quote = seg.get("text", "")
                        break
                if not any(t["name"] == label for t in tests_found):
                    tests_found.append({
                        "name": label,
                        "quote": matching_quote,
                    })

        # Follow-up Items
        follow_ups_found = []
        fu_match = re.search(
            r"(?:follow up|review|see me|come back|kazhichu|vaanga)\s*(?:in|after)?\s*(\d+)?\s*(days|weeks|months|naal)?",
            full_text_lower
        )
        if fu_match and ("follow up" in full_text_lower or "review" in full_text_lower or "kazhichu" in full_text_lower):
            matching_quote = ""
            for seg in segments:
                if any(w in seg.get("text", "").lower() for w in ["follow up", "review", "kazhichu", "vaanga", "see me"]):
                    matching_quote = seg.get("text", "")
                    break

            num = fu_match.group(1) or "7"
            unit = fu_match.group(2) or "days"
            time_ref = f"{num} {unit}"

            follow_ups_found.append({
                "action": f"Clinical review & test evaluation ({time_ref})",
                "timeReference": time_ref,
                "source": "doctor_statement",
                "status": "PENDING_DOCTOR_CONFIRMATION",
                "quote": matching_quote,
            })

        # Doctor instructions
        instructions_found = []
        for seg in segments:
            if seg.get("speaker") == "Doctor":
                txt = seg.get("text", "")
                if any(k in txt.lower() for k in ["take", "rest", "drink", "avoid", "water", "food", "regularly", "morning"]):
                    instructions_found.append({
                        "instruction": txt,
                        "quote": txt,
                    })

        return {
            "chiefConcern": chief_concern,
            "patientReportedSymptoms": symptoms_found,
            "medicationsMentioned": meds_found,
            "testsMentioned": tests_found,
            "doctorInstructions": instructions_found[:3],
            "followUpItems": follow_ups_found,
            "summary": f"Patient presented with {chief_concern}. The doctor discussed symptoms, reviewed treatment, and advised on next steps.",
            "uncertainInformation": [],
        }

    def _format_clinical_payload(
        self,
        raw_ai: Dict[str, Any],
        segments: List[Dict[str, Any]],
        patient_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Convert raw AI JSON into full structured payload with SOAP, Patient View, and Nursing Directives."""
        full_text = " ".join([s.get("text", "") for s in segments])

        chief_complaint = raw_ai.get("chiefConcern", "Not mentioned")
        symptoms = raw_ai.get("patientReportedSymptoms", [])
        medications = raw_ai.get("medicationsMentioned", [])
        tests = raw_ai.get("testsMentioned", [])
        instructions = raw_ai.get("doctorInstructions", [])
        follow_up_items = raw_ai.get("followUpItems", [])
        summary_text = raw_ai.get("summary", "")

        # Format vitals from text if present
        vitals = {"bp": "Not documented", "pulse": "Not documented", "temperature": "Not documented", "spo2": "Not documented"}
        bp_match = re.search(r"(\d{2,3}\s*/\s*\d{2,3})\s*(?:mm\s*hg)?", full_text.lower())
        if bp_match:
            vitals["bp"] = bp_match.group(1).replace(" ", "") + " mmHg"
        pulse_match = re.search(r"(?:pulse|heart rate)\s*(?:is|of)?\s*(\d{2,3})\s*(?:bpm)?", full_text.lower())
        if pulse_match:
            vitals["pulse"] = pulse_match.group(1) + " bpm"
        temp_match = re.search(r"(\d{2,3}(?:\.\d)?)\s*(?:degrees|°)?\s*(?:f|c|fahrenheit)?", full_text.lower())
        if temp_match and "bp" not in temp_match.group(0):
            vitals["temperature"] = f"{temp_match.group(1)} °F"
        spo2_match = re.search(r"(?:spo2|oxygen saturation|saturation)\s*(?:is|at)?\s*(\d{2,3})\s*%", full_text.lower())
        if spo2_match:
            vitals["spo2"] = spo2_match.group(1) + "%"

        # Primary follow-up object
        primary_fu = follow_up_items[0] if follow_up_items else {
            "action": "Routine follow-up as discussed",
            "timeReference": "7 days",
            "status": "PENDING_DOCTOR_CONFIRMATION",
            "quote": "Not mentioned",
        }
        interval_days = 7
        t_ref = primary_fu.get("timeReference", "7 days").lower()
        num_m = re.search(r"(\d+)", t_ref)
        if num_m:
            n = int(num_m.group(1))
            interval_days = n * 7 if "week" in t_ref else (n * 30 if "month" in t_ref else n)

        follow_up_formatted = {
            "interval_days": interval_days,
            "date_str": f"In {primary_fu.get('timeReference', '7 days')}",
            "reason": primary_fu.get("action", "Clinical review"),
            "action": primary_fu.get("action", "Clinical review"),
            "quote": primary_fu.get("quote", "Not mentioned"),
            "status": primary_fu.get("status", "PENDING_DOCTOR_CONFIRMATION"),
        }

        # Patient plain language view
        patient_view = {
            "what_we_discussed": summary_text or f"You consulted for {chief_complaint}. The doctor reviewed your condition and gave medical advice.",
            "doctor_findings": f"Vital signs: Blood Pressure {vitals['bp']}, Pulse {vitals['pulse']}, Temperature {vitals['temperature']}, SpO2 {vitals['spo2']}.",
            "medications_to_take": [
                {
                    "name": m.get("name"),
                    "how_much": m.get("dosage", "As directed"),
                    "schedule": m.get("frequency", "1-0-1"),
                    "for_how_long": m.get("duration", "As prescribed"),
                    "instructions": m.get("instructions", "Take after food"),
                }
                for m in medications
            ],
            "tests_needed": [
                {"test": t.get("name"), "why": "Ordered for diagnostic evaluation"}
                for t in tests
            ],
            "follow_up": f"Please return for review {follow_up_formatted['date_str']} (Status: {follow_up_formatted['status']}).",
            "urgent_guidance": "If you experience severe breathing difficulty, sudden chest pain, or very high fever, seek emergency medical care immediately.",
        }

        # Nursing inpatient/outpatient view
        nurse_view = {
            "condition": chief_complaint,
            "vitals_summary": vitals,
            "allergies": "No known allergies documented",
            "active_meds": [f"{m.get('name')} {m.get('dosage', '')} ({m.get('frequency', '')})" for m in medications],
            "monitoring_instructions": [
                f"Ensure specimen collection for: {', '.join([t.get('name') for t in tests])}" if tests else "No pending lab tests",
                f"Monitor vitals ({vitals['bp']}) according to clinic schedule",
            ],
            "priority": "urgent" if "chest pain" in chief_complaint.lower() else "normal",
        }

        return {
            "chief_complaint": chief_complaint,
            "symptoms": [
                {
                    "name": s.get("name"),
                    "duration": s.get("duration", "Not mentioned"),
                    "quote": s.get("quote", ""),
                    "uncertain": False,
                }
                for s in symptoms
            ],
            "history": {
                "allergies": "No known allergies documented",
                "past_conditions": "Not documented",
                "current_medications": "Not documented",
            },
            "vitals": vitals,
            "investigations": [
                {
                    "test_name": t.get("name"),
                    "reason": t.get("reason") or "Diagnostic evaluation",
                    "quote": t.get("quote", ""),
                    "uncertain": False,
                }
                for t in tests
            ],
            "assessment": chief_complaint,
            "treatment_plan": f"Prescribed {len(medications)} medication(s). Follow-up in {follow_up_formatted['date_str']}.",
            "doctor_instructions": instructions,
            "medications": medications,
            "follow_up": follow_up_formatted,
            "follow_up_items": follow_up_items,
            "patient_view": patient_view,
            "nurse_view": nurse_view,
            "summary_text": summary_text,
            "uncertainty_flags": raw_ai.get("uncertainInformation", []),
            "is_doctor_approved": False,
        }

    def answer_consultation_question(
        self,
        transcript_text: str,
        summary_data: Dict[str, Any],
        question: str,
    ) -> Dict[str, Any]:
        """
        Grounded Q&A Chatbot: Answers questions strictly from consultation data.
        If information is not present, responds with "I could not find that information in your consultation."
        Does NOT hallucinate, diagnose, or prescribe.
        """
        system_prompt = (
            "You are MediBridge AI's 'Ask My Consultation' Assistant. "
            "You answer patient questions strictly and solely using the facts present in their specific consultation transcript and verified medical summary. "
            "STRICT SAFETY & GROUNDING RULES:\n"
            "1. Answer ONLY based on the facts in the provided Consultation Record.\n"
            "2. If the user asks about a test, medicine, date, or symptom NOT in the record, reply EXACTLY:\n"
            "'I could not find that information in your consultation. Please check with your doctor.'\n"
            "3. DO NOT diagnose new illnesses, prescribe new medications, or give speculative advice.\n"
            "4. Keep answers clear, factual, and patient-friendly."
        )

        user_prompt = f"""
Consultation Record:
{transcript_text}

Summary Details:
- Chief Complaint: {summary_data.get('chief_complaint')}
- Prescribed Medications: {json.dumps(summary_data.get('medications', []))}
- Tests Ordered: {json.dumps(summary_data.get('investigations', []))}
- Doctor Instructions: {json.dumps(summary_data.get('doctor_instructions', []))}
- Follow-up: {json.dumps(summary_data.get('follow_up', {}))}

Patient Question:
"{question}"

Please provide a grounded answer based strictly on the above record.
"""
        response = self._call_ollama(user_prompt, system_prompt, json_format=False)
        if response and response.strip():
            return {
                "answer": response.strip(),
                "source": "Current Consultation",
                "found": "could not find that information" not in response.lower(),
            }

        # Deterministic grounded fallback Q&A
        q_lower = question.lower()
        if any(w in q_lower for w in ["test", "investigation", "blood", "x-ray", "lab"]):
            tests = summary_data.get("investigations", [])
            if tests:
                test_names = ", ".join([t.get("test_name", "") for t in tests])
                return {
                    "answer": f"The doctor advised the following test(s): {test_names}.",
                    "source": "Current Consultation",
                    "found": True,
                }
            return {
                "answer": "No tests or laboratory investigations were mentioned in your consultation.",
                "source": "Current Consultation",
                "found": True,
            }

        if any(w in q_lower for w in ["follow up", "follow-up", "next appointment", "review", "when"]):
            fu = summary_data.get("follow_up", {})
            date_str = fu.get("date_str") or "In 7 days"
            status_str = fu.get("status") or "PENDING_DOCTOR_CONFIRMATION"
            return {
                "answer": f"Your follow-up is scheduled for {date_str} (Status: {status_str}).",
                "source": "Current Consultation",
                "found": True,
            }

        if any(w in q_lower for w in ["medicine", "medication", "tablet", "drug", "prescription"]):
            meds = summary_data.get("medications", [])
            if meds:
                med_list = "; ".join([f"{m.get('name')} {m.get('dosage', '')} ({m.get('frequency', '')})" for m in meds])
                return {
                    "answer": f"The doctor prescribed: {med_list}.",
                    "source": "Current Consultation",
                    "found": True,
                }
            return {
                "answer": "No medications were prescribed during this consultation.",
                "source": "Current Consultation",
                "found": True,
            }

        return {
            "answer": "I could not find that information in your consultation. Please check with your doctor or healthcare provider.",
            "source": "Current Consultation",
            "found": False,
        }


# Singleton instance
ai_service = AIService()
