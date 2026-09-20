"""
KENKO-AI — Prescription OCR & Verification Endpoints
"""

from typing import List, Optional
from datetime import datetime, timezone, timedelta
import logging
from pathlib import Path
import shutil

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import (
    Prescription,
    Medication,
    LabTask,
    FollowUp,
    AuditLog,
)
from app.models.schemas import PrescriptionConfirmRequest
from app.services import paddle_ocr as ocr_service
from app.services.prescription_parser import parse_prescription_text
from app.services.google_vision_ocr import (
    extract_prescription_with_google_ai,
    get_configured_google_api_key,
)
from app.utils.image_validation import validate_image_upload, validate_file_size
from app.services.audit import log_action
from fastapi import Header

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/prescriptions", tags=["Prescriptions"])


@router.post("/ocr", summary="Upload prescription image, run Google AI Gemini Vision / OCR, and return structured editable fields")
async def extract_and_parse_prescription(
    file: UploadFile = File(...),
    x_google_api_key: Optional[str] = Header(None, alias="x-google-api-key"),
    db: Session = Depends(get_db),
):
    validate_image_upload(file)
    image_bytes = await file.read()
    validate_file_size(image_bytes)

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")

    mime_type = file.content_type or "image/jpeg"
    google_key = get_configured_google_api_key(x_google_api_key)

    ocr_engine = "local_ocr"
    raw_text = ""
    lines = []
    parsed_data = {}
    proc_time_ms = 0

    # 1. Try Google AI Gemini Vision if API key is present
    if google_key:
        try:
            logger.info("Running Google AI Gemini Vision Prescription OCR...")
            g_result = extract_prescription_with_google_ai(
                image_bytes=image_bytes,
                mime_type=mime_type,
                api_key=google_key,
            )
            ocr_engine = g_result.get("engine", "google_gemini_vision")
            parsed_data = g_result.get("structured_fields", {})
            raw_text = g_result.get("raw_text", "")
            lines = g_result.get("lines", [])
            proc_time_ms = g_result.get("processing_time_ms", 0)
        except Exception as g_err:
            logger.warning(f"Google AI OCR failed ({g_err}), falling back to local OCR engine...")

    # 2. Fallback to Local OCR (EasyOCR / PaddleOCR + prescription_parser)
    if not parsed_data or not raw_text:
        ocr_result = ocr_service.process_image(image_bytes)
        ocr_engine = ocr_result.get("engine", "easyocr")
        raw_text = ocr_result.get("text", "")
        lines = ocr_result.get("lines", [])
        proc_time_ms = ocr_result.get("processing_time_ms", 0)
        parsed_data = parse_prescription_text(raw_text, lines)

    # 3. Save unverified prescription record
    upload_dir = Path(__file__).resolve().parent.parent.parent / "uploads"
    upload_dir.mkdir(exist_ok=True)
    file_ext = Path(file.filename).suffix or ".jpg"
    target_filename = f"rx_{datetime.now().strftime('%Y%m%d_%H%M%S')}{file_ext}"
    target_path = upload_dir / target_filename

    with open(target_path, "wb") as f:
        f.write(image_bytes)

    prescription = Prescription(
        patient_name=parsed_data.get("patient_name", "Unknown"),
        doctor_name=parsed_data.get("doctor_name", "Dr. Aarav Patel"),
        date_str=parsed_data.get("date_str", "Today"),
        image_path=str(target_path),
        raw_ocr_text=raw_text,
        parsed_json=parsed_data,
        is_verified=False,
    )
    db.add(prescription)
    db.commit()
    db.refresh(prescription)

    log_action(
        db,
        action="prescription_ocr_extracted",
        resource_type="prescription",
        resource_id=prescription.id,
    )

    return {
        "prescription_id": prescription.id,
        "image_url": f"/uploads/{target_filename}",
        "raw_text": raw_text,
        "lines": lines,
        "structured_fields": parsed_data,
        "processing_time_ms": proc_time_ms,
        "engine": ocr_engine,
        "is_verified": False,
    }


@router.post("/{id}/confirm", summary="User/Doctor confirms verified prescription -> updates records and triggers routing")
def confirm_prescription(
    id: str,
    req: PrescriptionConfirmRequest,
    db: Session = Depends(get_db),
):
    prescription = db.query(Prescription).filter(Prescription.id == id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")

    prescription.patient_name = req.patient_name
    prescription.patient_id = req.patient_id or "P-1002"
    prescription.doctor_name = req.doctor_name
    prescription.date_str = req.date_str
    prescription.is_verified = True
    prescription.verified_by = req.verified_by
    prescription.verified_at = datetime.now(timezone.utc)
    prescription.parsed_json = {
        "doctor_name": req.doctor_name,
        "patient_name": req.patient_name,
        "patient_id": req.patient_id,
        "date_str": req.date_str,
        "medicines": req.medicines,
        "investigations": req.investigations,
        "follow_up": req.follow_up,
    }

    routed = {
        "medications_added": 0,
        "lab_tasks_created": 0,
        "follow_ups_created": 0,
    }

    # 1. Add verified medications
    for med in req.medicines:
        m_name = med.get("drug_name") or med.get("name")
        if m_name:
            med_entry = Medication(
                prescription_id=prescription.id,
                patient_id=prescription.patient_id,
                drug_name=m_name,
                dosage=med.get("dosage", "As directed"),
                frequency=med.get("frequency", "1-0-1"),
                duration=med.get("duration", "5 days"),
                route=med.get("route", "Oral"),
                instructions=med.get("instructions", "After food"),
                source="prescription_ocr",
                source_quote=f"OCR extracted from {prescription.doctor_name} Rx",
            )
            db.add(med_entry)
            routed["medications_added"] += 1

    # 2. Add lab tasks if investigations were ordered
    for test in req.investigations:
        t_name = test if isinstance(test, str) else test.get("test_name", "")
        if t_name:
            lab_task = LabTask(
                patient_id=prescription.patient_id,
                patient_name=prescription.patient_name,
                test_name=t_name,
                reason="Ordered in verified prescription",
                status="Requested",
                requesting_doctor=prescription.doctor_name,
                priority="normal",
            )
            db.add(lab_task)
            routed["lab_tasks_created"] += 1

    # 3. Add follow up if specified
    if req.follow_up and req.follow_up != "Not specified":
        fu = FollowUp(
            patient_id=prescription.patient_id,
            patient_name=prescription.patient_name,
            action=f"Prescription follow-up: {req.follow_up}",
            interval_days=7,
            due_date=datetime.now(timezone.utc) + timedelta(days=7),
            status="pending",
            category="doctor_review",
            source_quote=f"Prescription note: {req.follow_up}",
        )
        db.add(fu)
        routed["follow_ups_created"] += 1

    log_action(
        db,
        action="prescription_confirmed",
        resource_type="prescription",
        resource_id=prescription.id,
        user_id=req.verified_by,
        user_role="doctor",
        details=routed,
    )

    db.commit()

    return {
        "success": True,
        "message": "Prescription verified and routed successfully.",
        "routing": routed,
    }


@router.get("", summary="List verified prescriptions")
def list_prescriptions(db: Session = Depends(get_db)):
    prescriptions = db.query(Prescription).order_by(Prescription.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "patient_name": p.patient_name,
            "doctor_name": p.doctor_name,
            "date_str": p.date_str,
            "is_verified": p.is_verified,
            "verified_by": p.verified_by,
            "verified_at": p.verified_at.isoformat() if p.verified_at else None,
            "created_at": p.created_at.isoformat(),
            "parsed_json": p.parsed_json,
        }
        for p in prescriptions
    ]
