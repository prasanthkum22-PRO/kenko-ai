"""
MediBridge AI — Google Meet Transcript Service
Interacts with Google Meet REST API v2 to:
1. List transcript resources (conferenceRecords.transcripts)
2. Retrieve transcript entries (conferenceRecords.transcripts.entries) with full pagination (nextPageToken)
3. Map entries using participantService to DOCTOR / PATIENT / UNKNOWN
4. Normalize and persist segments to local clinical database
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

import httpx
from sqlalchemy.orm import Session

from app.models.db_models import Consultation, TranscriptSegment, AuditLog
from app.services.google_oauth_service import google_oauth_service
from app.services.google_meet_service import google_meet_service
from app.services.participant_service import participant_service
from app.services.firebase_service import firebase_service

logger = logging.getLogger(__name__)

MEET_API_BASE = "https://meet.googleapis.com/v2"


class TranscriptService:
    def __init__(self):
        self.api_base = MEET_API_BASE

    async def list_transcripts(
        self,
        conference_record_name: str,
        user_id: str,
        db: Session,
    ) -> List[Dict[str, Any]]:
        """
        Calls: GET https://meet.googleapis.com/v2/{parent=conferenceRecords/*}/transcripts
        """
        access_token = await google_oauth_service.get_valid_access_token(user_id, db)
        if not access_token or access_token.startswith("mock_"):
            return [
                {
                    "name": f"{conference_record_name}/transcripts/transcript_001",
                    "state": "ENDED",
                    "startTime": (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat(),
                    "endTime": datetime.now(timezone.utc).isoformat(),
                    "isMock": True,
                }
            ]

        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.get(
                f"{self.api_base}/{conference_record_name}/transcripts",
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("transcripts", [])
            logger.warning(f"Error listing transcripts for {conference_record_name}: {resp.status_code}")
            return []

    async def fetch_all_transcript_entries(
        self,
        transcript_name: str,
        user_id: str,
        db: Session,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves all entries for a transcript resource handling pagination (nextPageToken):
        GET https://meet.googleapis.com/v2/{parent=conferenceRecords/*/transcripts/*}/entries
        """
        access_token = await google_oauth_service.get_valid_access_token(user_id, db)
        
        # If in mock mode, generate realistic consultation dialogue
        if not access_token or access_token.startswith("mock_"):
            return self._generate_mock_transcript_entries(transcript_name)

        headers = {"Authorization": f"Bearer {access_token}"}
        all_entries = []
        page_token = None

        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params = {"pageSize": 100}
                if page_token:
                    params["pageToken"] = page_token

                resp = await client.get(
                    f"{self.api_base}/{transcript_name}/entries",
                    headers=headers,
                    params=params,
                )

                if resp.status_code != 200:
                    logger.error(f"Error fetching transcript entries: {resp.status_code} - {resp.text}")
                    break

                data = resp.json()
                entries = data.get("transcriptEntries", [])
                all_entries.extend(entries)

                page_token = data.get("nextPageToken")
                if not page_token:
                    break

        return all_entries

    async def sync_consultation_transcript(
        self,
        consultation_id: str,
        user_id: str,
        db: Session,
    ) -> Dict[str, Any]:
        """
        Main end-to-end sync workflow:
        1. Find conference record for space
        2. Retrieve transcripts list
        3. Fetch entries with pagination
        4. Retrieve participants & map speaker roles
        5. Persist normalized TranscriptSegments into DB
        6. Return normalized structure
        """
        consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
        if not consultation:
            raise ValueError("Consultation not found")

        space_name = consultation.google_space_name
        if not space_name:
            raise ValueError("No Google Meet Space associated with this consultation.")

        # 1. Find Conference Record
        conference_records = await google_meet_service.find_conference_records_for_space(
            space_name=space_name,
            user_id=user_id,
            db=db,
        )

        if not conference_records:
            consultation.transcript_status = "processing"
            consultation.meeting_status = "processing_transcript"
            db.commit()
            return {
                "consultationId": consultation_id,
                "entries": [],
                "transcriptStatus": "processing",
                "message": "Conference record is still being indexed by Google Meet. Please check again shortly.",
            }

        active_conf = conference_records[0]
        conf_record_name = active_conf.get("name")
        consultation.conference_record_name = conf_record_name

        # 2. Fetch Participants for Speaker Mapping
        participants = await google_meet_service.get_participants(
            conference_record_name=conf_record_name,
            user_id=user_id,
            db=db,
        )
        participant_dir = participant_service.build_participant_directory(
            participants=participants,
            doctor_name=consultation.doctor_name,
            doctor_id=consultation.doctor_id,
            patient_name=consultation.patient_name,
            patient_id=consultation.patient_id,
        )

        # 3. Check transcripts list
        transcripts = await self.list_transcripts(
            conference_record_name=conf_record_name,
            user_id=user_id,
            db=db,
        )

        if not transcripts:
            consultation.transcript_status = "processing"
            db.commit()
            return {
                "consultationId": consultation_id,
                "entries": [],
                "transcriptStatus": "processing",
                "message": "Transcript is still being generated by Google Meet. Please check again shortly.",
            }

        latest_transcript = transcripts[0]
        transcript_name = latest_transcript.get("name")
        consultation.transcript_resource_name = transcript_name

        # 4. Fetch transcript entries with pagination
        raw_entries = await self.fetch_all_transcript_entries(
            transcript_name=transcript_name,
            user_id=user_id,
            db=db,
        )

        if not raw_entries:
            consultation.transcript_status = "processing"
            db.commit()
            return {
                "consultationId": consultation_id,
                "entries": [],
                "transcriptStatus": "processing",
                "message": "Transcript entries are currently being processed by Google Meet.",
            }

        # 5. Normalize Entries & Store in DB
        normalized_entries = []
        db.query(TranscriptSegment).filter(TranscriptSegment.consultation_id == consultation_id).delete()

        current_seconds = 0.0
        for entry in raw_entries:
            p_resource = entry.get("participant", "")
            p_info = participant_dir.get(p_resource, {})
            speaker_role = p_info.get("role", "UNKNOWN")
            
            # Map role to DB speaker name ('Doctor', 'Patient', 'Other')
            speaker_label = "Doctor" if speaker_role == "DOCTOR" else ("Patient" if speaker_role == "PATIENT" else "Unknown")
            text = entry.get("text", "").strip()
            
            if not text:
                continue

            start_time_str = entry.get("startTime", "")
            end_time_str = entry.get("endTime", "")

            # Create DB TranscriptSegment
            seg = TranscriptSegment(
                consultation_id=consultation_id,
                speaker=speaker_label,
                start_time=current_seconds,
                end_time=current_seconds + 4.0,
                text=text,
                confidence=0.98,
                is_edited=False,
            )
            db.add(seg)
            current_seconds += 4.5
            entry_id = entry.get("name", "").split("/")[-1] if "/" in entry.get("name", "") else f"entry_{len(normalized_entries)+1}"

            normalized_entries.append({
                "entryId": entry_id,
                "speakerRole": speaker_role,
                "participantId": p_resource,
                "participantName": p_info.get("displayName", speaker_label),
                "text": text,
                "startTime": start_time_str or f"{int(current_seconds // 60):02d}:{int(current_seconds % 60):02d}",
                "endTime": end_time_str or f"{int((current_seconds + 4) // 60):02d}:{int((current_seconds + 4) % 60):02d}",
            })

            # Sync individual entry to Firestore subcollection: consultations/{id}/transcriptEntries/{entryId}
            try:
                await firebase_service.sync_transcript_entry(
                    consultation_id=consultation_id,
                    entry_id=entry_id,
                    speaker_role=speaker_role,
                    speaker_name=p_info.get("displayName", speaker_label),
                    text=text,
                    start_time=current_seconds - 4.5,
                    end_time=current_seconds,
                )
            except Exception as fe:
                logger.debug(f"Firestore transcript entry sync note: {fe}")

        consultation.transcript_status = "ready"
        consultation.meeting_status = "transcript_ready"
        consultation.status = "transcript_ready"
        consultation.duration_seconds = int(current_seconds)
        db.commit()

        # Audit log entry for transcript access/sync
        audit = AuditLog(
            user_id=user_id,
            user_role="doctor",
            action="retrieved_google_meet_transcript",
            resource_type="transcript",
            resource_id=consultation_id,
            details={
                "space_name": space_name,
                "entries_count": len(normalized_entries),
                "transcript_resource": transcript_name,
            },
        )
        db.add(audit)
        db.commit()

        return {
            "consultationId": consultation_id,
            "entries": normalized_entries,
            "transcriptStatus": "ready",
            "googleSpaceName": space_name,
            "doctorName": consultation.doctor_name,
            "patientName": consultation.patient_name,
            "isReviewed": False,
        }

    def _generate_mock_transcript_entries(self, transcript_name: str) -> List[Dict[str, Any]]:
        """Generates realistic structured consultation dialogue for local testing."""
        conf_id = transcript_name.split("/")[1] if "/" in transcript_name else "mock"
        p_doctor = f"conferenceRecords/{conf_id}/participants/p_doctor"
        p_patient = f"conferenceRecords/{conf_id}/participants/p_patient"

        return [
            {
                "name": f"{transcript_name}/entries/1",
                "participant": p_doctor,
                "text": "Hello, how are you feeling today? What brings you in?",
                "startTime": "09:30 AM",
                "endTime": "09:30 AM",
            },
            {
                "name": f"{transcript_name}/entries/2",
                "participant": p_patient,
                "text": "Hello Doctor. I have been experiencing persistent knee pain and swelling around the right joint for around three days.",
                "startTime": "09:31 AM",
                "endTime": "09:31 AM",
            },
            {
                "name": f"{transcript_name}/entries/3",
                "participant": p_doctor,
                "text": "I see. Does the pain worsen when you bear weight or climb stairs? Any history of trauma or twisting injury?",
                "startTime": "09:31 AM",
                "endTime": "09:32 AM",
            },
            {
                "name": f"{transcript_name}/entries/4",
                "participant": p_patient,
                "text": "Yes, especially when walking upstairs. No direct injury, but I went on a long hike over the weekend.",
                "startTime": "09:32 AM",
                "endTime": "09:32 AM",
            },
            {
                "name": f"{transcript_name}/entries/5",
                "participant": p_doctor,
                "text": "Understood. I will prescribe Tablet Aceclofenac 100mg plus Paracetamol twice daily for 5 days after food, and apply an ice pack for 15 minutes twice a day. Let's also order a Right Knee X-Ray (AP and Lateral view).",
                "startTime": "09:33 AM",
                "endTime": "09:33 AM",
            },
            {
                "name": f"{transcript_name}/entries/6",
                "participant": p_patient,
                "text": "Okay Doctor, will do. Should I come back for a review after the X-Ray?",
                "startTime": "09:34 AM",
                "endTime": "09:34 AM",
            },
            {
                "name": f"{transcript_name}/entries/7",
                "participant": p_doctor,
                "text": "Yes, please schedule a follow-up review in 7 days with the X-Ray report. Rest your leg as much as possible.",
                "startTime": "09:34 AM",
                "endTime": "09:35 AM",
            },
        ]


transcript_service = TranscriptService()
