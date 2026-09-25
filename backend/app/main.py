"""
MediBridge AI — FastAPI Healthcare Intelligence Backend
Startup: uvicorn app.main:app --reload --port 8000
"""

import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from app.db.database import init_db
from app.routes import (
    auth_router,
    ocr_router,
    consultations_router,
    prescriptions_router,
    role_dashboards_router,
    followups_router,
    demo_router,
    google_router,
    meet_router,
    transcription_router,
    doctor_router,
    clinical_workspace_router,
)

# ── Environment ───────────────────────────────────────────────
load_dotenv()

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Application Lifespan ──────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    1. Initialize SQLite tables
    2. Auto-seed demo dataset if empty
    """
    logger.info("MediBridge AI clinical backend starting...")
    
    # Initialize DB tables
    try:
        init_db()
        logger.info("Database initialized successfully.")
    except Exception as exc:
        logger.error(f"Database initialization error: {exc}")

    # Ensure uploads directories exist
    uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    consultations_dir = uploads_dir / "consultations"
    consultations_dir.mkdir(exist_ok=True)

    # Auto-seed demo consultations so the platform is ready out of the box
    try:
        from app.db.database import SessionLocal
        from app.routes.demo import seed_demo_data
        db = SessionLocal()
        seed_demo_data(db)
        db.close()
        logger.info("Demo clinical records pre-seeded.")
    except Exception as exc:
        logger.warning(f"Demo auto-seed note: {exc}")

    yield

    logger.info("MediBridge AI backend shutting down.")


# ── App Instance ──────────────────────────────────────────────
app = FastAPI(
    title="MediBridge AI Clinical Intelligence API",
    description="From Conversation to Connected Care: NVIDIA Cloud STT, Deterministic Clinical Extraction & Follow-Up Intelligence. Production: No local models.",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ── CORS Middleware ───────────────────────────────────────────
# Read allowed origins from environment variable (default to local frontend Vite server)
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Mount Static Files ────────────────────────────────────────
uploads_path = Path(__file__).resolve().parent.parent / "uploads"
uploads_path.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


# ── Include Routers ───────────────────────────────────────────
app.include_router(auth_router)
app.include_router(ocr_router)
app.include_router(consultations_router)
app.include_router(prescriptions_router)
app.include_router(role_dashboards_router)
app.include_router(followups_router)
app.include_router(demo_router)
app.include_router(google_router)
app.include_router(meet_router)
app.include_router(transcription_router)
app.include_router(doctor_router)
app.include_router(clinical_workspace_router)



# ── Health Checks ─────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "MediBridge AI Clinical Intelligence API",
        "tagline": "From Conversation to Connected Care",
        "status": "running",
        "version": "3.0.0",
        "differentiator": "Capture -> Understand -> Verify -> Personalize -> Route -> Follow Up",
        "ai_stack": "NVIDIA Cloud STT (whisper-large-v3) + Deterministic Clinical Extraction + SQLite",
        "local_models": "none",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "MediBridge AI"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=os.getenv("APP_HOST", "0.0.0.0"),
        port=int(os.getenv("APP_PORT", "8000")),
        reload=True,
    )
