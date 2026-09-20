"""
KENKO-AI — Audit Logging Service
Ensures complete privacy, accountability, and traceability for all clinical actions.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.db_models import AuditLog


def log_action(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: str,
    user_id: str = "system",
    user_role: str = "doctor",
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """Records an audit log entry in the local database."""
    entry = AuditLog(
        user_id=user_id,
        user_role=user_role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
