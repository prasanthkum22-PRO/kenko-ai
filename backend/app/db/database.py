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
    """Create all database tables on application startup."""
    from app.models import db_models  # noqa: F401
    Base.metadata.create_all(bind=engine)
