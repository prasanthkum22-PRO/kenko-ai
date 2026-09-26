"""
MediBridge AI — Demo Mode Seeder
Pre-seeds realistic clinical scenarios with full transcript, AI summary,
and routed entities for instantaneous demonstration.
All records are explicitly labeled with is_demo=True and DEMO DATA tags.
"""

from datetime import datetime, timezone, timedelta
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import (
    User,
    Consultation,
    TranscriptSegment,
    ClinicalSummary,
    LabTask,
    FollowUp,
    NursingTask,
    Medication,
    Prescription,
    AuditLog,
)
from app.utils.auth import hash_password
from app.services.router import route_approved_consultation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/demo", tags=["Demo Mode"])


@router.post("/seed", summary="Seed realistic demo consultations, users and patient records")
def seed_demo_data(db: Session = Depends(get_db)):
    """
    Seeds default authentication accounts & two complete fictional clinical consultations:
    1. Aarav Sharma (38M) — Hypertension & Type 2 Diabetes Management
    2. Ananya Kumar (29F) — Acute Respiratory Infection / Bronchitis
    """
    # ── 0. Seed Default Accounts ────────────────────────────────
    default_users = [
        {"email": "prasanthanith5@gmail.com", "pass": "Doctor123!", "name": "Dr. Prasanth", "role": "DOCTOR", "doctor_id": "D-101"},
        {"email": "prasanth.kum22@gmail.com", "pass": "Admin123!", "name": "Prasanth (Admin)", "role": "ADMIN"},
        {"email": "prasanth.kum22@gmaill.com", "pass": "Admin123!", "name": "Prasanth (Admin)", "role": "ADMIN"},
        {"email": "doctor@medibridge.ai", "pass": "Doctor123!", "name": "Dr. Aarav Patel", "role": "DOCTOR", "doctor_id": "D-101"},
        {"email": "patient@medibridge.ai", "pass": "Patient123!", "name": "Aarav Sharma", "role": "PATIENT", "patient_id": "DEMO-P101"},
        {"email": "admin@medibridge.ai", "pass": "Admin123!", "name": "System Administrator", "role": "ADMIN"},
        {"email": "nurse@medibridge.ai", "pass": "Nurse123!", "name": "Nurse Maya Roy", "role": "NURSE"},
        {"email": "lab@medibridge.ai", "pass": "LabTech123!", "name": "Vikram Singh (Lab Tech)", "role": "LAB"},
    ]
    for u in default_users:
        if not db.query(User).filter(User.email == u["email"]).first():
            new_u = User(
                email=u["email"],
                hashed_password=hash_password(u["pass"]),
                full_name=u["name"],
                role=u["role"],
                patient_id=u.get("patient_id"),
                doctor_id=u.get("doctor_id"),
            )
            db.add(new_u)
    db.commit()

    # ── 1. Consultation 1: Aarav Sharma ─────────────────────────
    existing_c1 = db.query(Consultation).filter(Consultation.patient_id == "DEMO-P101").first()

    if not existing_c1:
        c1 = Consultation(
            patient_id="DEMO-P101",
            patient_name="Aarav Sharma (DEMO DATA)",
            patient_age=38,
            patient_gender="Male",
            doctor_name="Dr. Aarav Patel",
            consultation_type="in_person",
            has_consent=True,
            is_demo=True,
            detected_language="English",
            duration_seconds=185,
            status="finalized",
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
        )
        db.add(c1)
        db.commit()
        db.refresh(c1)

        # Transcripts for Aarav Sharma
        segments1 = [
            ("Doctor", 0.0, 4.2, "Good afternoon Aarav. How have you been feeling since your last prescription?"),
            ("Patient", 4.5, 9.8, "Good afternoon Doctor. I have had mild headaches in the morning for about 4 days, but no fever."),
            ("Doctor", 10.2, 14.5, "Let me check your vitals. Your blood pressure is 138/88 mmHg, and pulse is 76 bpm."),
            ("Doctor", 15.0, 21.0, "Your blood pressure is slightly elevated. Are you taking your Telmisartan 40mg regularly every morning?"),
            ("Patient", 21.3, 26.1, "Yes Doctor, every morning after breakfast. My blood sugar has also been around 140 fasting."),
            ("Doctor", 26.5, 34.0, "Understood. We will keep Telmisartan 40mg once a day, and continue Metformin 500mg twice daily with meals."),
            ("Doctor", 34.5, 42.0, "I am also ordering an HbA1c and Fasting Blood Sugar test, plus a Lipid Profile to evaluate your cholesterol."),
            ("Patient", 42.5, 46.0, "Sure Doctor, should I visit the lab tomorrow morning empty stomach?"),
            ("Doctor", 46.5, 52.0, "Yes, exactly. And follow up in 14 days so we can review the lab results and adjust dosages if needed."),
        ]

        for spk, st, et, txt in segments1:
            ts = TranscriptSegment(
                consultation_id=c1.id,
                speaker=spk,
                start_time=st,
                end_time=et,
                text=txt,
                confidence=0.96,
                is_edited=False,
            )
            db.add(ts)

        summary1 = ClinicalSummary(
            consultation_id=c1.id,
            version=1,
            chief_complaint="Headache",
            symptoms=[{
                "name": "Headache",
                "duration": "4 days",
                "quote": "I have had mild headaches in the morning for about 4 days, but no fever.",
                "timestamp": "4s",
                "uncertain": False,
            }],
            history={
                "allergies": "No known drug allergies (NKDA)",
                "past_conditions": "Hypertension, Type 2 Diabetes Mellitus",
                "current_medications": "Telmisartan 40mg OD, Metformin 500mg BD",
            },
            vitals={
                "bp": "138/88 mmHg",
                "pulse": "76 bpm",
                "temperature": "Not documented",
                "spo2": "Not documented",
                "weight": "74 kg",
            },
            investigations=[
                {
                    "test_name": "HbA1c & Fasting Blood Sugar",
                    "reason": "Glycemic control assessment",
                    "quote": "I am also ordering an HbA1c and Fasting Blood Sugar test",
                    "timestamp": "34s",
                    "uncertain": False,
                },
                {
                    "test_name": "Lipid Profile",
                    "reason": "Cardiovascular risk evaluation",
                    "quote": "plus a Lipid Profile to evaluate your cholesterol",
                    "timestamp": "34s",
                    "uncertain": False,
                },
            ],
            assessment="Essential Hypertension & Type 2 Diabetes Mellitus under review",
            treatment_plan="Continue Telmisartan 40mg OD and Metformin 500mg BD. Order fasting labs. Review in 14 days.",
            doctor_instructions=[
                {"instruction": "Visit lab tomorrow morning on empty stomach for FBS and lipid tests.", "quote": "visit the lab tomorrow morning empty stomach"},
                {"instruction": "Take Telmisartan 40mg after breakfast regularly.", "quote": "keep Telmisartan 40mg once a day"},
            ],
            medications=[
                {
                    "name": "Telmisartan",
                    "dosage": "40mg",
                    "frequency": "1-0-0",
                    "duration": "30 days",
                    "route": "Oral",
                    "instructions": "Take in morning after breakfast",
                    "quote": "We will keep Telmisartan 40mg once a day",
                    "timestamp": "26s",
                    "uncertain": False,
                },
                {
                    "name": "Metformin",
                    "dosage": "500mg",
                    "frequency": "1-0-1",
                    "duration": "30 days",
                    "route": "Oral",
                    "instructions": "Take with breakfast and dinner",
                    "quote": "continue Metformin 500mg twice daily with meals",
                    "timestamp": "26s",
                    "uncertain": False,
                },
            ],
            follow_up={
                "interval_days": 14,
                "date_str": "In 14 days",
                "reason": "Review blood sugar and lipid profile results",
                "action": "Review blood sugar and lipid profile results",
                "status": "CONFIRMED",
                "quote": "And follow up in 14 days so we can review the lab results",
            },
            follow_up_items=[
                {
                    "action": "Review blood sugar and lipid profile results",
                    "timeReference": "14 days",
                    "source": "doctor_statement",
                    "status": "CONFIRMED",
                    "quote": "And follow up in 14 days so we can review the lab results",
                }
            ],
            patient_view={
                "what_we_discussed": "Routine checkup for your blood pressure and diabetes management. Your morning headaches were noted.",
                "doctor_findings": "Your blood pressure is 138/88 mmHg. Diabetes and BP are stable on your current medication.",
                "medications_to_take": [
                    {"name": "Telmisartan", "how_much": "40mg", "schedule": "1 tablet in the morning", "for_how_long": "30 days", "instructions": "Take after breakfast"},
                    {"name": "Metformin", "how_much": "500mg", "schedule": "1 tablet twice daily", "for_how_long": "30 days", "instructions": "Take with meals"},
                ],
                "tests_needed": [
                    {"test": "HbA1c & Fasting Blood Sugar", "why": "Check 3-month average glucose control"},
                    {"test": "Lipid Profile", "why": "Measure cholesterol and lipid balance"},
                ],
                "follow_up": "Please schedule your visit in 14 days with the test reports.",
                "urgent_guidance": "Seek immediate emergency help if you experience sudden dizziness, vision blurring, or chest heaviness.",
            },
            nurse_view={
                "condition": "Essential Hypertension & Type 2 Diabetes",
                "vitals_summary": {"bp": "138/88 mmHg", "pulse": "76 bpm"},
                "allergies": "None",
                "active_meds": ["Telmisartan 40mg (1-0-0)", "Metformin 500mg (1-0-1)"],
                "monitoring_instructions": [
                    "Record BP sitting and standing at next visit",
                    "Ensure patient completes Fasting Blood Sugar in morning",
                ],
                "priority": "normal",
            },
            summary_text="Patient Aarav Sharma reviewed for hypertension and diabetes management. Blood pressure was 138/88 mmHg. Fasting blood tests ordered and 14-day review scheduled.",
            is_doctor_approved=True,
            approved_by="Dr. Aarav Patel",
            approved_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        db.add(summary1)
        db.commit()

        # Route Consultation 1
        route_approved_consultation(db, c1.id, approved_by="Dr. Aarav Patel")

    # ── 2. Consultation 2: Ananya Kumar ─────────────────────────
    existing_c2 = db.query(Consultation).filter(Consultation.patient_id == "DEMO-P102").first()
    if not existing_c2:
        c2 = Consultation(
            patient_id="DEMO-P102",
            patient_name="Ananya Kumar (DEMO DATA)",
            patient_age=29,
            patient_gender="Female",
            doctor_name="Dr. Aarav Patel",
            consultation_type="video",
            has_consent=True,
            is_demo=True,
            detected_language="English",
            duration_seconds=142,
            status="summary_ready",
            created_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        )
        db.add(c2)
        db.commit()
        db.refresh(c2)

        segments2 = [
            ("Doctor", 0.0, 3.8, "Hello Ananya, I can hear you clearly. What symptoms are you experiencing?"),
            ("Patient", 4.0, 10.2, "Hello Doctor. I have had a severe cough and fever for 3 days. My chest feels slightly congested."),
            ("Doctor", 10.5, 16.0, "Do you have any known allergies to antibiotics or penicillin?"),
            ("Patient", 16.2, 19.0, "No allergies that I know of, Doctor."),
            ("Doctor", 19.5, 27.0, "Your recorded temperature was 101.2 °F and pulse is 88 bpm. Oxygen saturation is 97%."),
            ("Doctor", 27.5, 36.0, "I am prescribing Amoxicillin/Clavulanate 625mg twice daily for 5 days, and Paracetamol 650mg for fever."),
            ("Doctor", 36.5, 44.0, "Also, please get a Chest X-Ray PA View done to rule out any lower chest infection. Follow up in 5 days."),
            ("Patient", 44.5, 48.0, "Thank you Doctor, I will get the X-ray today and start the medicines."),
        ]

        for spk, st, et, txt in segments2:
            ts = TranscriptSegment(
                consultation_id=c2.id,
                speaker=spk,
                start_time=st,
                end_time=et,
                text=txt,
                confidence=0.97,
                is_edited=False,
            )
            db.add(ts)

        summary2 = ClinicalSummary(
            consultation_id=c2.id,
            version=1,
            chief_complaint="Cough, Fever",
            symptoms=[
                {
                    "name": "Cough",
                    "duration": "3 days",
                    "quote": "I have had a severe cough and fever for 3 days",
                    "timestamp": "4s",
                    "uncertain": False,
                },
                {
                    "name": "Fever",
                    "duration": "3 days",
                    "quote": "severe cough and fever for 3 days",
                    "timestamp": "4s",
                    "uncertain": False,
                },
            ],
            history={
                "allergies": "No known drug allergies (NKDA)",
                "past_conditions": "Not documented",
                "current_medications": "Not documented",
            },
            vitals={
                "bp": "Not documented",
                "pulse": "88 bpm",
                "temperature": "101.2 °F",
                "spo2": "97%",
                "weight": "58 kg",
            },
            investigations=[{
                "test_name": "Chest X-Ray (PA View)",
                "reason": "Evaluate respiratory fields",
                "quote": "please get a Chest X-Ray PA View done to rule out any lower chest infection",
                "timestamp": "36s",
                "uncertain": False,
            }],
            assessment="Acute Upper Respiratory Tract Infection / Bronchitis",
            treatment_plan="Antibiotic therapy with Amoxicillin/Clavulanate and antipyretic. Chest X-Ray. Review in 5 days.",
            doctor_instructions=[
                {"instruction": "Get Chest X-Ray PA View done today.", "quote": "please get a Chest X-Ray PA View done"},
                {"instruction": "Complete full 5-day antibiotic course.", "quote": "Amoxicillin/Clavulanate 625mg twice daily for 5 days"},
            ],
            medications=[
                {
                    "name": "Amoxicillin/Clavulanate",
                    "dosage": "625mg",
                    "frequency": "1-0-1",
                    "duration": "5 days",
                    "route": "Oral",
                    "instructions": "Complete full 5-day antibiotic course after food",
                    "quote": "Amoxicillin/Clavulanate 625mg twice daily for 5 days",
                    "timestamp": "27s",
                    "uncertain": False,
                },
                {
                    "name": "Paracetamol",
                    "dosage": "650mg",
                    "frequency": "1-0-1",
                    "duration": "3-5 days",
                    "route": "Oral",
                    "instructions": "Take after meals if fever > 99.5°F",
                    "quote": "and Paracetamol 650mg for fever",
                    "timestamp": "27s",
                    "uncertain": False,
                },
            ],
            follow_up={
                "interval_days": 5,
                "date_str": "In 5 days",
                "reason": "Clinical review and fever resolution check",
                "action": "Clinical review and fever resolution check",
                "status": "PENDING_DOCTOR_CONFIRMATION",
                "quote": "Follow up in 5 days",
            },
            follow_up_items=[
                {
                    "action": "Clinical review and fever resolution check",
                    "timeReference": "5 days",
                    "source": "doctor_statement",
                    "status": "PENDING_DOCTOR_CONFIRMATION",
                    "quote": "Follow up in 5 days",
                }
            ],
            patient_view={
                "what_we_discussed": "Video consultation for 3 days of severe cough, fever, and chest congestion.",
                "doctor_findings": "Temperature was 101.2 °F and oxygen saturation is good at 97%. Assessed as acute bronchitis/chest infection.",
                "medications_to_take": [
                    {"name": "Amoxicillin/Clavulanate", "how_much": "625mg", "schedule": "1 tablet in morning, 1 tablet at night", "for_how_long": "5 days", "instructions": "Take after meals, do not stop midway"},
                    {"name": "Paracetamol", "how_much": "650mg", "schedule": "Twice daily as needed", "for_how_long": "3-5 days", "instructions": "Take after food for fever/body aches"},
                ],
                "tests_needed": [
                    {"test": "Chest X-Ray (PA View)", "why": "Ensure lungs are clear from pneumonia"},
                ],
                "follow_up": "Return for review in 5 days (Pending Doctor Confirmation).",
                "urgent_guidance": "Seek urgent care if breathing becomes difficult or temperature exceeds 103°F.",
            },
            nurse_view={
                "condition": "Acute Bronchitis / Fever",
                "vitals_summary": {"temperature": "101.2 °F", "spo2": "97%", "pulse": "88 bpm"},
                "allergies": "None documented",
                "active_meds": ["Amoxicillin/Clav 625mg (1-0-1)", "Paracetamol 650mg (1-0-1)"],
                "monitoring_instructions": [
                    "Check temperature and SpO2 every shift",
                    "Verify Chest X-ray requisition is processed",
                ],
                "priority": "normal",
            },
            summary_text="Patient Ananya Kumar presented with 3 days of cough and fever (101.2°F). Prescribed oral antibiotics and Chest X-ray with 5-day review.",
            is_doctor_approved=False,
        )
        db.add(summary2)
        db.commit()

    return {
        "success": True,
        "message": "Demo clinical records seeded successfully with strict DEMO DATA flags.",
        "patients": ["Aarav Sharma (DEMO-P101)", "Ananya Kumar (DEMO-P102)"],
    }


@router.get("/scenarios", summary="List pre-seeded demo clinical scenarios")
def get_demo_scenarios():
    """
    Returns curated demo clinical cases with complete transcripts and structured mock extractions.
    All scenarios are clearly marked as DEMO DATA.
    """
    return [
        {
            "id": "scenario-1",
            "title": "Hypertension & T2DM Follow-Up",
            "patient_name": "Aarav Sharma (DEMO DATA)",
            "patient_id": "DEMO-P101",
            "age": 38,
            "gender": "Male",
            "doctor": "Dr. Aarav Patel",
            "is_demo": True,
            "disclaimer": "SYNTHETIC DEMO DATA — For Demonstration Purposes Only",
            "detected_language": "English",
            "symptoms": ["Morning headache (4 days)"],
            "vitals": {"bp": "138/88 mmHg", "pulse": "76 bpm"},
            "medications": ["Telmisartan 40mg OD", "Metformin 500mg BD"],
            "tests": ["HbA1c & Fasting Blood Sugar", "Lipid Profile"],
            "follow_up": "14 days",
            "follow_up_status": "CONFIRMED"
        },
        {
            "id": "scenario-2",
            "title": "Acute Respiratory Infection (Video)",
            "patient_name": "Ananya Kumar (DEMO DATA)",
            "patient_id": "DEMO-P102",
            "age": 29,
            "gender": "Female",
            "doctor": "Dr. Aarav Patel",
            "is_demo": True,
            "disclaimer": "SYNTHETIC DEMO DATA — For Demonstration Purposes Only",
            "detected_language": "English",
            "symptoms": ["Severe cough (3 days)", "Fever (101.2 °F)"],
            "vitals": {"temperature": "101.2 °F", "spo2": "97%", "pulse": "88 bpm"},
            "medications": ["Amoxicillin/Clavulanate 625mg BD", "Paracetamol 650mg SOS"],
            "tests": ["Chest X-Ray PA View"],
            "follow_up": "5 days",
            "follow_up_status": "PENDING_DOCTOR_CONFIRMATION"
        },
        {
            "id": "scenario-3",
            "title": "Multilingual Orthopedic Consultation",
            "patient_name": "Priya Sharma (DEMO DATA)",
            "patient_id": "DEMO-P103",
            "age": 45,
            "gender": "Female",
            "doctor": "Dr. Rajesh Kumar",
            "is_demo": True,
            "disclaimer": "SYNTHETIC DEMO DATA — For Demonstration Purposes Only",
            "detected_language": "Tamil / English",
            "symptoms": ["Right knee swelling and pain (3 days)"],
            "vitals": {"bp": "124/80 mmHg", "pulse": "72 bpm"},
            "medications": ["Ibuprofen 400mg BD (5 days)"],
            "tests": ["X-Ray Right Knee (AP & Lateral)"],
            "follow_up": "10 days",
            "follow_up_status": "PENDING_DOCTOR_CONFIRMATION"
        }
    ]

