"""
KENKO-AI — Local SQLite Database Connection & Session Management
Uses SQLite with Write-Ahead Logging (WAL) and foreign keys enabled.
"""

import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

# Store DB file inside backend directory or path configured by env
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'kenko_clinical.db'}")

engine = create_engine(
    DB_PATH,
    connect_args={"check_same_thread": False},  # Needed for SQLite in FastAPI multi-threading
    echo=False,
)

# Enable Foreign Key constraints and WAL mode in SQLite for reliability & performance
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
    finally:
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI Dependency for database session management."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all database tables and add any missing columns on application startup."""
    from app.models import db_models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Safe SQLite auto-migration for added columns
    try:
        with engine.connect() as conn:
            # Check existing columns in consultations table
            res = conn.exec_driver_sql("PRAGMA table_info(consultations)").fetchall()
            existing_cols = {row[1] for row in res}

            new_columns = [
                ("appointment_id", "VARCHAR(64)"),
                ("consultation_type", "VARCHAR(32) DEFAULT 'in_person'"),
                ("patient_language", "VARCHAR(64) DEFAULT 'English'"),
                ("doctor_specialization", "VARCHAR(128) DEFAULT 'General Medicine'"),
                ("google_space_name", "VARCHAR(256)"),
                ("google_meeting_uri", "VARCHAR(512)"),
                ("google_meeting_code", "VARCHAR(64)"),
                ("conference_record_name", "VARCHAR(256)"),
                ("google_oauth_user_id", "VARCHAR(128)"),
                ("meeting_status", "VARCHAR(64) DEFAULT 'scheduled'"),
                ("transcript_status", "VARCHAR(64) DEFAULT 'pending'"),
                ("transcript_resource_name", "VARCHAR(256)"),
                ("started_at", "DATETIME"),
                ("completed_at", "DATETIME"),
                ("transcript_started_at", "DATETIME"),
                ("transcript_ended_at", "DATETIME"),
            ]

            for col_name, col_type in new_columns:
                if col_name not in existing_cols:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE consultations ADD COLUMN {col_name} {col_type}")
                    except Exception:
                        pass

            # Check existing columns in transcript_segments table
            res_ts = conn.exec_driver_sql("PRAGMA table_info(transcript_segments)").fetchall()
            existing_ts_cols = {row[1] for row in res_ts}
            new_ts_columns = [
                ("speaker_role", "VARCHAR(32) DEFAULT 'UNKNOWN'"),
                ("participant_resource_name", "VARCHAR(256)"),
            ]
            for col_name, col_type in new_ts_columns:
                if col_name not in existing_ts_cols:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE transcript_segments ADD COLUMN {col_name} {col_type}")
                    except Exception:
                        pass

            conn.commit()
    except Exception:
        pass

