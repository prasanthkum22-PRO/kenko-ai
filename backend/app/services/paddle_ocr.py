"""
KENKO-AI — High-Precision OCR Service

Multi-engine OCR pipeline:
1. Primary: EasyOCR (PyTorch-based CRAFT + CRNN engine - highly robust across Windows/Linux)
2. Secondary Fallback: PaddleOCR
3. Returns per-line extracted text, confidence scores, bounding boxes, and full text.
"""

import os
import sys
import time
import tempfile
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Lazy singleton
_easyocr_reader = None
_paddle_ocr_instance = None


def _get_easyocr_reader():
    """Lazy initialize EasyOCR reader."""
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr  # noqa: PLC0415
            logger.info("Initializing EasyOCR reader (en, CPU)...")
            _easyocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            logger.info("EasyOCR initialized successfully.")
        except Exception as exc:
            logger.warning(f"EasyOCR init failed: {exc}")
            _easyocr_reader = None
    return _easyocr_reader


def _get_paddle_ocr():
    """Lazy initialize PaddleOCR instance."""
    global _paddle_ocr_instance
    if _paddle_ocr_instance is None:
        try:
            from paddleocr import PaddleOCR  # noqa: PLC0415
            lang = os.getenv("OCR_LANG", "en")
            _paddle_ocr_instance = PaddleOCR(use_textline_orientation=True, lang=lang)
        except Exception as exc:
            logger.warning(f"PaddleOCR init failed: {exc}")
            _paddle_ocr_instance = None
    return _paddle_ocr_instance


def process_image(image_bytes: bytes) -> Dict[str, Any]:
    """
    Run high-precision OCR on image bytes.
    Returns:
        dict with keys:
            - success (bool)
            - text (str): Full extracted text joined by newlines.
            - lines (list[dict]): Per-line results with text & confidence & bbox.
            - line_count (int)
            - processing_time_ms (int)
            - engine (str)
    """
    start_time = time.perf_counter()
    tmp_path: Optional[Path] = None

    try:
        suffix = ".jpg"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = Path(tmp.name)

        lines: List[Dict[str, Any]] = []
        engine_used = "easyocr"

        # ── 1. Try EasyOCR ──────────────────────────────────────
        reader = _get_easyocr_reader()
        if reader is not None:
            try:
                results = reader.readtext(str(tmp_path))
                for bbox, text, score in results:
                    clean_text = str(text).strip()
                    if clean_text:
                        conf = float(score) if score is not None else 0.9
                        # Convert bbox numpy points to list of [x, y]
                        bbox_list = []
                        if hasattr(bbox, "tolist"):
                            bbox_list = bbox.tolist()
                        elif isinstance(bbox, (list, tuple)):
                            bbox_list = [[float(p[0]), float(p[1])] for p in bbox if len(p) >= 2]
                        lines.append({
                            "text": clean_text,
                            "confidence": round(conf, 4),
                            "box": bbox_list,
                        })
            except Exception as e:
                logger.warning(f"EasyOCR run error: {e}, falling back...")
                lines = []

        # ── 2. Fallback to PaddleOCR if EasyOCR had no results ──
        if not lines:
            paddle_inst = _get_paddle_ocr()
            if paddle_inst is not None:
                try:
                    engine_used = "paddleocr"
                    raw_result = paddle_inst.predict(str(tmp_path))
                    for page in raw_result:
                        if isinstance(page, dict):
                            texts = page.get("rec_texts") or page.get("rec_text") or []
                            scores = page.get("rec_scores") or page.get("rec_score") or []
                            for t, s in zip(texts, scores):
                                t_str = str(t).strip()
                                if t_str:
                                    lines.append({"text": t_str, "confidence": round(float(s), 4)})
                except Exception as e:
                    logger.warning(f"PaddleOCR run error: {e}")

        full_text = "\n".join(line["text"] for line in lines)
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        return {
            "success": True,
            "text": full_text,
            "lines": lines,
            "line_count": len(lines),
            "processing_time_ms": elapsed_ms,
            "engine": engine_used,
        }

    except Exception as exc:
        logger.error(f"OCR processing error: {exc}")
        raise RuntimeError(f"OCR processing failed: {exc}") from exc

    finally:
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass
