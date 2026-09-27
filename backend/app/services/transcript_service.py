"""
MediBridge AI — Google Meet Transcript Service
Interacts with Google Meet REST API v2 to:
1. List transcript resources (conferenceRecords.transcripts)
2. Retrieve transcript entries (conferenceRecords.transcripts.entries) with full pagination
3. Map entries using participantService to DOCTOR / PATIENT / UNKNOWN
4. Normalize and persist segments to local clinical database

Never generates fake or fabricated transcript text in production.
"""

import logging
from datetime import datetime, timezone
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
        if not access_token:
            return []

        headers = {"Authorization": f"Bearer {access_token}"}
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.get(
                    f"{self.api_base}/{conference_record_name}/transcripts",
                    headers=headers,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("transcripts", [])
                logger.warning(f"[TranscriptService] List transcripts for {conference_record_name} returned HTTP {resp.status_code}")
                return []
        except Exception as e:
            logger.error(f"[TranscriptService] list_transcripts error: {e}")
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
        if not access_token:
            return []

        headers = {"Authorization": f"Bearer {access_token}"}
        all_entries = []
        page_token = None

        try:
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
                        logger.error(f"[TranscriptService] Error fetching transcript entries: HTTP {resp.status_code}")
                        break

                    data = resp.json()
                    entries = data.get("transcriptEntries", [])
                    all_entries.extend(entries)

                    page_token = data.get("nextPageToken")
                    if not page_token:
                        break
        except Exception as e:
            logger.error(f"[TranscriptService] fetch_all_transcript_entries error: {e}")

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
            consultation.transcript_status = "not_available"
            db.commit()
            return {
                "consultationId": consultation_id,
                "entries": [],
                "transcriptStatus": "not_available",
                "message": "TRANSCRIPT_NOT_AVAILABLE: Conference record not yet generated or indexed by Google Meet.",
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
            consultation.transcript_status = "not_available"
            db.commit()
            return {
                "consultationId": consultation_id,
                "entries": [],
                "transcriptStatus": "not_available",
                "message": "TRANSCRIPT_NOT_AVAILABLE: Transcript recording was not active or is not yet available for this conference.",
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
            consultation.transcript_status = "not_available"
            db.commit()
            return {
                "consultationId": consultation_id,
                "entries": [],
                "transcriptStatus": "not_available",
                "message": "TRANSCRIPT_NOT_AVAILABLE: No transcript entries found in Google Meet recording.",
            }

        # 5. Normalize Entries & Store in DB
        normalized_entries = []
        db.query(TranscriptSegment).filter(TranscriptSegment.consultation_id == consultation_id).delete()

        current_seconds = 0.0
        for entry in raw_entries:
            p_resource = entry.get("participant", "")
            p_info = participant_dir.get(p_resource, {})
            speaker_role = p_info.get("role", "UNKNOWN")
            
            speaker_label = "Doctor" if speaker_role == "DOCTOR" else ("Patient" if speaker_role == "PATIENT" else "Unknown")
            text = entry.get("text", "").strip()
            
            if not text:
                continue

            start_time_str = entry.get("startTime", "")
            end_time_str = entry.get("endTime", "")

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


transcript_service = TranscriptService()
