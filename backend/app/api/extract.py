"""
Extract API — /api/v1/material/extract

Endpoint:
  POST /api/v1/material/extract
    Request : multipart/form-data  field "file" (PDF or DOCX)
    Response: { extracted_text, char_count, truncated }

Extracts plain text from an uploaded PDF or DOCX file and returns it ready
for the caller to pass to POST /api/v1/material/ingest.

Design constraints:
  - Output is capped at MAX_CHARS (5 000) to match IngestRequest.max_length.
  - Truncation is at the last sentence boundary before the cap.
  - Camera/image files (JPEG, PNG, WebP, ...) are handled client-side via
    Tesseract.js in NewTreeDialog.resolveSourceText() -- they are NOT sent to
    this endpoint. Sending an image here returns HTTP 415 with a clear message
    directing the caller to use the camera scanner tab instead.
  - This endpoint does NOT call NT-01 or touch the database; it is a pure
    extraction utility so the existing /ingest contract remains unchanged.
"""
import io
import re
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status

from app.api.dependencies import get_current_user_id
from app.core.security import limiter
from app.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Material & Graph"])
settings = get_settings()

# ── Constants ─────────────────────────────────────────────────────────────────

MAX_CHARS         = 5_000          # per-file extraction cap (intentionally lower than IngestRequest.max_length)
SUPPORTED_MIMES   = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
SUPPORTED_EXTS    = {".pdf", ".docx"}

# Image extensions that users might accidentally upload to /extract.
# These are handled client-side by Tesseract.js — return a clear redirect message.
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".heic"}


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/material/extract", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_EXTRACT)   # F-8A: own limit — kept separate from RATE_LIMIT_INGEST
async def extract_document(
    request: Request,                          # required by slowapi
    file: UploadFile = File(...),
    session_id: str = Depends(get_current_user_id),
):
    """
    Extract plain text from a PDF or DOCX upload.

    Returns JSON:
        {
          "extracted_text": "<plain text, max 5 000 chars>",
          "char_count":     <int — length of extracted_text>,
          "truncated":      <bool — True if original was longer than MAX_CHARS>
        }
    """
    # ── Format guard ──────────────────────────────────────────────────────────
    ext = _file_extension(file.filename)
    # Image files: return a specific message directing to the camera scanner
    if ext in IMAGE_EXTS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Format gambar '{ext}' tidak dapat diekstrak di sini. "
                "Gunakan tab 'Camera / Scan' di dialog New Tree — "
                "OCR dilakukan langsung di browser menggunakan Tesseract.js."
            ),
        )
    if ext not in SUPPORTED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Format tidak didukung: '{ext}'. Gunakan PDF atau DOCX.",
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File kosong atau tidak dapat dibaca.",
        )

    # ── Extract ───────────────────────────────────────────────────────────────
    try:
        if ext == ".pdf":
            full_text = _extract_pdf(raw_bytes)
        else:  # .docx
            full_text = _extract_docx(raw_bytes)
    except Exception as exc:
        logger.warning("Document extraction failed for %r: %s", file.filename, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Gagal membaca isi dokumen. Pastikan file tidak terenkripsi atau rusak.",
        )

    if not full_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tidak ada teks yang dapat diekstrak dari dokumen ini.",
        )

    # ── Truncate ──────────────────────────────────────────────────────────────
    truncated    = len(full_text) > MAX_CHARS
    final_text   = _truncate(full_text, MAX_CHARS) if truncated else full_text

    logger.info(
        "extract: file=%r  ext=%s  original=%d  final=%d  truncated=%s",
        file.filename, ext, len(full_text), len(final_text), truncated,
    )

    return {
        "extracted_text": final_text,
        "char_count":     len(final_text),
        "truncated":      truncated,
    }


# ── PDF extractor ─────────────────────────────────────────────────────────────

def _extract_pdf(raw: bytes) -> str:
    """
    Extract all text from a PDF using pypdf.
    Pages are joined with a double-newline separator.
    """
    from pypdf import PdfReader

    reader  = PdfReader(io.BytesIO(raw))
    pages   = []
    for page in reader.pages:
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            pages.append(text)

    return "\n\n".join(pages)


# ── DOCX extractor ────────────────────────────────────────────────────────────

def _extract_docx(raw: bytes) -> str:
    """
    Extract all paragraph text from a DOCX using python-docx.
    Empty paragraphs (section breaks, blank lines) are collapsed.
    """
    from docx import Document

    doc        = Document(io.BytesIO(raw))
    paragraphs = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            paragraphs.append(text)

    return "\n\n".join(paragraphs)


# ── Truncation helper ─────────────────────────────────────────────────────────

def _truncate(text: str, limit: int) -> str:
    """
    Truncate to at most `limit` characters, preferring a sentence boundary.
    Sentence boundaries: '. ', '? ', '! ', '.\n', '?\n', '!\n'
    Falls back to a word boundary, then a hard cut.
    """
    if len(text) <= limit:
        return text

    window = text[:limit]

    # Try last sentence boundary within the window
    match = None
    for pattern in (r"[.?!][\s]", r"[.?!]$"):
        for m in re.finditer(pattern, window):
            match = m  # keep last match
    if match:
        return window[: match.end()].rstrip()

    # Fallback: last whitespace (word boundary)
    last_space = window.rfind(" ")
    if last_space > limit // 2:
        return window[:last_space].rstrip()

    # Hard cut
    return window.rstrip()


# ── Filename helper ────────────────────────────────────────────────────────────

def _file_extension(filename: str | None) -> str:
    if not filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
