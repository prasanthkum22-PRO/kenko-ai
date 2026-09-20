"""
MediBridge AI — Role-Specific Endpoints & Dynamic Patient Timeline
Provides dedicated views for Doctor, Patient, Nurse, Lab Tech, and Admin roles
all derived from the verified database records.
"""

from typing import List, Optional
from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import (
    User,
    Consultation,
    ClinicalSummary,
    LabTask,
    NursingTask,
    Medication,
    FollowUp,
    Appointment,
    Notification,
    AuditLog,
)
from app.models.schemas import LabTaskUpdateStatus
from app.services.audit import log_action

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Role Dashboards"])


# ─── Doctor Workspace ──────────────────────────────────────────

@router.get("/doctor/workspace", summary="Doctor Dashboard Overview")
def get_doctor_workspace(db: Session = Depends(get_db)):
    total_consultations = db.query(Consultation).count()
    pending_approval = (
        db.query(Consultation)
        .filter(Consultation.status.in_(["summary_ready", "transcript_ready"]))
        .count()
    )
    finalized_count = db.query(Consultation).filter(Consultation.status == "finalized").count()
    
    pending_followups = (
        db.query(FollowUp)
        .filter(FollowUp.status == "PENDING_DOCTOR_CONFIRMATION")
        .count()
    )
    confirmed_followups = (
        db.query(FollowUp)
        .filter(FollowUp.status == "CONFIRMED")
        .count()
    )
    
    recent_consultations = (
        db.query(Consultation)
        .order_by(Consultation.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "metrics": {
            "total_consultations": total_consultations,
            "pending_approval": pending_approval,
            "finalized_records": finalized_count,
            "pending_followups": pending_followups,
            "confirmed_followups": confirmed_followups,
            "active_patients": db.query(Consultation.patient_id).distinct().count(),
        },
        "recent_consultations": [
            {
                "id": c.id,
                "patient_name": c.patient_name,
                "patient_id": c.patient_id,
                "consultation_type": c.consultation_type,
                "detected_language": c.detected_language or "English",
                "status": c.status,
                "created_at": c.created_at.isoformat(),
                "duration_seconds": c.duration_seconds,
            }
            for c in recent_consultations
        ],
    }


# ─── Dynamic Patient Timeline & Plain-Language View ───────────

@router.get("/patients/{id}/timeline", summary="Real Dynamic Patient Timeline & Plain-Language View")
def get_patient_timeline(id: str, db: Session = Depends(get_db)):
    consultations = (
        db.query(Consultation)
        .filter(Consultation.patient_id == id)
        .order_by(Consultation.created_at.desc())
        .all()
    )

    medications = (
        db.query(Medication)
        .filter(Medication.patient_id == id)
        .order_by(Medication.created_at.desc())
        .all()
    )

    lab_tasks = (
        db.query(LabTask)
        .filter(LabTask.patient_id == id)
        .order_by(LabTask.created_at.desc())
        .all()
    )

    follow_ups = (
        db.query(FollowUp)
        .filter(FollowUp.patient_id == id)
        .order_by(FollowUp.due_date.asc())
        .all()
    )

    # Build chronological timeline events
    timeline_events = []
    patient_name = "Patient"

    for c in consultations:
        patient_name = c.patient_name
        dt_str = c.created_at.strftime("%b %d, %Y")
        
        # 1. Consultation event
        timeline_events.append({
            "type": "consultation",
            "icon": "🩺",
            "title": f"{c.consultation_type.replace('_', ' ').title()} Consultation",
            "date": dt_str,
            "datetime": c.created_at.isoformat(),
            "description": f"Consultation conducted by {c.doctor_name} (Language: {c.detected_language or 'English'})",
            "consultation_id": c.id,
            "badge": c.status,
        })

        latest_summary = (
            db.query(ClinicalSummary)
            .filter(ClinicalSummary.consultation_id == c.id)
            .order_by(ClinicalSummary.version.desc())
            .first()
        )

        if latest_summary:
            # 2. AI Summary Generated
            timeline_events.append({
                "type": "ai_summary",
                "icon": "📝",
                "title": "AI Clinical Summary Extracted",
                "date": latest_summary.created_at.strftime("%b %d, %Y"),
                "datetime": latest_summary.created_at.isoformat(),
                "description": f"Extracted Chief Concern: {latest_summary.chief_complaint}",
                "consultation_id": c.id,
                "badge": "Generated",
            })

            # 3. Doctor Approval event
            if latest_summary.is_doctor_approved:
                appr_date = latest_summary.approved_at or latest_summary.created_at
                timeline_events.append({
                    "type": "doctor_confirmation",
                    "icon": "👨‍⚕️",
                    "title": "Doctor Verified & Approved",
                    "date": appr_date.strftime("%b %d, %Y"),
                    "datetime": appr_date.isoformat(),
                    "description": f"Verified by {latest_summary.approved_by or 'Attending Doctor'}",
                    "consultation_id": c.id,
                    "badge": "Approved",
                })

    for lt in lab_tasks:
        timeline_events.append({
            "type": "lab_test",
            "icon": "🧪",
            "title": f"Lab Investigation: {lt.test_name}",
            "date": lt.created_at.strftime("%b %d, %Y"),
            "datetime": lt.created_at.isoformat(),
            "description": f"Status: {lt.status} • {lt.reason}",
            "badge": lt.status,
        })

    for fu in follow_ups:
        timeline_events.append({
            "type": "follow_up",
            "icon": "📅",
            "title": f"Follow-Up: {fu.action}",
            "date": fu.due_date.strftime("%b %d, %Y"),
            "datetime": fu.due_date.isoformat(),
            "description": f"Status: {fu.status} • Source: {fu.source}",
            "badge": fu.status,
        })

    # Sort all events chronologically (newest first)
    timeline_events.sort(key=lambda x: x.get("datetime", ""), reverse=True)

    # Compile latest patient view
    latest_visit_pv = {
        "what_we_discussed": "Your consultation summary is ready for review.",
        "doctor_findings": "Vital signs and clinical evaluation recorded.",
        "medications_to_take": [],
        "tests_needed": [],
        "follow_up": "To be scheduled",
    }
    if consultations:
        first_c = consultations[0]
        first_summary = (
            db.query(ClinicalSummary)
            .filter(ClinicalSummary.consultation_id == first_c.id)
            .order_by(ClinicalSummary.version.desc())
            .first()
        )
        if first_summary and first_summary.patient_view:
            latest_visit_pv = first_summary.patient_view

    return {
        "patient_id": id,
        "patient_name": patient_name,
        "timeline_events": timeline_events,
        "patient_view": latest_visit_pv,
        "consultations_count": len(consultations),
        "active_medications": [
            {
                "id": m.id,
                "drug_name": m.drug_name,
                "dosage": m.dosage,
                "frequency": m.frequency,
                "duration": m.duration,
                "route": m.route,
                "instructions": m.instructions,
                "source": m.source,
                "created_at": m.created_at.strftime("%b %d, %Y"),
            }
            for m in medications
        ],
        "pending_tests": [
            {
                "id": lt.id,
                "test_name": lt.test_name,
                "reason": lt.reason,
                "status": lt.status,
                "date": lt.created_at.strftime("%b %d, %Y"),
            }
            for lt in lab_tasks
        ],
        "upcoming_follow_ups": [
            {
                "id": fu.id,
                "action": fu.action,
                "due_date": fu.due_date.strftime("%B %d, %Y"),
                "status": fu.status,
            }
            for fu in follow_ups
        ],
    }


# ─── Nurse Care Dashboard ──────────────────────────────────────

@router.get("/nurse/tasks", summary="Nurse Tasks & Inpatient Directives")
def get_nurse_tasks(db: Session = Depends(get_db)):
    tasks = db.query(NursingTask).order_by(NursingTask.created_at.desc()).all()
    
    recent_summaries = (
        db.query(ClinicalSummary)
        .filter(ClinicalSummary.is_doctor_approved == True)
        .order_by(ClinicalSummary.created_at.desc())
        .limit(10)
        .all()
    )

    nurse_cards = []
    for s in recent_summaries:
        c = s.consultation
        if c:
            nurse_cards.append({
                "consultation_id": c.id,
                "patient_name": c.patient_name,
                "patient_id": c.patient_id,
                "condition": s.assessment,
                "vitals": s.vitals,
                "allergies": s.history.get("allergies", "None") if isinstance(s.history, dict) else "None",
                "nurse_view": s.nurse_view,
                "priority": s.nurse_view.get("priority", "normal") if isinstance(s.nurse_view, dict) else "normal",
                "date": s.created_at.strftime("%b %d, %H:%M"),
            })

    return {
        "pending_tasks": [
            {
                "id": t.id,
                "patient_name": t.patient_name,
                "patient_id": t.patient_id,
                "description": t.task_description,
                "priority": t.priority,
                "status": t.status,
                "created_at": t.created_at.strftime("%b %d, %H:%M"),
            }
            for t in tasks
        ],
        "active_care_plans": nurse_cards,
    }


# ─── Lab Dashboard & Specimen Tracking ─────────────────────────

@router.get("/lab/tasks", summary="Lab Investigation Queue")
def get_lab_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    query = db.query(LabTask)
    if status_filter:
        query = query.filter(LabTask.status == status_filter)
    
    tasks = query.order_by(LabTask.created_at.desc()).all()

    return [
        {
            "id": t.id,
            "consultation_id": t.consultation_id,
            "patient_name": t.patient_name,
            "patient_id": t.patient_id,
            "test_name": t.test_name,
            "reason": t.reason,
            "priority": t.priority,
            "status": t.status,
            "requesting_doctor": t.requesting_doctor,
            "result_summary": t.result_summary,
            "created_at": t.created_at.strftime("%b %d, %Y %H:%M"),
            "updated_at": t.updated_at.strftime("%b %d, %Y %H:%M"),
        }
        for t in tasks
    ]


@router.patch("/lab/tasks/{id}/status", summary="Update Lab Task Workflow Status")
def update_lab_task_status(
    id: str,
    body: LabTaskUpdateStatus,
    db: Session = Depends(get_db),
):
    task = db.query(LabTask).filter(LabTask.id == id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Lab task not found")

    valid_statuses = [
        "Requested",
        "Sample Collected",
        "Processing",
        "Completed",
        "Result Uploaded",
        "Reviewed",
    ]
    if body.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{body.status}'. Must be one of: {', '.join(valid_statuses)}",
        )

    task.status = body.status
    if body.result_summary:
        task.result_summary = body.result_summary
    task.updated_at = datetime.now(timezone.utc)

    log_action(
        db,
        action="updated_lab_status",
        resource_type="lab_task",
        resource_id=task.id,
        user_role="lab_technician",
        details={"status": body.status, "result": body.result_summary},
    )

    db.commit()

    return {
        "success": True,
        "id": task.id,
        "new_status": task.status,
        "result_summary": task.result_summary,
        "updated_at": task.updated_at.isoformat(),
    }


# ─── Admin Dashboard & System Activity ─────────────────────────

@router.get("/admin/overview", summary="Admin Dashboard System Overview")
def get_admin_overview(db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_consultations = db.query(Consultation).count()
    total_followups = db.query(FollowUp).count()
    total_prescriptions = db.query(Medication).count()
    total_labs = db.query(LabTask).count()

    users_by_role = {}
    for role in ["PATIENT", "DOCTOR", "ADMIN", "NURSE", "LAB"]:
        users_by_role[role] = db.query(User).filter(User.role == role).count()

    recent_logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(15)
        .all()
    )

    all_users = (
        db.query(User)
        .order_by(User.created_at.desc())
        .limit(20)
        .all()
    )

    return {
        "status": "healthy",
        "metrics": {
            "total_users": total_users,
            "total_consultations": total_consultations,
            "total_followups": total_followups,
            "total_medications": total_prescriptions,
            "total_labs": total_labs,
            "users_by_role": users_by_role,
        },

        "recent_activity": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "user_role": log.user_role,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "timestamp": log.timestamp.strftime("%b %d, %Y %H:%M:%S"),
            }
            for log in recent_logs
        ],
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.strftime("%b %d, %Y"),
            }
            for u in all_users
        ],
    }
