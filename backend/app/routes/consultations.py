"""
MediBridge AI — Consultation & Speech-to-Text Endpoints
Handles audio uploads, NVIDIA Cloud STT transcription,
deterministic clinical extraction, doctor verification, and grounded consultation chatbot.
"""

import os
import shutil
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import (
    Consultation,
    TranscriptSegment,
    ClinicalSummary,
    AuditLog,
)
from app.models.schemas import (
    CreateConsultationRequest,
    ConsultationResponse,
    SegmentSchema,
    UpdateSegmentsRequest,
    FinalizeSummaryRequest,
    ConsultationChatRequest,
    ConsultationChatResponse,
)
from app.services.speech import speech_service
from app.services.ai_service import ai_service
from app.services.router import route_approved_consultation
from app.services.audit import log_action

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/consultations", tags=["Consultations"])


@router.post("", response_model=ConsultationResponse, summary="Initialize a new consultation")
def create_consultation(
    req: CreateConsultationRequest,
    db: Session = Depends(get_db),
):
    consultation = Consultation(
        patient_id=req.patient_id,
        patient_name=req.patient_name,
        patient_age=req.patient_age,
        patient_gender=req.patient_gender,
        doctor_id=req.doctor_id,
        doctor_name=req.doctor_name,
        consultation_type=req.consultation_type,
        has_consent=req.has_consent,
        detected_language=req.detected_language or "English",
        is_demo=bool(req.is_demo),
        status="recording",
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)

    if req.transcript:
        lines = [line.strip() for line in req.transcript.strip().split("\n") if line.strip()]
        current_time = 0.0
        for line in lines:
            speaker = "Doctor"
            text = line
            if line.lower().startswith("doctor:") or line.lower().startswith("dr:"):
                speaker = "Doctor"
                text = line.split(":", 1)[1].strip()
            elif line.lower().startswith("patient:"):
                speaker = "Patient"
                text = line.split(":", 1)[1].strip()

            seg = TranscriptSegment(
                consultation_id=consultation.id,
                speaker=speaker,
                start_time=current_time,
                end_time=current_time + 4.0,
                text=text,
                confidence=0.96,
                is_edited=False,
            )
            db.add(seg)
            current_time += 4.5
        db.commit()


    log_action(
        db,
        action="created",
        resource_type="consultation",
        resource_id=consultation.id,
        user_id=req.doctor_name,
        user_role="doctor",
    )

    return ConsultationResponse(
        id=consultation.id,
        consultation_type=consultation.consultation_type,
        patient_id=consultation.patient_id,
        patient_name=consultation.patient_name,
        patient_age=consultation.patient_age,
        patient_gender=consultation.patient_gender,
        doctor_name=consultation.doctor_name,
        status=consultation.status,
        detected_language=consultation.detected_language,
        duration_seconds=consultation.duration_seconds,
        has_consent=consultation.has_consent,
        is_demo=consultation.is_demo,
        created_at=consultation.created_at,
        updated_at=consultation.updated_at,
        transcript_count=0,
        is_approved=False,
    )


@router.get("", response_model=List[ConsultationResponse], summary="List all consultations")
def list_consultations(
    status: Optional[str] = None,
    patient_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Consultation)
    if status:
        query = query.filter(Consultation.status == status)
    if patient_id:
        query = query.filter(Consultation.patient_id == patient_id)
    consultations = query.order_by(Consultation.created_at.desc()).all()

    results = []
    for c in consultations:
        t_count = len(c.transcript_segments)
        latest_summary = (
            db.query(ClinicalSummary)
            .filter(ClinicalSummary.consultation_id == c.id)
            .order_by(ClinicalSummary.version.desc())
            .first()
        )
        results.append(
            ConsultationResponse(
                id=c.id,
                consultation_type=c.consultation_type,
                patient_id=c.patient_id,
                patient_name=c.patient_name,
                patient_age=c.patient_age,
                patient_gender=c.patient_gender,
                doctor_name=c.doctor_name,
                status=c.status,
                detected_language=c.detected_language or "English",
                duration_seconds=c.duration_seconds,
                has_consent=c.has_consent,
                is_demo=c.is_demo,
                google_space_name=c.google_space_name,
                google_meeting_uri=c.google_meeting_uri,
                google_meeting_code=c.google_meeting_code,
                conference_record_name=c.conference_record_name,
                meeting_status=c.meeting_status or "scheduled",
                transcript_status=c.transcript_status or "pending",
                created_at=c.created_at,
                updated_at=c.updated_at,
                transcript_count=t_count,
                is_approved=latest_summary.is_doctor_approved if latest_summary else False,
            )
        )
    return results


@router.get("/{id}", summary="Get consultation details")
def get_consultation(id: str, db: Session = Depends(get_db)):
    c = db.query(Consultation).filter(Consultation.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    latest_summary = (
        db.query(ClinicalSummary)
        .filter(ClinicalSummary.consultation_id == c.id)
        .order_by(ClinicalSummary.version.desc())
        .first()
    )

    return {
        "consultation": {
            "id": c.id,
            "consultation_type": c.consultation_type,
            "patient_id": c.patient_id,
            "patient_name": c.patient_name,
            "patient_age": c.patient_age,
            "patient_gender": c.patient_gender,
            "doctor_name": c.doctor_name,
            "status": c.status,
            "detected_language": c.detected_language or "English",
            "duration_seconds": c.duration_seconds,
            "has_consent": c.has_consent,
            "is_demo": c.is_demo,
            "audio_path": c.audio_path,
            "google_space_name": c.google_space_name,
            "google_meeting_uri": c.google_meeting_uri,
            "google_meeting_code": c.google_meeting_code,
            "conference_record_name": c.conference_record_name,
            "meeting_status": c.meeting_status,
            "transcript_status": c.transcript_status,
            "created_at": c.created_at.isoformat(),
            "is_approved": latest_summary.is_doctor_approved if latest_summary else False,
        },
        "transcript": [
            {
                "id": s.id,
                "speaker": s.speaker,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "text": s.text,
                "confidence": s.confidence,
                "is_edited": s.is_edited,
            }
            for s in c.transcript_segments
        ],
        "summary": {
            "chief_complaint": latest_summary.chief_complaint,
            "symptoms": latest_summary.symptoms,
            "history": latest_summary.history,
            "vitals": latest_summary.vitals,
            "investigations": latest_summary.investigations,
            "assessment": latest_summary.assessment,
            "treatment_plan": latest_summary.treatment_plan,
            "doctor_instructions": latest_summary.doctor_instructions,
            "medications": latest_summary.medications,
            "follow_up": latest_summary.follow_up,
            "follow_up_items": latest_summary.follow_up_items,
            "patient_view": latest_summary.patient_view,
            "nurse_view": latest_summary.nurse_view,
            "summary_text": latest_summary.summary_text,
            "uncertainty_flags": latest_summary.uncertainty_flags,
            "is_doctor_approved": latest_summary.is_doctor_approved,
            "approved_by": latest_summary.approved_by,
            "approved_at": latest_summary.approved_at.isoformat() if latest_summary.approved_at else None,
        } if latest_summary else None,
    }


@router.post("/{id}/audio", summary="Upload recorded audio for a consultation")
async def upload_audio(
    id: str,
    file: UploadFile = File(...),
    duration_seconds: int = Form(0),
    db: Session = Depends(get_db),
):
    consultation = db.query(Consultation).filter(Consultation.id == id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    # Save audio securely inside backend/uploads/consultations/
    upload_dir = Path(__file__).resolve().parent.parent.parent / "uploads" / "consultations"
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_ext = Path(file.filename).suffix or ".webm"
    target_filename = f"consultation_{id}{file_ext}"
    target_path = upload_dir / target_filename

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    consultation.audio_path = f"/uploads/consultations/{target_filename}"
    consultation.audio_filename = target_filename
    consultation.duration_seconds = duration_seconds
    consultation.status = "processing"
    db.commit()

    return {
        "success": True,
        "audio_path": consultation.audio_path,
        "audio_filename": target_filename,
        "duration_seconds": duration_seconds,
    }


@router.post("/{id}/transcribe", summary="Transcribe audio with multilingual faster-whisper")
def transcribe_consultation(id: str, db: Session = Depends(get_db)):
    consultation = db.query(Consultation).filter(Consultation.id == id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    if not consultation.audio_path:
        raise HTTPException(
            status_code=400,
            detail="No recorded audio file found. Please record or upload audio first.",
        )

    # Resolve local disk path
    upload_dir = Path(__file__).resolve().parent.parent.parent / "uploads" / "consultations"
    local_audio_path = upload_dir / (consultation.audio_filename or f"consultation_{id}.webm")

    if not local_audio_path.exists():
        # Check root uploads directory as fallback
        fallback_path = Path(__file__).resolve().parent.parent.parent / "uploads" / f"{id}.webm"
        if fallback_path.exists():
            local_audio_path = fallback_path
        else:
            raise HTTPException(
                status_code=404,
                detail="Unable to find local audio recording on server.",
            )

    try:
        segments_data, detected_language = speech_service.transcribe(str(local_audio_path))
        
        # Clear existing segments if re-transcribing
        db.query(TranscriptSegment).filter(TranscriptSegment.consultation_id == id).delete()

        for seg in segments_data:
            ts = TranscriptSegment(
                consultation_id=id,
                speaker=seg.get("speaker", "Doctor"),
                start_time=seg.get("start", 0.0),
                end_time=seg.get("end", 0.0),
                text=seg.get("text", ""),
                confidence=seg.get("confidence", 0.95),
                is_edited=False,
            )
            db.add(ts)

        consultation.detected_language = detected_language
        consultation.status = "transcript_ready"
        db.commit()

        # Fetch saved segments
        saved_segments = (
            db.query(TranscriptSegment)
            .filter(TranscriptSegment.consultation_id == id)
            .order_by(TranscriptSegment.start_time)
            .all()
        )

        return {
            "success": True,
            "status": consultation.status,
            "detected_language": detected_language,
            "segment_count": len(saved_segments),
            "segments": [
                {
                    "id": s.id,
                    "speaker": s.speaker,
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "text": s.text,
                    "confidence": s.confidence,
                    "is_edited": s.is_edited,
                }
                for s in saved_segments
            ],
        }

    except Exception as exc:
        logger.error(f"Transcribe endpoint error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Speech transcription failed: {exc}. Please record again or upload another audio file.",
        )


@router.get("/{id}/transcript", summary="Get transcript segments for consultation")
def get_transcript(id: str, db: Session = Depends(get_db)):
    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.consultation_id == id)
        .order_by(TranscriptSegment.start_time)
        .all()
    )
    return [
        {
            "id": s.id,
            "speaker": s.speaker,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "text": s.text,
            "confidence": s.confidence,
            "is_edited": s.is_edited,
        }
        for s in segments
    ]


@router.put("/{id}/transcript", summary="Update transcript segments (inline edit / speaker tags)")
def update_transcript(
    id: str,
    req: UpdateSegmentsRequest,
    db: Session = Depends(get_db),
):
    consultation = db.query(Consultation).filter(Consultation.id == id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    # Replace with updated segments
    db.query(TranscriptSegment).filter(TranscriptSegment.consultation_id == id).delete()

    for seg in req.segments:
        ts = TranscriptSegment(
            consultation_id=id,
            speaker=seg.speaker,
            start_time=seg.start_time,
            end_time=seg.end_time,
            text=seg.text,
            confidence=seg.confidence,
            is_edited=True,
        )
        db.add(ts)

    db.commit()

    log_action(
        db,
        action="edited_transcript",
        resource_type="transcript",
        resource_id=id,
        user_id=consultation.doctor_name,
        user_role="doctor",
    )

    return {"success": True, "message": "Transcript updated successfully."}


@router.post("/{id}/summarize", summary="Generate structured clinical summary from transcript")
def generate_summary(id: str, db: Session = Depends(get_db)):
    consultation = db.query(Consultation).filter(Consultation.id == id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.consultation_id == id)
        .order_by(TranscriptSegment.start_time)
        .all()
    )
    if not segments:
        raise HTTPException(
            status_code=400,
            detail="Cannot generate summary: consultation has no transcript segments.",
        )

    segments_list = [
        {
            "id": s.id,
            "speaker": s.speaker,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "text": s.text,
        }
        for s in segments
    ]

    patient_info = {
        "name": consultation.patient_name,
        "age": consultation.patient_age,
        "gender": consultation.patient_gender,
        "id": consultation.patient_id,
    }

    summary_data = ai_service.summarize_and_extract(
        segments=segments_list,
        patient_info=patient_info,
        detected_language=consultation.detected_language or "English",
    )

    # Get latest version number
    last_summary = (
        db.query(ClinicalSummary)
        .filter(ClinicalSummary.consultation_id == id)
        .order_by(ClinicalSummary.version.desc())
        .first()
    )
    next_version = (last_summary.version + 1) if last_summary else 1

    summary_model = ClinicalSummary(
        consultation_id=id,
        version=next_version,
        chief_complaint=summary_data["chief_complaint"],
        symptoms=summary_data["symptoms"],
        history=summary_data["history"],
        vitals=summary_data["vitals"],
        investigations=summary_data["investigations"],
        assessment=summary_data["assessment"],
        treatment_plan=summary_data["treatment_plan"],
        doctor_instructions=summary_data.get("doctor_instructions", []),
        medications=summary_data["medications"],
        follow_up=summary_data["follow_up"],
        follow_up_items=summary_data.get("follow_up_items", []),
        patient_view=summary_data["patient_view"],
        nurse_view=summary_data["nurse_view"],
        summary_text=summary_data.get("summary_text", ""),
        uncertainty_flags=summary_data["uncertainty_flags"],
        raw_json=summary_data,
        is_doctor_approved=False,
    )
    db.add(summary_model)
    consultation.status = "summary_ready"
    db.commit()
    db.refresh(summary_model)

    log_action(
        db,
        action="generated_summary",
        resource_type="summary",
        resource_id=summary_model.id,
        user_id="MediBridge_AIService",
        user_role="ai",
    )

    summary_data["id"] = summary_model.id
    summary_data["consultation_id"] = id
    return summary_data




@router.get("/{id}/summary", summary="Retrieve clinical summary")
def get_summary(id: str, db: Session = Depends(get_db)):
    summary = (
        db.query(ClinicalSummary)
        .filter(ClinicalSummary.consultation_id == id)
        .order_by(ClinicalSummary.version.desc())
        .first()
    )
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found for this consultation")

    return {
        "id": summary.id,
        "consultation_id": summary.consultation_id,
        "version": summary.version,
        "chief_complaint": summary.chief_complaint,
        "symptoms": summary.symptoms,
        "history": summary.history,
        "vitals": summary.vitals,
        "investigations": summary.investigations,
        "assessment": summary.assessment,
        "treatment_plan": summary.treatment_plan,
        "doctor_instructions": summary.doctor_instructions,
        "medications": summary.medications,
        "follow_up": summary.follow_up,
        "follow_up_items": summary.follow_up_items,
        "patient_view": summary.patient_view,
        "nurse_view": summary.nurse_view,
        "summary_text": summary.summary_text,
        "uncertainty_flags": summary.uncertainty_flags,
        "is_doctor_approved": summary.is_doctor_approved,
        "approved_by": summary.approved_by,
        "approved_at": summary.approved_at.isoformat() if summary.approved_at else None,
    }


@router.post("/{id}/finalize", summary="Doctor verifies, edits & approves summary -> triggers automated routing")
def finalize_consultation(
    id: str,
    req: FinalizeSummaryRequest,
    db: Session = Depends(get_db),
):
    consultation = db.query(Consultation).filter(Consultation.id == id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    summary = (
        db.query(ClinicalSummary)
        .filter(ClinicalSummary.consultation_id == id)
        .order_by(ClinicalSummary.version.desc())
        .first()
    )
    if not summary:
        raise HTTPException(status_code=400, detail="No summary exists to finalize.")

    # Apply doctor's verified edits
    if req.chief_complaint is not None:
        summary.chief_complaint = req.chief_complaint
    if req.symptoms is not None:
        summary.symptoms = req.symptoms
    if req.history is not None:
        summary.history = req.history
    if req.vitals is not None:
        summary.vitals = req.vitals
    if req.investigations is not None:
        summary.investigations = req.investigations
    if req.assessment is not None:
        summary.assessment = req.assessment
    if req.treatment_plan is not None:
        summary.treatment_plan = req.treatment_plan
    if req.doctor_instructions is not None:
        summary.doctor_instructions = req.doctor_instructions
    if req.medications is not None:
        summary.medications = req.medications
    if req.follow_up is not None:
        summary.follow_up = req.follow_up
    if req.follow_up_items is not None:
        summary.follow_up_items = req.follow_up_items

    db.commit()

    # Trigger Central Automatic Routing Engine (Follow-up -> CONFIRMED, Labs -> Tasks)
    routing_summary = route_approved_consultation(
        db=db,
        consultation_id=id,
        approved_by=req.approved_by,
    )

    return {
        "success": True,
        "message": "Consultation finalized and clinical data routed successfully.",
        "routing": routing_summary,
    }


@router.post("/{id}/chat", response_model=ConsultationChatResponse, summary="Ask My Consultation: Grounded patient Q&A")
def ask_consultation_chat(
    id: str,
    req: ConsultationChatRequest,
    db: Session = Depends(get_db),
):
    consultation = db.query(Consultation).filter(Consultation.id == id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    summary = (
        db.query(ClinicalSummary)
        .filter(ClinicalSummary.consultation_id == id)
        .order_by(ClinicalSummary.version.desc())
        .first()
    )

    transcript_text = "\n".join([
        f"[{s.speaker}]: {s.text}"
        for s in consultation.transcript_segments
    ])

    summary_data = {
        "chief_complaint": summary.chief_complaint if summary else "Not summarized",
        "medications": summary.medications if summary else [],
        "investigations": summary.investigations if summary else [],
        "doctor_instructions": summary.doctor_instructions if summary else [],
        "follow_up": summary.follow_up if summary else {},
    }

    result = ai_service.answer_consultation_question(
        transcript_text=transcript_text,
        summary_data=summary_data,
        question=req.question,
    )

    return ConsultationChatResponse(
        answer=result.get("answer", "I could not find that information in your consultation."),
        source=result.get("source", "Current Consultation"),
        found=result.get("found", True),
        is_grounded=result.get("is_grounded", True),
        relevant_quotes=[],
    )

