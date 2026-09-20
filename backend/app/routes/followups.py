"""
MediBridge AI — Follow-up Intelligence Endpoints
Aggregates follow-up commitments into actionable statuses:
- PENDING_DOCTOR_CONFIRMATION
- CONFIRMED (Due Today, Upcoming 7-14 days, Overdue)
- COMPLETED / CANCELLED
Color-coded severity indicators (🟢/🟡/🔴) based strictly on verified record dates.
"""

from datetime import datetime, timezone, timedelta
import logging
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import FollowUp, LabTask, Consultation, ClinicalSummary
from app.models.schemas import FollowUpUpdateStatusRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/followups", tags=["Follow-up Intelligence"])


@router.get("", summary="Get Categorized Follow-up Intelligence Overview")
def get_followup_intelligence(
    patient_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    query = db.query(FollowUp)
    if patient_id:
        query = query.filter(FollowUp.patient_id == patient_id)
    all_followups = query.order_by(FollowUp.due_date.asc()).all()

    pending_confirmation_list = []
    today_list = []
    upcoming_list = []
    overdue_list = []
    completed_list = []

    for fu in all_followups:
        due = fu.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)

        item = {
            "id": fu.id,
            "consultation_id": fu.consultation_id,
            "patient_name": fu.patient_name,
            "patient_id": fu.patient_id,
            "action": fu.action,
            "time_reference": fu.time_reference,
            "due_date": due.strftime("%b %d, %Y"),
            "category": fu.category,
            "status": fu.status,
            "source": fu.source,
            "source_quote": fu.source_quote,
        }

        if fu.status == "PENDING_DOCTOR_CONFIRMATION":
            item["indicator"] = "yellow"
            pending_confirmation_list.append(item)
        elif fu.status == "COMPLETED" or fu.status == "completed":
            item["indicator"] = "green"
            completed_list.append(item)
        elif fu.status == "CANCELLED" or fu.status == "cancelled":
            item["indicator"] = "gray"
        elif due < today_start:
            item["indicator"] = "red"  # 🔴 Overdue
            item["days_overdue"] = (today_start - due).days
            overdue_list.append(item)
        elif today_start <= due < today_end:
            item["indicator"] = "yellow"  # 🟡 Due Today
            today_list.append(item)
        else:
            item["indicator"] = "green"  # 🟢 Upcoming
            item["days_until"] = (due - today_start).days
            upcoming_list.append(item)

    # Pending Lab Investigations
    pending_labs = (
        db.query(LabTask)
        .filter(LabTask.status.in_(["Requested", "Sample Collected", "Processing", "Completed", "Result Uploaded"]))
        .order_by(LabTask.created_at.desc())
        .all()
    )
    pending_lab_list = [
        {
            "id": lt.id,
            "patient_name": lt.patient_name,
            "patient_id": lt.patient_id,
            "test_name": lt.test_name,
            "status": lt.status,
            "priority": lt.priority,
            "date": lt.created_at.strftime("%b %d, %Y"),
        }
        for lt in pending_labs
    ]

    # Consultations needing doctor review
    pending_consultations = (
        db.query(Consultation)
        .filter(Consultation.status.in_(["summary_ready", "transcript_ready"]))
        .all()
    )
    pending_review_list = [
        {
            "id": c.id,
            "patient_name": c.patient_name,
            "patient_id": c.patient_id,
            "consultation_type": c.consultation_type,
            "detected_language": c.detected_language,
            "status": c.status,
            "created_at": c.created_at.strftime("%b %d, %H:%M"),
        }
        for c in pending_consultations
    ]

    return {
        "pending_confirmation": pending_confirmation_list,
        "today": today_list,
        "upcoming": upcoming_list,
        "overdue": overdue_list,
        "completed": completed_list,
        "pending_lab_tests": pending_lab_list,
        "pending_reviews": pending_review_list,
        "counts": {
            "pending_confirmation_count": len(pending_confirmation_list),
            "today_count": len(today_list),
            "upcoming_count": len(upcoming_list),
            "overdue_count": len(overdue_list),
            "completed_count": len(completed_list),
            "pending_labs_count": len(pending_lab_list),
            "pending_reviews_count": len(pending_review_list),
        },
    }


@router.post("/{id}/confirm", summary="Doctor confirms pending follow-up")
def confirm_followup(id: str, db: Session = Depends(get_db)):
    fu = db.query(FollowUp).filter(FollowUp.id == id).first()
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    fu.status = "CONFIRMED"
    db.commit()
    return {"success": True, "message": "Follow-up confirmed by doctor.", "status": fu.status}


@router.patch("/{id}/status", summary="Update follow-up status")
def update_followup_status(
    id: str,
    req: FollowUpUpdateStatusRequest,
    db: Session = Depends(get_db),
):
    fu = db.query(FollowUp).filter(FollowUp.id == id).first()
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    fu.status = req.status
    if req.action:
        fu.action = req.action
    if req.due_date:
        try:
            fu.due_date = datetime.fromisoformat(req.due_date)
        except Exception:
            pass

    db.commit()
    return {"success": True, "id": fu.id, "new_status": fu.status}
