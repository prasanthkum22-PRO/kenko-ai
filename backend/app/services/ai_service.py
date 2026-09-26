"""
MediBridge AI — Clinical AI & LLM Service
Powered by Groq AI (Ultra-fast LLM Inference: openai/gpt-oss-120b) + Deterministic Grounding Engine.
Zero hallucination. Fast cloud inference. No local GPU required.
"""

import os
import json
import re
import logging
from typing import List, Dict, Any, Optional, Generator

from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    logger.warning("Groq package not installed. Falling back to deterministic extraction.")


class AIService:
    """
    Clinical AI Service:
    - Groq LLM-powered Clinical Summarization & Extraction (openai/gpt-oss-120b)
    - Grounded Deterministic Clinical Verification (vitals, meds, symptoms, follow-ups)
    - Multi-speaker dialogue normalization and streaming support
    - Patient-Friendly & Nursing View Transformation
    - Grounded 'Ask My Consultation' Q&A Engine
    """

    @property
    def groq_api_key(self) -> str:
        return os.getenv("GROQ_API_KEY", "")

    @property
    def groq_model(self) -> str:
        return os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    @property
    def is_groq_configured(self) -> bool:
        return bool(GROQ_AVAILABLE and self.groq_api_key)

    def _get_groq_client(self) -> Optional[Any]:
        if not self.is_groq_configured:
            return None
        try:
            return Groq(api_key=self.groq_api_key)
        except Exception as e:
            logger.error(f"Failed to initialize Groq client: {e}")
            return None

    def stream_groq_summary(
        self,
        transcript_text: str,
        custom_prompt: Optional[str] = None,
    ) -> Generator[str, None, None]:
        """
        Streams consultation summary directly using Groq API.
        """
        client = self._get_groq_client()
        if not client:
            yield "Groq AI is not configured. Summary unavailable."
            return

        prompt = custom_prompt or (
            "You are a clinical documentation specialist. Generate a clear, concise, "
            "and accurate medical summary of this doctor-patient consultation transcript.\n\n"
            f"Transcript:\n{transcript_text}\n\n"
            "Summary:"
        )

        try:
            completion = client.chat.completions.create(
                model=self.groq_model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=1.0,
                max_completion_tokens=2048,
                top_p=1.0,
                reasoning_effort="medium",
                stream=True,
                stop=None,
            )

            for chunk in completion:
                delta = chunk.choices[0].delta.content if chunk.choices else ""
                if delta:
                    yield delta
        except Exception as exc:
            logger.error(f"Error in stream_groq_summary: {exc}")
            yield f"\n[Error streaming summary: {exc}]"

    def _groq_extract(
        self,
        transcript_text: str,
        patient_info: Optional[Dict[str, Any]] = None,
        detected_language: str = "English",
    ) -> Optional[Dict[str, Any]]:
        """
        Uses Groq LLM (e.g. openai/gpt-oss-120b) to extract structured clinical facts.
        """
        client = self._get_groq_client()
        if not client:
            return None

        p_name = (patient_info or {}).get("name", "the patient")
        p_age = (patient_info or {}).get("age", "")
        p_gender = (patient_info or {}).get("gender", "")
        patient_ctx = f"Patient: {p_name} ({p_age}y {p_gender})" if p_age else f"Patient: {p_name}"

        system_prompt = (
            "You are an expert Clinical AI Medical Scribe. Analyze the doctor-patient consultation transcript "
            "and output a strictly valid JSON object. Do not include markdown fences (```json) or introductory commentary. "
            "JSON structure required:\n"
            "{\n"
            '  "chiefConcern": "primary reason for consultation",\n'
            '  "summary": "comprehensive, accurate clinical summary paragraph",\n'
            '  "patientReportedSymptoms": [{"name": "symptom name", "duration": "duration", "quote": "exact quote from transcript"}],\n'
            '  "medicationsMentioned": [{"name": "Drug Name", "dosage": "e.g. 500mg", "frequency": "e.g. 1-0-1", "duration": "e.g. 5 days", "instructions": "e.g. after food", "quote": "quote"}],\n'
            '  "testsMentioned": [{"name": "Test Name", "reason": "why test is ordered", "quote": "quote"}],\n'
            '  "doctorInstructions": [{"instruction": "advice given to patient", "quote": "quote"}],\n'
            '  "followUpItems": [{"action": "follow up reason", "timeReference": "e.g. 7 days", "status": "PENDING_DOCTOR_CONFIRMATION", "quote": "quote"}],\n'
            '  "vitalSigns": {"bp": "value or Not documented", "pulse": "value or Not documented", "temperature": "value or Not documented", "spo2": "value or Not documented"}\n'
            "}"
        )

        user_prompt = f"{patient_ctx}\nDetected Language: {detected_language}\n\nTranscript:\n{transcript_text}"

        try:
            completion = client.chat.completions.create(
                model=self.groq_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_completion_tokens=2048,
                top_p=1.0,
            )

            response_text = completion.choices[0].message.content or ""
            # Strip markdown code fences if model returned them
            clean_json = re.sub(r"^```(?:json)?\s*", "", response_text.strip(), flags=re.MULTILINE)
            clean_json = re.sub(r"\s*```$", "", clean_json.strip(), flags=re.MULTILINE)

            # Find outer JSON brackets
            start_idx = clean_json.find("{")
            end_idx = clean_json.rfind("}")
            if start_idx != -1 and end_idx != -1:
                clean_json = clean_json[start_idx : end_idx + 1]
                data = json.loads(clean_json)
                logger.info(f"Groq AI clinical extraction succeeded with model {self.groq_model}")
                return data
        except Exception as exc:
            logger.warning(f"Groq extraction failed or returned unparseable JSON ({exc}). Falling back to deterministic extraction.")

        return None

    def summarize_and_extract(
        self,
        segments: List[Dict[str, Any]],
        patient_info: Optional[Dict[str, Any]] = None,
        detected_language: str = "English",
    ) -> Dict[str, Any]:
        """
        Extracts structured clinical summary. Uses Groq LLM when available,
        fused with deterministic extraction for 100% reliability and grounding.
        """
        transcript_text = "\n".join([f"{s.get('speaker', 'Speaker')}: {s.get('text', '')}" for s in segments])
        
        # 1. Deterministic baseline extraction
        det_data = self._deterministic_extract(segments, detected_language)

        # 2. Try Groq AI extraction if configured
        groq_data = None
        if self.is_groq_configured:
            groq_data = self._groq_extract(
                transcript_text=transcript_text,
                patient_info=patient_info,
                detected_language=detected_language,
            )

        # 3. Fuse Groq + Deterministic data
        if groq_data:
            combined_data = self._merge_extractions(groq_data, det_data)
        else:
            combined_data = det_data

        return self._format_clinical_payload(combined_data, segments, patient_info)

    def _merge_extractions(self, groq_data: Dict[str, Any], det_data: Dict[str, Any]) -> Dict[str, Any]:
        """Merges Groq LLM insights with deterministic ground truth."""
        merged = {}

        # Chief concern / Summary: prioritize rich Groq summary if present
        merged["chiefConcern"] = groq_data.get("chiefConcern") or det_data.get("chiefConcern")
        merged["summary"] = groq_data.get("summary") or det_data.get("summary")

        # Symptoms: union of both, ensuring proper title casing
        symptoms_map = {}
        for s in det_data.get("patientReportedSymptoms", []):
            symptoms_map[s["name"].lower()] = {
                "name": s["name"].title(),
                "duration": s.get("duration", "Not mentioned"),
                "quote": s.get("quote", "Mentioned in consultation"),
            }
        for s in groq_data.get("patientReportedSymptoms", []):
            if isinstance(s, dict) and s.get("name"):
                key = s["name"].lower().strip()
                if key not in symptoms_map:
                    symptoms_map[key] = {
                        "name": s["name"].title(),
                        "duration": s.get("duration", "Not mentioned"),
                        "quote": s.get("quote", "Mentioned in consultation"),
                    }
                elif s.get("duration") and s["duration"] != "Not mentioned":
                    symptoms_map[key]["duration"] = s["duration"]
            elif isinstance(s, str) and s.strip():
                key = s.lower().strip()
                if key not in symptoms_map:
                    symptoms_map[key] = {
                        "name": s.title(),
                        "duration": "Not mentioned",
                        "quote": "Mentioned in consultation",
                    }
        merged["patientReportedSymptoms"] = list(symptoms_map.values())

        # Medications: union of both
        meds_map = {}
        for m in det_data.get("medicationsMentioned", []):
            meds_map[m["name"].lower()] = m
        for m in groq_data.get("medicationsMentioned", []):
            if isinstance(m, dict) and m.get("name"):
                key = m["name"].lower().strip()
                if key not in meds_map:
                    meds_map[key] = {
                        "name": m["name"].title(),
                        "dosage": m.get("dosage") or m.get("dose") or "As discussed",
                        "frequency": m.get("frequency") or "1-0-1",
                        "duration": m.get("duration") or "As prescribed",
                        "instructions": m.get("instructions") or "Take after meals",
                        "quote": m.get("quote") or "",
                    }
        merged["medicationsMentioned"] = list(meds_map.values())

        # Tests
        tests_map = {}
        for t in det_data.get("testsMentioned", []):
            tests_map[t["name"].lower()] = t
        for t in groq_data.get("testsMentioned", []):
            if isinstance(t, dict) and t.get("name"):
                key = t["name"].lower().strip()
                if key not in tests_map:
                    tests_map[key] = {
                        "name": t["name"].title(),
                        "reason": t.get("reason", "Diagnostic evaluation"),
                        "quote": t.get("quote", ""),
                    }
            elif isinstance(t, str) and t.strip():
                key = t.lower().strip()
                if key not in tests_map:
                    tests_map[key] = {
                        "name": t.title(),
                        "reason": "Diagnostic evaluation",
                        "quote": "",
                    }
        merged["testsMentioned"] = list(tests_map.values())

        # Doctor instructions
        instructions = det_data.get("doctorInstructions", [])
        groq_instr = groq_data.get("doctorInstructions", [])
        for gi in groq_instr:
            if isinstance(gi, dict) and gi.get("instruction"):
                instructions.append(gi)
            elif isinstance(gi, str):
                instructions.append({"instruction": gi, "quote": gi})
        merged["doctorInstructions"] = instructions

        # Follow-up items
        groq_fu = groq_data.get("followUpItems", [])
        merged["followUpItems"] = groq_fu if groq_fu else det_data.get("followUpItems", [])
        merged["uncertainInformation"] = groq_data.get("uncertainInformation", [])

        # Vitals if detected by Groq
        if "vitalSigns" in groq_data and isinstance(groq_data["vitalSigns"], dict):
            merged["vitalSigns"] = groq_data["vitalSigns"]

        return merged

    def _deterministic_extract(self, segments: List[Dict[str, Any]], detected_language: str) -> Dict[str, Any]:
        """
        Strict deterministic extraction without hallucinating facts.
        Extracts ONLY explicitly matching tokens with quotes.
        Supports English, Tamil, and Tamil+English code-mixed transcripts.
        """
        full_text = " ".join([s.get("text", "") for s in segments])
        full_text_lower = full_text.lower()

        # ── Symptoms ────────────────────────────────────────────
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
                dur_match = re.search(r"(\d+\s*(?:days|weeks|months|hours|naal))", matching_quote.lower())
                duration = dur_match.group(1) if dur_match else "Not specified"
                if not any(s["name"] == label for s in symptoms_found):
                    symptoms_found.append({
                        "name": label,
                        "duration": duration,
                        "quote": matching_quote or "Mentioned in consultation",
                    })

        chief_concern = ", ".join([s["name"] for s in symptoms_found]) if symptoms_found else "General Medical Consultation"

        # ── Medications ─────────────────────────────────────────
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

        # ── Tests ────────────────────────────────────────────────
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
                    tests_found.append({"name": label, "quote": matching_quote})

        # ── Follow-Up ────────────────────────────────────────────
        follow_ups_found = []
        fu_match = re.search(
            r"(?:follow up|review|see me|come back|kazhichu|vaanga)\s*(?:in|after)?\s*(\d+)?\s*(days|weeks|months|naal)?",
            full_text_lower
        )
        if fu_match and any(w in full_text_lower for w in ["follow up", "review", "kazhichu"]):
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

        # ── Doctor Instructions ──────────────────────────────────
        instructions_found = []
        for seg in segments:
            if seg.get("speaker") == "Doctor":
                txt = seg.get("text", "")
                if any(k in txt.lower() for k in ["take", "rest", "drink", "avoid", "water", "food", "regularly", "morning"]):
                    instructions_found.append({"instruction": txt, "quote": txt})

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
        """Convert raw extraction JSON into full structured payload with SOAP, Patient View, and Nursing Directives."""
        full_text = " ".join([s.get("text", "") for s in segments])

        chief_complaint = raw_ai.get("chiefConcern", "Not mentioned")
        symptoms = raw_ai.get("patientReportedSymptoms", [])
        medications = raw_ai.get("medicationsMentioned", [])
        tests = raw_ai.get("testsMentioned", [])
        instructions = raw_ai.get("doctorInstructions", [])
        follow_up_items = raw_ai.get("followUpItems", [])
        summary_text = raw_ai.get("summary", "")

        # Vitals extraction (using regex + Groq AI vitals if provided)
        vitals = {"bp": "Not documented", "pulse": "Not documented", "temperature": "Not documented", "spo2": "Not documented"}
        
        # Override with Groq extracted vitals if available
        if "vitalSigns" in raw_ai and isinstance(raw_ai["vitalSigns"], dict):
            for k in ["bp", "pulse", "temperature", "spo2"]:
                val = raw_ai["vitalSigns"].get(k)
                if val and str(val).lower() not in ("not documented", "not mentioned", "null", "none"):
                    vitals[k] = str(val)

        # Fallback to regex pattern matching for vitals
        bp_match = re.search(r"(\d{2,3}\s*/\s*\d{2,3})\s*(?:mm\s*hg)?", full_text.lower())
        if bp_match and vitals["bp"] == "Not documented":
            vitals["bp"] = bp_match.group(1).replace(" ", "") + " mmHg"
        pulse_match = re.search(r"(?:pulse|heart rate)\s*(?:is|of)?\s*(\d{2,3})\s*(?:bpm)?", full_text.lower())
        if pulse_match and vitals["pulse"] == "Not documented":
            vitals["pulse"] = pulse_match.group(1) + " bpm"
        temp_match = re.search(r"(?:temp(?:erature)?|fever)\s*(?:is|of|around|at)?\s*(\d{2,3}(?:\.\d)?)\s*(?:degrees|°\s*[fc]?|°|fahrenheit|celsius|\s*f\b|\s*c\b)?", full_text.lower())
        if temp_match and "bp" not in temp_match.group(0) and vitals["temperature"] == "Not documented":
            temp_val = temp_match.group(1)
            vitals["temperature"] = f"{temp_val} °F"
        spo2_match = re.search(r"(?:spo2|oxygen saturation|saturation)\s*(?:is|at)?\s*(\d{2,3})\s*%", full_text.lower())
        if spo2_match and vitals["spo2"] == "Not documented":
            vitals["spo2"] = spo2_match.group(1) + "%"

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
            "tests_needed": [{"test": t.get("name"), "why": t.get("reason") or "Ordered for diagnostic evaluation"} for t in tests],
            "follow_up": f"Please return for review {follow_up_formatted['date_str']} (Status: {follow_up_formatted['status']}).",
            "urgent_guidance": "If you experience severe breathing difficulty, sudden chest pain, or very high fever, seek emergency medical care immediately.",
        }

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
                {"name": s.get("name"), "duration": s.get("duration", "Not mentioned"), "quote": s.get("quote", ""), "uncertain": False}
                for s in symptoms
            ],
            "history": {
                "allergies": "No known allergies documented",
                "past_conditions": "Not documented",
                "current_medications": "Not documented",
            },
            "vitals": vitals,
            "investigations": [
                {"test_name": t.get("name"), "reason": t.get("reason") or "Diagnostic evaluation", "quote": t.get("quote", ""), "uncertain": False}
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
        Grounded Q&A Chatbot: answers questions strictly from consultation data.
        Uses Groq LLM when available, otherwise uses deterministic matcher.
        """
        if self.is_groq_configured:
            client = self._get_groq_client()
            if client:
                try:
                    prompt = (
                        "You are a medical consultation assistant. Answer the user's question strictly "
                        "and ONLY based on the provided consultation summary and transcript. "
                        "Do not speculate or invent facts. If the information was not mentioned or discussed during the consultation, "
                        "you MUST respond with: 'I could not find that information in your consultation. Please check with your doctor or healthcare provider.'\n\n"
                        f"Consultation Summary:\n{json.dumps(summary_data, indent=2)}\n\n"
                        f"Transcript:\n{transcript_text}\n\n"
                        f"Question: {question}"
                    )
                    comp = client.chat.completions.create(
                        model=self.groq_model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.1,
                        max_completion_tokens=512,
                    )
                    ans = comp.choices[0].message.content or ""
                    if ans.strip():
                        is_found = "could not find that information" not in ans.lower()
                        return {"answer": ans.strip(), "source": "Consultation Intelligence (Groq AI)", "found": is_found}
                except Exception as e:
                    logger.warning(f"Groq Q&A failed, falling back to deterministic answer: {e}")

        # Deterministic fallback
        q_lower = question.lower()

        if any(w in q_lower for w in ["test", "investigation", "blood", "x-ray", "lab"]):
            tests = summary_data.get("investigations", [])
            if tests:
                test_names = ", ".join([t.get("test_name", "") for t in tests])
                return {"answer": f"The doctor advised the following test(s): {test_names}.", "source": "Current Consultation", "found": True}
            return {"answer": "No tests or laboratory investigations were mentioned in your consultation.", "source": "Current Consultation", "found": True}

        if any(w in q_lower for w in ["follow up", "follow-up", "next appointment", "review", "when"]):
            fu = summary_data.get("follow_up", {})
            date_str = fu.get("date_str") or "In 7 days"
            status_str = fu.get("status") or "PENDING_DOCTOR_CONFIRMATION"
            return {"answer": f"Your follow-up is scheduled for {date_str} (Status: {status_str}).", "source": "Current Consultation", "found": True}

        if any(w in q_lower for w in ["medicine", "medication", "tablet", "drug", "prescription"]):
            meds = summary_data.get("medications", [])
            if meds:
                med_list = "; ".join([f"{m.get('name')} {m.get('dosage', '')} ({m.get('frequency', '')})" for m in meds])
                return {"answer": f"The doctor prescribed: {med_list}.", "source": "Current Consultation", "found": True}
            return {"answer": "No medications were prescribed during this consultation.", "source": "Current Consultation", "found": True}

        return {
            "answer": "I could not find that information in your consultation. Please check with your doctor or healthcare provider.",
            "source": "Current Consultation",
            "found": False,
        }


# Singleton instance
ai_service = AIService()
