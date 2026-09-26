from app.routes.auth_routes import router as auth_router
from app.routes.ocr import router as ocr_router
from app.routes.consultations import router as consultations_router
from app.routes.prescriptions import router as prescriptions_router
from app.routes.role_dashboards import router as role_dashboards_router
from app.routes.followups import router as followups_router
from app.routes.demo import router as demo_router
from app.routes.google_routes import router as google_router
from app.routes.meet_routes import router as meet_router
from app.routes.transcription_routes import router as transcription_router
from app.routes.doctor_routes import router as doctor_router
from app.routes.clinical_workspace import router as clinical_workspace_router
from app.routes.appointment_routes import router as appointment_router

__all__ = [
    "auth_router",
    "ocr_router",
    "consultations_router",
    "prescriptions_router",
    "role_dashboards_router",
    "followups_router",
    "demo_router",
    "google_router",
    "meet_router",
    "transcription_router",
    "doctor_router",
    "clinical_workspace_router",
    "appointment_router",
]

