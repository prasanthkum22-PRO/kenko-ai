"""
KENKO-AI — Image validation utilities for OCR uploads.
Validates MIME type, file extension, and file size.
"""

import os
from typing import Tuple
from fastapi import UploadFile, HTTPException, status

# ── Allowed types ──────────────────────────────────────────────
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Max upload size (bytes) — default 10 MB
DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def get_max_size() -> int:
    """Read max allowed file size from environment (in MB), default 10 MB."""
    try:
        mb = float(os.getenv("OCR_MAX_FILE_SIZE_MB", "10"))
        return int(mb * 1024 * 1024)
    except (ValueError, TypeError):
        return DEFAULT_MAX_SIZE_BYTES


def validate_image_upload(file: UploadFile) -> Tuple[str, str]:
    """
    Validate an uploaded image file.

    Checks:
    - Content-type is an allowed image MIME type
    - File extension is allowed
    - (Size check is done after reading in the route, since
       UploadFile doesn't expose size upfront in FastAPI)

    Returns:
        Tuple of (content_type, file_extension)

    Raises:
        HTTPException 400 if validation fails.
    """
    content_type = (file.content_type or "").lower().strip()

    # ── MIME type check ──────────────────────────────────────
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type: '{content_type}'. "
                f"Allowed types: JPEG, PNG, WEBP."
            ),
        )

    # ── Extension check ──────────────────────────────────────
    filename = file.filename or ""
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file extension: '{ext}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
            ),
        )

    return content_type, ext


def validate_file_size(data: bytes) -> None:
    """
    Validate the actual byte size of the uploaded file content.

    Args:
        data: Raw bytes of the uploaded file.

    Raises:
        HTTPException 413 if the file exceeds the allowed size.
    """
    max_bytes = get_max_size()
    if len(data) > max_bytes:
        max_mb = max_bytes / (1024 * 1024)
        actual_mb = len(data) / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"File too large: {actual_mb:.1f} MB. "
                f"Maximum allowed size is {max_mb:.0f} MB."
            ),
        )
