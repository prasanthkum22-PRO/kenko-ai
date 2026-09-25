"""
MediBridge AI — Participant Mapping Service
Maps Google Meet participants to clinical roles (DOCTOR / PATIENT / UNKNOWN)
using application-level identity knowledge (doctor_id, doctor_name, patient_id, patient_name).
Never asks AI to guess when identity metadata is available, and flags UNKNOWN if ambiguous.
"""

import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class ParticipantService:
    @staticmethod
    def map_participant_to_role(
        participant_data: Dict[str, Any],
        doctor_name: Optional[str] = None,
        doctor_id: Optional[str] = None,
        patient_name: Optional[str] = None,
        patient_id: Optional[str] = None,
    ) -> str:
        """
        Determines the clinical role ('DOCTOR', 'PATIENT', 'UNKNOWN') of a Google Meet participant
        by matching against known consultation metadata.
        """
        # Extract display name or user ID from Google Meet participant object
        display_name = ""
        signed_user = participant_data.get("signedinUser", {})
        if signed_user:
            display_name = signed_user.get("displayName", "") or ""
            user_resource = signed_user.get("user", "")
        else:
            anonymous_user = participant_data.get("anonymousUser", {})
            display_name = anonymous_user.get("displayName", "") or ""
            user_resource = ""

        p_name_lower = display_name.lower().strip()
        p_resource_lower = user_resource.lower().strip()

        # Doctor matches
        doc_match_names = []
        if doctor_name:
            doc_clean = doctor_name.lower().replace("dr.", "").replace("dr", "").strip()
            doc_match_names.append(doctor_name.lower().strip())
            doc_match_names.append(doc_clean)
        
        # Patient matches
        pat_match_names = []
        if patient_name:
            pat_match_names.append(patient_name.lower().strip())

        # Check explicit tags / prefix / email
        if "doctor@medibridge.ai" in p_resource_lower or "doctor@" in p_resource_lower or "doctor@medibridge.ai" in p_name_lower:
            return "DOCTOR"

        if "doctor" in p_name_lower or "dr." in p_name_lower or "dr " in p_name_lower:
            return "DOCTOR"

        if "patient" in p_name_lower:
            return "PATIENT"

        # Check against doctor full/partial name
        for dname in doc_match_names:
            if dname and len(dname) >= 3 and (dname in p_name_lower or p_name_lower in dname):
                return "DOCTOR"

        # Check against patient name
        for pname in pat_match_names:
            if pname and len(pname) >= 3 and (pname in p_name_lower or p_name_lower in pname):
                return "PATIENT"

        # Check ID match if available in participant resource string
        if doctor_id and doctor_id.lower() in p_resource_lower:
            return "DOCTOR"
        if patient_id and patient_id.lower() in p_resource_lower:
            return "PATIENT"

        # Fallback to UNKNOWN if cannot be reliably mapped
        return "UNKNOWN"

    @classmethod
    def build_participant_directory(
        cls,
        participants: List[Dict[str, Any]],
        doctor_name: Optional[str] = None,
        doctor_id: Optional[str] = None,
        patient_name: Optional[str] = None,
        patient_id: Optional[str] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Builds a lookup mapping from participant resource name (`conferenceRecords/X/participants/Y`)
        to participant details including mapped role.
        """
        directory = {}
        for p in participants:
            p_name = p.get("name", "")
            role = cls.map_participant_to_role(
                participant_data=p,
                doctor_name=doctor_name,
                doctor_id=doctor_id,
                patient_name=patient_name,
                patient_id=patient_id,
            )
            
            display_name = (
                p.get("signedinUser", {}).get("displayName")
                or p.get("anonymousUser", {}).get("displayName")
                or f"Participant ({role})"
            )

            directory[p_name] = {
                "participantId": p_name,
                "displayName": display_name,
                "role": role,
            }

        return directory


participant_service = ParticipantService()
