"""
KENKO-AI — OCR API Route

POST /ocr/extract
    Accept: multipart/form-data (field: "file")
    Returns: JSON with extracted text and per-line results

Flow:
    Request → Validate → Read bytes → Size check → OCR Service → Response
"""

import logging
from typing import Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, Header, status
from fastapi.responses import JSONResponse

from app.services import paddle_ocr as ocr_service
from app.services.google_vision_ocr import (
    extract_prescription_with_google_ai,
    get_configured_google_api_key,
)
from app.utils.image_validation import (
    validate_image_upload,
    validate_file_size,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR"])


@router.post(
    "/extract",
    summary="Extract text from a medical document image using Google AI Vision / Local OCR",
    response_description="Extracted text with per-line confidence scores",
)
async def extract_text(
    file: UploadFile = File(
        ...,
        description="Medical document image (JPEG, PNG, WEBP — max 10 MB)",
    ),
    x_google_api_key: Optional[str] = Header(None, alias="x-google-api-key"),
):
    """
    Upload a medical document image and receive extracted text via Google AI Vision or PaddleOCR.

    - **file**: Image file (JPEG, PNG, or WEBP), max 10 MB
    - Returns structured JSON with full text and per-line confidence scores
    - Temporary files are deleted immediately after processing
    """

    # ── Step 1: Validate file type & extension ──────────────────
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file was uploaded.",
        )

    validate_image_upload(file)  # raises 400 on bad type/extension

    # ── Step 2: Read file bytes ─────────────────────────────────
    try:
        image_bytes = await file.read()
    except Exception as exc:
        logger.error(f"Failed to read uploaded file: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read the uploaded file. Please try again.",
        )

    # ── Step 3: Validate file size (on actual bytes) ────────────
    validate_file_size(image_bytes)  # raises 413 if too large

    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    # ── Step 4: Run OCR (Google AI Vision or Local) ─────────────
    google_key = get_configured_google_api_key(x_google_api_key)
    if google_key:
        try:
            mime_type = file.content_type or "image/jpeg"
            g_result = extract_prescription_with_google_ai(
                image_bytes=image_bytes,
                mime_type=mime_type,
                api_key=google_key,
            )
            return JSONResponse(
                content={
                    "success": True,
                    "text": g_result.get("raw_text", ""),
                    "lines": g_result.get("lines", []),
                    "line_count": len(g_result.get("lines", [])),
                    "processing_time_ms": g_result.get("processing_time_ms", 0),
                    "engine": "google_gemini_vision",
                    "structured_fields": g_result.get("structured_fields"),
                }
            )
        except Exception as exc:
            logger.warning(f"Google AI OCR extraction failed ({exc}), falling back to local OCR...")

    try:
        result = ocr_service.process_image(image_bytes)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"Unexpected OCR error: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during OCR processing.",
        )

    # ── Step 5: Return result ───────────────────────────────────
    return JSONResponse(content=result)

