"""
MediBridge AI — Doctor Application & Admin Moderation Routes
RBAC-enforced endpoints for the full doctor application, approval, post moderation workflow.
All role/status changes happen here — never in frontend code.
"""

import os
import shutil
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File,
    Form, Query, status as http_status
)
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.db_models import (
    User, DoctorApplication, DoctorProfile, Post,
    UserNotification, AuditLog
)
from app.utils.auth import require_authenticated_user, require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Doctor Applications & Posts"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
DOCTOR_DOCS_DIR = UPLOADS_DIR / "doctor_docs"
DOCTOR_DOCS_DIR.mkdir(parents=True, exist_ok=True)
POST_IMAGES_DIR = UPLOADS_DIR / "post_images"
POST_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

POST_CATEGORIES = [
    "Health Education", "Patient Education", "Medical Technology",
    "Clinical Awareness", "Healthcare News", "Professional Insights", "General Health"
]


# ─── Utility ─────────────────────────────────────────────────────────────────

def _notify(db: Session, user_id: str, title: str, message: str,
            ntype: str = "info", related_type: str = None, related_id: str = None):
    notif = UserNotification(
        user_id=user_id, title=title, message=message,
        notification_type=ntype, related_type=related_type, related_id=related_id
    )
    db.add(notif)


def _audit(db: Session, actor_id: str, action: str, target_type: str,
           target_id: str, details: dict = None):
    log = AuditLog(
        user_id=actor_id, user_role="system", action=action,
        resource_type=target_type, resource_id=target_id,
        details=details or {}
    )
    db.add(log)


def _save_upload(upload: UploadFile, dest_dir: Path, prefix: str = "") -> str:
    """Save uploaded file to dest_dir and return its relative path."""
    ext = Path(upload.filename).suffix if upload.filename else ""
    from uuid import uuid4
    filename = f"{prefix}{uuid4().hex}{ext}"
    dest = dest_dir / filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(upload.file, f)
    return str(dest)


# ─────────────────────────────────────────────────────────────────────────────
# 1. DOCTOR APPLICATION ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/doctor-applications", summary="Submit a new doctor application")
async def submit_doctor_application(
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    date_of_birth: str = Form(""),
    medical_degree: str = Form(...),
    specialization: str = Form(...),
    registration_number: str = Form(...),
    years_of_experience: int = Form(0),
    organization: str = Form(""),
    professional_bio: str = Form(""),
    languages: str = Form("[]"),        # JSON string
    areas_of_practice: str = Form("[]"),  # JSON string
    qualification_doc: Optional[UploadFile] = File(None),
    registration_doc: Optional[UploadFile] = File(None),
    profile_photo: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    import json

    # Prevent duplicate pending applications
    existing = db.query(DoctorApplication).filter(
        DoctorApplication.user_id == current_user.id,
        DoctorApplication.status.in_(["PENDING", "UNDER_REVIEW", "APPROVED"])
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"You already have an active application (status: {existing.status})."
        )

    # Parse JSON fields
    try:
        langs = json.loads(languages) if languages else []
        areas = json.loads(areas_of_practice) if areas_of_practice else []
    except Exception:
        langs, areas = [], []

    # Save documents
    qual_path = _save_upload(qualification_doc, DOCTOR_DOCS_DIR, "qual_") if qualification_doc and qualification_doc.filename else None
    reg_path = _save_upload(registration_doc, DOCTOR_DOCS_DIR, "reg_") if registration_doc and registration_doc.filename else None
    photo_path = _save_upload(profile_photo, DOCTOR_DOCS_DIR, "photo_") if profile_photo and profile_photo.filename else None

    app = DoctorApplication(
        user_id=current_user.id,
        full_name=full_name,
        email=email,
        phone=phone,
        date_of_birth=date_of_birth,
        medical_degree=medical_degree,
        specialization=specialization,
        registration_number=registration_number,
        years_of_experience=years_of_experience,
        organization=organization,
        professional_bio=professional_bio,
        languages=langs,
        areas_of_practice=areas,
        qualification_doc_path=qual_path,
        registration_doc_path=reg_path,
        profile_photo_path=photo_path,
        status="PENDING",
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(app)

    # Update user role to DOCTOR_PENDING
    current_user.role = "DOCTOR_PENDING"

    _notify(db, current_user.id,
            "Doctor Application Submitted",
            "Your application has been submitted. Our administration team will review it shortly.",
            ntype="info", related_type="doctor_application", related_id=app.id)

    _audit(db, current_user.id, "DOCTOR_APPLICATION_SUBMITTED", "doctor_application", app.id,
           {"specialization": specialization})

    db.commit()
    db.refresh(app)

    return {
        "success": True,
        "application_id": app.id,
        "status": app.status,
        "message": "Doctor application submitted successfully. You will be notified once reviewed.",
    }


@router.get("/doctor-applications/my", summary="Get current user's own application")
def get_my_application(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    app = db.query(DoctorApplication).filter(
        DoctorApplication.user_id == current_user.id
    ).order_by(DoctorApplication.submitted_at.desc()).first()

    if not app:
        return {"application": None}

    return {
        "application": {
            "id": app.id,
            "status": app.status,
            "full_name": app.full_name,
            "email": app.email,
            "specialization": app.specialization,
            "medical_degree": app.medical_degree,
            "registration_number": app.registration_number,
            "years_of_experience": app.years_of_experience,
            "organization": app.organization,
            "professional_bio": app.professional_bio,
            "languages": app.languages or [],
            "areas_of_practice": app.areas_of_practice or [],
            "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
            "reviewed_at": app.reviewed_at.isoformat() if app.reviewed_at else None,
            "review_message": app.review_message,
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. ADMIN — DOCTOR APPLICATION MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/doctor-applications", summary="[ADMIN] List all doctor applications")
def admin_list_applications(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    q = db.query(DoctorApplication)
    if status:
        q = q.filter(DoctorApplication.status == status.upper())
    if search:
        s = f"%{search.lower()}%"
        q = q.filter(
            (DoctorApplication.full_name.ilike(s)) |
            (DoctorApplication.email.ilike(s)) |
            (DoctorApplication.specialization.ilike(s))
        )
    total = q.count()
    apps = q.order_by(DoctorApplication.submitted_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "applications": [
            {
                "id": a.id,
                "user_id": a.user_id,
                "full_name": a.full_name,
                "email": a.email,
                "specialization": a.specialization,
                "medical_degree": a.medical_degree,
                "years_of_experience": a.years_of_experience,
                "organization": a.organization,
                "status": a.status,
                "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
                "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
            }
            for a in apps
        ]
    }


@router.get("/admin/doctor-applications/{app_id}", summary="[ADMIN] Get full application detail")
def admin_get_application(
    app_id: str,
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    app = db.query(DoctorApplication).filter(DoctorApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    # Mark as under review
    if app.status == "PENDING":
        app.status = "UNDER_REVIEW"
        db.commit()

    return {
        "id": app.id,
        "user_id": app.user_id,
        "full_name": app.full_name,
        "email": app.email,
        "phone": app.phone,
        "date_of_birth": app.date_of_birth,
        "medical_degree": app.medical_degree,
        "specialization": app.specialization,
        "registration_number": app.registration_number,
        "years_of_experience": app.years_of_experience,
        "organization": app.organization,
        "professional_bio": app.professional_bio,
        "languages": app.languages or [],
        "areas_of_practice": app.areas_of_practice or [],
        "status": app.status,
        "review_message": app.review_message,
        "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
        "reviewed_at": app.reviewed_at.isoformat() if app.reviewed_at else None,
        "has_qualification_doc": bool(app.qualification_doc_path),
        "has_registration_doc": bool(app.registration_doc_path),
        "has_profile_photo": bool(app.profile_photo_path),
    }


@router.post("/admin/doctor-applications/{app_id}/approve", summary="[ADMIN] Approve a doctor application")
def admin_approve_application(
    app_id: str,
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    app = db.query(DoctorApplication).filter(DoctorApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    if app.status == "APPROVED":
        raise HTTPException(status_code=400, detail="Application is already approved.")

    now = datetime.now(timezone.utc)

    # 1. Approve application
    app.status = "APPROVED"
    app.reviewed_by = admin.id
    app.reviewed_at = now

    # 2. Promote user to DOCTOR
    user = db.query(User).filter(User.id == app.user_id).first()
    if user:
        user.role = "DOCTOR"
        if not user.doctor_id:
            import random
            user.doctor_id = f"D-{random.randint(10000, 99999)}"

    # 3. Create/update DoctorProfile
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == app.user_id).first()
    if not profile:
        profile = DoctorProfile(user_id=app.user_id)
        db.add(profile)
    profile.verification_status = "VERIFIED"
    profile.specialization = app.specialization
    profile.medical_degree = app.medical_degree
    profile.registration_number = app.registration_number
    profile.years_of_experience = app.years_of_experience
    profile.organization = app.organization
    profile.professional_bio = app.professional_bio
    profile.languages = app.languages or []
    profile.areas_of_practice = app.areas_of_practice or []
    profile.profile_photo_path = app.profile_photo_path
    profile.verified_at = now
    profile.verified_by = admin.id
    profile.application_id = app.id

    # 4. Notify applicant
    if user:
        _notify(db, user.id,
                "🎉 Doctor Application Approved",
                "Congratulations! Your doctor application has been approved. Your Doctor Dashboard is now available.",
                ntype="success", related_type="doctor_application", related_id=app.id)

    # 5. Audit
    _audit(db, admin.id, "DOCTOR_APPLICATION_APPROVED", "doctor_application", app.id,
           {"applicant_user_id": app.user_id, "specialization": app.specialization})

    db.commit()

    return {"success": True, "message": f"Doctor application approved. User {app.full_name} is now a verified doctor."}


@router.post("/admin/doctor-applications/{app_id}/reject", summary="[ADMIN] Reject a doctor application")
def admin_reject_application(
    app_id: str,
    reason: str = Form(...),
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    app = db.query(DoctorApplication).filter(DoctorApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    now = datetime.now(timezone.utc)
    app.status = "REJECTED"
    app.review_message = reason
    app.reviewed_by = admin.id
    app.reviewed_at = now

    # Revert user to PATIENT if they were DOCTOR_PENDING
    user = db.query(User).filter(User.id == app.user_id).first()
    if user and user.role == "DOCTOR_PENDING":
        user.role = "PATIENT"

    if user:
        _notify(db, user.id,
                "Doctor Application Status Update",
                f"Your doctor application was not approved. Reason: {reason}",
                ntype="warning", related_type="doctor_application", related_id=app.id)

    _audit(db, admin.id, "DOCTOR_APPLICATION_REJECTED", "doctor_application", app.id,
           {"reason": reason, "applicant_user_id": app.user_id})

    db.commit()
    return {"success": True, "message": "Application rejected."}


@router.post("/admin/doctor-applications/{app_id}/request-info", summary="[ADMIN] Request more information")
def admin_request_info(
    app_id: str,
    message: str = Form(...),
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    app = db.query(DoctorApplication).filter(DoctorApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    app.status = "REQUIRES_MORE_INFORMATION"
    app.review_message = message
    app.reviewed_by = admin.id
    app.reviewed_at = datetime.now(timezone.utc)

    user = db.query(User).filter(User.id == app.user_id).first()
    if user:
        _notify(db, user.id,
                "Additional Information Required",
                f"Your doctor application requires more information: {message}",
                ntype="action_required", related_type="doctor_application", related_id=app.id)

    _audit(db, admin.id, "DOCTOR_APPLICATION_CHANGES_REQUESTED", "doctor_application", app.id, {"message": message})

    db.commit()
    return {"success": True, "message": "Request for more information sent."}


# ─────────────────────────────────────────────────────────────────────────────
# 3. DOCTOR POSTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/posts", summary="Create a new post (DOCTOR only)")
async def create_post(
    title: str = Form(...),
    content: str = Form(...),
    category: str = Form("General Health"),
    tags: str = Form("[]"),
    specialization: str = Form(""),
    references: str = Form("[]"),
    save_as_draft: bool = Form(True),
    cover_image: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_role(["DOCTOR"])),
    db: Session = Depends(get_db),
):
    import json

    # Verify doctor profile is verified
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not profile or profile.verification_status != "VERIFIED":
        raise HTTPException(status_code=403, detail="Only verified doctors can create posts.")

    try:
        tags_list = json.loads(tags) if tags else []
        refs_list = json.loads(references) if references else []
    except Exception:
        tags_list, refs_list = [], []

    image_path = None
    if cover_image and cover_image.filename:
        image_path = _save_upload(cover_image, POST_IMAGES_DIR, "cover_")

    now = datetime.now(timezone.utc)
    status = "DRAFT" if save_as_draft else "PENDING_REVIEW"

    post = Post(
        author_id=current_user.id,
        title=title,
        content=content,
        cover_image_path=image_path,
        category=category if category in POST_CATEGORIES else "General Health",
        tags=tags_list,
        specialization=specialization,
        references=refs_list,
        status=status,
        submitted_at=now if not save_as_draft else None,
    )
    db.add(post)

    if not save_as_draft:
        _notify(db, current_user.id,
                "Post Submitted for Review",
                f"Your post '{title}' has been submitted for admin review.",
                ntype="info", related_type="post", related_id=post.id)
        _audit(db, current_user.id, "POST_SUBMITTED", "post", post.id, {"title": title})

    db.commit()
    db.refresh(post)

    return {
        "success": True,
        "post_id": post.id,
        "status": post.status,
        "message": "Post saved as draft." if save_as_draft else "Post submitted for admin review.",
    }


@router.get("/posts/my", summary="Get current doctor's own posts")
def get_my_posts(
    status: Optional[str] = Query(None),
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"])),
    db: Session = Depends(get_db),
):
    q = db.query(Post).filter(Post.author_id == current_user.id)
    if status:
        q = q.filter(Post.status == status.upper())
    posts = q.order_by(Post.created_at.desc()).all()

    return {
        "posts": [
            {
                "id": p.id, "title": p.title, "category": p.category,
                "status": p.status, "tags": p.tags or [],
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "submitted_at": p.submitted_at.isoformat() if p.submitted_at else None,
                "published_at": p.published_at.isoformat() if p.published_at else None,
                "review_message": p.review_message,
            }
            for p in posts
        ]
    }


@router.post("/posts/{post_id}/submit", summary="Submit draft post for review")
def submit_post_for_review(
    post_id: str,
    current_user: User = Depends(require_role(["DOCTOR"])),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id, Post.author_id == current_user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    if post.status not in ("DRAFT", "CHANGES_REQUESTED"):
        raise HTTPException(status_code=400, detail=f"Cannot submit post with status '{post.status}'.")

    post.status = "PENDING_REVIEW"
    post.submitted_at = datetime.now(timezone.utc)

    _notify(db, current_user.id,
            "Post Submitted for Review",
            f"Your post '{post.title}' has been submitted for admin review.",
            ntype="info", related_type="post", related_id=post.id)
    _audit(db, current_user.id, "POST_SUBMITTED", "post", post.id, {"title": post.title})

    db.commit()
    return {"success": True, "status": "PENDING_REVIEW"}


@router.put("/posts/{post_id}", summary="Update a draft or changes-requested post")
async def update_post(
    post_id: str,
    title: str = Form(None),
    content: str = Form(None),
    category: str = Form(None),
    tags: str = Form(None),
    specialization: str = Form(None),
    references: str = Form(None),
    current_user: User = Depends(require_role(["DOCTOR"])),
    db: Session = Depends(get_db),
):
    import json
    post = db.query(Post).filter(Post.id == post_id, Post.author_id == current_user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    if post.status not in ("DRAFT", "CHANGES_REQUESTED"):
        raise HTTPException(status_code=400, detail="Only draft or changes-requested posts can be edited.")

    if title: post.title = title
    if content: post.content = content
    if category and category in POST_CATEGORIES: post.category = category
    if tags:
        try: post.tags = json.loads(tags)
        except: pass
    if specialization: post.specialization = specialization
    if references:
        try: post.references = json.loads(references)
        except: pass

    db.commit()
    return {"success": True, "message": "Post updated."}


# ─────────────────────────────────────────────────────────────────────────────
# 4. PUBLIC POST FEED
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/feed/posts", summary="Public post feed (PUBLISHED only)")
def public_post_feed(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    q = db.query(Post).filter(Post.status == "PUBLISHED")
    if category:
        q = q.filter(Post.category == category)
    if search:
        s = f"%{search.lower()}%"
        q = q.filter((Post.title.ilike(s)) | (Post.content.ilike(s)))

    total = q.count()
    posts = q.order_by(Post.published_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    result = []
    for p in posts:
        author = db.query(User).filter(User.id == p.author_id).first()
        prof = db.query(DoctorProfile).filter(DoctorProfile.user_id == p.author_id).first()
        result.append({
            "id": p.id,
            "title": p.title,
            "content": p.content[:400] + "..." if len(p.content) > 400 else p.content,
            "category": p.category,
            "tags": p.tags or [],
            "published_at": p.published_at.isoformat() if p.published_at else None,
            "author": {
                "id": author.id if author else None,
                "name": author.full_name if author else "Unknown Doctor",
                "specialization": prof.specialization if prof else "",
                "verified": prof.verification_status == "VERIFIED" if prof else False,
            },
        })

    return {"total": total, "page": page, "per_page": per_page, "posts": result}


@router.get("/feed/posts/{post_id}", summary="Get single published post (public)")
def get_public_post(post_id: str, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id, Post.status == "PUBLISHED").first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")

    author = db.query(User).filter(User.id == post.author_id).first()
    prof = db.query(DoctorProfile).filter(DoctorProfile.user_id == post.author_id).first()

    return {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "category": post.category,
        "tags": post.tags or [],
        "references": post.references or [],
        "published_at": post.published_at.isoformat() if post.published_at else None,
        "author": {
            "id": author.id if author else None,
            "name": author.full_name if author else "Unknown",
            "specialization": prof.specialization if prof else "",
            "bio": prof.professional_bio if prof else "",
            "years_experience": prof.years_of_experience if prof else 0,
            "languages": prof.languages if prof else [],
            "verified": prof.verification_status == "VERIFIED" if prof else False,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. ADMIN — POST MODERATION
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/posts", summary="[ADMIN] List posts for moderation")
def admin_list_posts(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    q = db.query(Post)
    if status:
        q = q.filter(Post.status == status.upper())
    if search:
        s = f"%{search.lower()}%"
        q = q.filter(Post.title.ilike(s))

    total = q.count()
    posts = q.order_by(Post.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    result = []
    for p in posts:
        author = db.query(User).filter(User.id == p.author_id).first()
        result.append({
            "id": p.id, "title": p.title, "category": p.category,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "submitted_at": p.submitted_at.isoformat() if p.submitted_at else None,
            "author_name": author.full_name if author else "Unknown",
            "author_id": p.author_id,
        })

    return {"total": total, "page": page, "per_page": per_page, "posts": result}


@router.get("/admin/posts/{post_id}", summary="[ADMIN] Get full post for review")
def admin_get_post(
    post_id: str,
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")

    author = db.query(User).filter(User.id == post.author_id).first()
    prof = db.query(DoctorProfile).filter(DoctorProfile.user_id == post.author_id).first()

    return {
        "id": post.id, "title": post.title, "content": post.content,
        "category": post.category, "tags": post.tags or [],
        "specialization": post.specialization, "references": post.references or [],
        "status": post.status, "review_message": post.review_message,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "submitted_at": post.submitted_at.isoformat() if post.submitted_at else None,
        "published_at": post.published_at.isoformat() if post.published_at else None,
        "author": {
            "id": author.id if author else None,
            "name": author.full_name if author else "Unknown",
            "specialization": prof.specialization if prof else "",
            "verified": prof.verification_status == "VERIFIED" if prof else False,
        },
    }


@router.post("/admin/posts/{post_id}/approve", summary="[ADMIN] Approve and publish a post")
def admin_approve_post(
    post_id: str,
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")

    now = datetime.now(timezone.utc)
    post.status = "PUBLISHED"
    post.reviewed_by = admin.id
    post.reviewed_at = now
    post.published_at = now

    _notify(db, post.author_id,
            "🎉 Post Published",
            f"Your post '{post.title}' has been approved and is now live.",
            ntype="success", related_type="post", related_id=post.id)
    _audit(db, admin.id, "POST_APPROVED", "post", post.id, {"title": post.title})

    db.commit()
    return {"success": True, "message": "Post approved and published."}


@router.post("/admin/posts/{post_id}/reject", summary="[ADMIN] Reject a post")
def admin_reject_post(
    post_id: str,
    reason: str = Form(...),
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")

    post.status = "REJECTED"
    post.review_message = reason
    post.reviewed_by = admin.id
    post.reviewed_at = datetime.now(timezone.utc)

    _notify(db, post.author_id,
            "Post Requires Changes",
            f"Your post '{post.title}' was not approved. Reason: {reason}",
            ntype="warning", related_type="post", related_id=post.id)
    _audit(db, admin.id, "POST_REJECTED", "post", post.id, {"reason": reason})

    db.commit()
    return {"success": True, "message": "Post rejected."}


@router.post("/admin/posts/{post_id}/request-changes", summary="[ADMIN] Request post changes")
def admin_request_post_changes(
    post_id: str,
    message: str = Form(...),
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")

    post.status = "CHANGES_REQUESTED"
    post.review_message = message
    post.reviewed_by = admin.id
    post.reviewed_at = datetime.now(timezone.utc)

    _notify(db, post.author_id,
            "Post Changes Requested",
            f"Your post '{post.title}' requires changes: {message}",
            ntype="action_required", related_type="post", related_id=post.id)
    _audit(db, admin.id, "POST_CHANGES_REQUESTED", "post", post.id, {"message": message})

    db.commit()
    return {"success": True, "message": "Changes requested."}


# ─────────────────────────────────────────────────────────────────────────────
# 6. DOCTOR PROFILES (Public)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/doctors", summary="Public list of verified doctors")
def list_verified_doctors(
    search: Optional[str] = Query(None),
    specialization: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    q = db.query(DoctorProfile).filter(DoctorProfile.verification_status == "VERIFIED")
    if specialization:
        q = q.filter(DoctorProfile.specialization.ilike(f"%{specialization}%"))
    if search:
        s = f"%{search.lower()}%"
        q = q.filter(
            (DoctorProfile.specialization.ilike(s)) |
            (DoctorProfile.professional_bio.ilike(s))
        )

    total = q.count()
    profiles = q.order_by(DoctorProfile.verified_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    result = []
    for prof in profiles:
        user = db.query(User).filter(User.id == prof.user_id).first()
        published_count = db.query(Post).filter(
            Post.author_id == prof.user_id, Post.status == "PUBLISHED"
        ).count()
        result.append({
            "id": prof.user_id,
            "name": user.full_name if user else "Dr. Unknown",
            "specialization": prof.specialization,
            "medical_degree": prof.medical_degree,
            "years_of_experience": prof.years_of_experience,
            "organization": prof.organization,
            "professional_bio": prof.professional_bio,
            "languages": prof.languages or [],
            "areas_of_practice": prof.areas_of_practice or [],
            "verified": True,
            "published_posts": published_count,
            "verified_at": prof.verified_at.isoformat() if prof.verified_at else None,
        })

    return {"total": total, "page": page, "per_page": per_page, "doctors": result}


@router.get("/doctors/{user_id}", summary="Public doctor profile")
def get_doctor_profile(user_id: str, db: Session = Depends(get_db)):
    prof = db.query(DoctorProfile).filter(
        DoctorProfile.user_id == user_id,
        DoctorProfile.verification_status == "VERIFIED"
    ).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")

    user = db.query(User).filter(User.id == user_id).first()
    posts = db.query(Post).filter(
        Post.author_id == user_id, Post.status == "PUBLISHED"
    ).order_by(Post.published_at.desc()).limit(6).all()

    return {
        "id": user_id,
        "name": user.full_name if user else "Dr. Unknown",
        "specialization": prof.specialization,
        "medical_degree": prof.medical_degree,
        "years_of_experience": prof.years_of_experience,
        "organization": prof.organization,
        "professional_bio": prof.professional_bio,
        "languages": prof.languages or [],
        "areas_of_practice": prof.areas_of_practice or [],
        "verified": True,
        "verified_at": prof.verified_at.isoformat() if prof.verified_at else None,
        "published_posts": [
            {
                "id": p.id, "title": p.title, "category": p.category,
                "published_at": p.published_at.isoformat() if p.published_at else None,
            }
            for p in posts
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 7. NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/notifications", summary="Get current user's notifications")
def get_notifications(
    unread_only: bool = Query(False),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    q = db.query(UserNotification).filter(UserNotification.user_id == current_user.id)
    if unread_only:
        q = q.filter(UserNotification.is_read == False)  # noqa
    notifs = q.order_by(UserNotification.created_at.desc()).limit(50).all()

    return {
        "notifications": [
            {
                "id": n.id, "title": n.title, "message": n.message,
                "type": n.notification_type, "is_read": n.is_read,
                "related_type": n.related_type, "related_id": n.related_id,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifs
        ],
        "unread_count": db.query(UserNotification).filter(
            UserNotification.user_id == current_user.id,
            UserNotification.is_read == False  # noqa
        ).count()
    }


@router.post("/notifications/{notif_id}/read", summary="Mark notification as read")
def mark_notification_read(
    notif_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    n = db.query(UserNotification).filter(
        UserNotification.id == notif_id,
        UserNotification.user_id == current_user.id
    ).first()
    if n:
        n.is_read = True
        db.commit()
    return {"success": True}


# ─────────────────────────────────────────────────────────────────────────────
# 8. ADMIN OVERVIEW (extended)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/moderation-overview", summary="[ADMIN] Get moderation stats")
def admin_moderation_overview(
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    return {
        "pending_applications": db.query(DoctorApplication).filter(DoctorApplication.status == "PENDING").count(),
        "under_review_applications": db.query(DoctorApplication).filter(DoctorApplication.status == "UNDER_REVIEW").count(),
        "approved_doctors": db.query(DoctorProfile).filter(DoctorProfile.verification_status == "VERIFIED").count(),
        "rejected_applications": db.query(DoctorApplication).filter(DoctorApplication.status == "REJECTED").count(),
        "pending_posts": db.query(Post).filter(Post.status == "PENDING_REVIEW").count(),
        "published_posts": db.query(Post).filter(Post.status == "PUBLISHED").count(),
        "total_users": db.query(User).count(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 9. ADMIN — USER MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/users", summary="[ADMIN] List all users")
def admin_list_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role.upper())
    if search:
        s = f"%{search.lower()}%"
        q = q.filter((User.full_name.ilike(s)) | (User.email.ilike(s)))

    total = q.count()
    users = q.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "users": [
            {
                "id": u.id, "email": u.email, "full_name": u.full_name,
                "role": u.role, "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@router.get("/admin/audit-logs", summary="[ADMIN] Get audit logs")
def admin_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    admin: User = Depends(require_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).offset((page - 1) * per_page).limit(per_page).all()
    total = db.query(AuditLog).count()

    return {
        "total": total,
        "logs": [
            {
                "id": l.id, "action": l.action, "user_id": l.user_id,
                "resource_type": l.resource_type, "resource_id": l.resource_id,
                "details": l.details,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
            }
            for l in logs
        ]
    }
