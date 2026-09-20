from app.routes.auth_routes import router as auth_router
from app.routes.ocr import router as ocr_router
from app.routes.consultations import router as consultations_router
from app.routes.prescriptions import router as prescriptions_router
from app.routes.role_dashboards import router as role_dashboards_router
from app.routes.followups import router as followups_router
from app.routes.demo import router as demo_router

__all__ = [
    "auth_router",
    "ocr_router",
    "consultations_router",
    "prescriptions_router",
    "role_dashboards_router",
    "followups_router",
    "demo_router",
]
