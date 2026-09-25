"""
KENKO-AI Doctor Application, Posting, and Moderation Tests
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, init_db

init_db()
client = TestClient(app)


def test_public_doctors_endpoint():
    response = client.get("/api/doctors")
    assert response.status_code == 200
    data = response.json()
    assert "doctors" in data
    assert isinstance(data["doctors"], list)


def test_public_posts_endpoint():
    response = client.get("/api/feed/posts")
    assert response.status_code == 200
    data = response.json()
    assert "posts" in data
    assert isinstance(data["posts"], list)


def test_rbac_security_admin_endpoints_require_admin():
    # Attempting to access admin review without credentials should return 401 or 403
    response = client.get("/api/admin/doctor-applications")
    assert response.status_code in [401, 403]

    response = client.get("/api/admin/posts")
    assert response.status_code in [401, 403]

    response = client.get("/api/admin/moderation-overview")
    assert response.status_code in [401, 403]
