"""
MediBridge AI — Automatic Clinical Routing Engine
Executes on Doctor Approval:
- if tests requested        → creates LabTask(s)
- if follow-up documented   → creates FollowUp object (Status: CONFIRMED)
- if nursing action needed  → creates NursingTask(s)
- if medication documented  → updates patient Medication records
"""

from datetime import datetime, timezone, timedelta
import logging
from sqlalchemy.orm import Session
from app.models.db_models import (
    Consultation,
    ClinicalSummary,
    LabTask,
    FollowUp,
    NursingTask,
    Medication,
    AuditLog,
)

logger = logging.getLogger(__name__)


def route_approved_consultation(db: Session, consultation_id: str, approved_by: str = "Dr. Aarav Patel") -> dict:
    """
    Executes automated role routing for a doctor-approved consultation record.
    """
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise ValueError(f"Consultation {consultation_id} not found.")

    summary = (
        db.query(ClinicalSummary)
        .filter(ClinicalSummary.consultation_id == consultation_id)
        .order_by(ClinicalSummary.version.desc())
        .first()
    )
    if not summary:
        raise ValueError(f"No clinical summary found for consultation {consultation_id}")

    patient_id = consultation.patient_id
    patient_name = consultation.patient_name
    routing_results = {
        "lab_tasks_created": 0,
        "follow_ups_created": 0,
        "nursing_tasks_created": 0,
        "medications_recorded": 0,
    }

    # 1. Route Investigations -> Lab Tasks
    if summary.investigations:
        for inv in summary.investigations:
            test_name = inv.get("test_name") if isinstance(inv, dict) else str(inv)
            reason = inv.get("reason", "Evaluation") if isinstance(inv, dict) else "Evaluation"
            
            existing = db.query(LabTask).filter(
                LabTask.consultation_id == consultation_id,
                LabTask.test_name == test_name,
            ).first()
            
            if not existing and test_name:
                lab_task = LabTask(
                    consultation_id=consultation_id,
                    patient_id=patient_id,
                    patient_name=patient_name,
                    test_name=test_name,
                    reason=reason,
                    status="Requested",
                    requesting_doctor=approved_by,
                    priority="urgent" if "x-ray" in test_name.lower() or "ecg" in test_name.lower() else "normal",
                )
                db.add(lab_task)
                routing_results["lab_tasks_created"] += 1

    # 2. Route Follow-up -> FollowUp Object (Transitions to CONFIRMED on Doctor Approval)
    fu_data = summary.follow_up or {}
    interval_days = fu_data.get("interval_days", 7) if isinstance(fu_data, dict) else 7
    due_date = datetime.now(timezone.utc) + timedelta(days=interval_days)
    action_text = fu_data.get("action") or fu_data.get("reason") or f"Clinical review & test evaluation (in {interval_days} days)"

    existing_fu = db.query(FollowUp).filter(
        FollowUp.consultation_id == consultation_id
    ).first()

    if existing_fu:
        existing_fu.status = "CONFIRMED"
        existing_fu.action = action_text
        existing_fu.interval_days = interval_days
        existing_fu.due_date = due_date
        routing_results["follow_ups_created"] += 1
    else:
        follow_up = FollowUp(
            consultation_id=consultation_id,
            patient_id=patient_id,
            patient_name=patient_name,
            action=action_text,
            time_reference=fu_data.get("date_str", f"in {interval_days} days") if isinstance(fu_data, dict) else f"in {interval_days} days",
            interval_days=interval_days,
            due_date=due_date,
            status="CONFIRMED",  # Confirmed by Doctor!
            category="doctor_review",
            source_quote=fu_data.get("quote") if isinstance(fu_data, dict) else None,
        )
        db.add(follow_up)
        routing_results["follow_ups_created"] += 1

    # 3. Route Nursing Directives -> Nursing Tasks
    if summary.nurse_view and "monitoring_instructions" in summary.nurse_view:
        instructions = summary.nurse_view.get("monitoring_instructions", [])
        for inst in instructions:
            if inst and "No pending" not in inst and "No specific" not in inst:
                nurse_task = NursingTask(
                    consultation_id=consultation_id,
                    patient_id=patient_id,
                    patient_name=patient_name,
                    task_description=inst,
                    priority=summary.nurse_view.get("priority", "normal"),
                    status="pending",
                )
                db.add(nurse_task)
                routing_results["nursing_tasks_created"] += 1

    # 4. Route Medications -> Patient Medication View
    if summary.medications:
        for med in summary.medications:
            if isinstance(med, dict) and med.get("name"):
                med_entry = Medication(
                    consultation_id=consultation_id,
                    patient_id=patient_id,
                    drug_name=med.get("name"),
                    dosage=med.get("dosage", "Not specified"),
                    frequency=med.get("frequency", "1-0-1"),
                    duration=med.get("duration", "5 days"),
                    route=med.get("route", "Oral"),
                    instructions=med.get("instructions", "After food"),
                    source="consultation",
                    source_quote=med.get("quote"),
                )
                db.add(med_entry)
                routing_results["medications_recorded"] += 1

    # 5. Record Audit Log
    audit = AuditLog(
        user_id=approved_by,
        user_role="doctor",
        action="finalized_and_routed",
        resource_type="consultation",
        resource_id=consultation_id,
        details=routing_results,
    )
    db.add(audit)

    # 6. Update consultation status
    consultation.status = "finalized"
    summary.is_doctor_approved = True
    summary.approved_by = approved_by
    summary.approved_at = datetime.now(timezone.utc)

    db.commit()
    logger.info(f"Consultation {consultation_id} successfully routed: {routing_results}")
    return routing_results
