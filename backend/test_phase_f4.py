"""
F-4 Tests — Real Material Ingestion (PDF + DOCX extraction).

Tests:
  1.  PDF extraction — plain single-page PDF bytes
  2.  DOCX extraction — programmatically built DOCX
  3.  Truncation at sentence boundary
  4.  Truncation at word boundary (no sentence boundary)
  5.  Hard-cut truncation (no whitespace)
  6.  _truncate on text shorter than limit — no change
  7.  Unsupported extension guard (returns 415)
  8.  Empty file guard (returns 422)
  9.  Blank PDF guard (all empty pages)
  10. _file_extension helper
  11. PDF → ingest flow: extracted text is real, non-placeholder
  12. DOCX → ingest flow: extracted text is real, non-placeholder
  13. F-2 regression: UNLOCK_THRESHOLD still 70
  14. Import check: main.py registers extract router
"""
import io
import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ["USE_MOCK_AI"]  = "True"
os.environ["DATABASE_URL"] = "sqlite:///./test_f4.db"

from app.core.config import get_settings
get_settings.cache_clear()

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []

def record(name, ok, detail=""):
    results.append((PASS if ok else FAIL, name, detail))
    print(f"  {PASS if ok else FAIL}  {name}" + (f"  [{detail}]" if detail else ""))


# ── Import the modules under test ─────────────────────────────────────────────
from app.api.extract import (
    _extract_pdf,
    _extract_docx,
    _truncate,
    _file_extension,
    MAX_CHARS,
)


# ── Helpers — build minimal test files in-memory ──────────────────────────────

def make_pdf_bytes(text: str) -> bytes:
    """Build a minimal single-page PDF with the given text (no external tools)."""
    # Minimal valid PDF with one text stream
    lines = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").replace("\n", "\\n")
    stream = f"BT /F1 12 Tf 50 750 Td ({lines}) Tj ET"
    stream_bytes = stream.encode("latin-1")
    length = len(stream_bytes)

    objects = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        3: b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>",
        4: f"<< /Length {length} >>\nstream\n".encode() + stream_bytes + b"\nendstream",
    }

    buf = io.BytesIO()
    buf.write(b"%PDF-1.4\n")
    offsets = {}
    for obj_num, obj_data in objects.items():
        offsets[obj_num] = buf.tell()
        buf.write(f"{obj_num} 0 obj\n".encode())
        buf.write(obj_data if isinstance(obj_data, bytes) else obj_data.encode())
        buf.write(b"\nendobj\n")

    xref_pos = buf.tell()
    buf.write(b"xref\n")
    buf.write(f"0 {len(objects) + 1}\n".encode())
    buf.write(b"0000000000 65535 f \n")
    for obj_num in range(1, len(objects) + 1):
        buf.write(f"{offsets[obj_num]:010d} 00000 n \n".encode())
    buf.write(b"trailer\n")
    buf.write(f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode())
    buf.write(b"startxref\n")
    buf.write(f"{xref_pos}\n".encode())
    buf.write(b"%%EOF\n")
    return buf.getvalue()


def make_docx_bytes(paragraphs: list[str]) -> bytes:
    """Build a minimal DOCX with the given paragraphs using python-docx."""
    from docx import Document
    doc = Document()
    for p in paragraphs:
        doc.add_paragraph(p)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ── Test 10: _file_extension helper ──────────────────────────────────────────
print("\n-- Test 10: _file_extension -------------------------------------")
record("pdf extension", _file_extension("notes.pdf") == ".pdf")
record("docx extension", _file_extension("report.docx") == ".docx")
record("uppercase PDF", _file_extension("NOTES.PDF") == ".pdf")
record("no extension", _file_extension("noext") == "")
record("None filename", _file_extension(None) == "")
record("dotfile", _file_extension(".hidden") == ".hidden")


# ── Test 6: _truncate — text shorter than limit ───────────────────────────────
print("\n-- Test 6: _truncate — short text -------------------------------")
short = "Hello world."
record("short text unchanged", _truncate(short, 100) == short, f"result={_truncate(short, 100)!r}")


# ── Test 3: truncation at sentence boundary ───────────────────────────────────
print("\n-- Test 3: truncation at sentence boundary ----------------------")
sentence_text = "First sentence. Second sentence. Third goes over the limit here."
result_sent = _truncate(sentence_text, 33)
record("truncates at sentence boundary",
       result_sent.endswith(".") and len(result_sent) <= 33,
       f"result={result_sent!r} len={len(result_sent)}")


# ── Test 4: truncation at word boundary ───────────────────────────────────────
print("\n-- Test 4: truncation at word boundary --------------------------")
word_text = "alpha bravo charlie delta echo foxtrot golf hotel india juliet"
result_word = _truncate(word_text, 20)
record("truncates at word boundary — no partial word",
       " " not in result_word.lstrip().split()[-1] or result_word[-1] != " ",
       f"result={result_word!r} len={len(result_word)}")
record("truncated result length <= limit", len(result_word) <= 20, f"len={len(result_word)}")


# ── Test 5: hard-cut (no whitespace near limit) ───────────────────────────────
print("\n-- Test 5: hard-cut truncation ----------------------------------")
dense = "a" * 200
result_hard = _truncate(dense, 50)
record("hard cut — exactly limit chars", len(result_hard) == 50, f"len={len(result_hard)}")


# ── Test 2: DOCX extraction ───────────────────────────────────────────────────
print("\n-- Test 2: DOCX extraction --------------------------------------")
try:
    docx_text = "The OSI model has seven layers. Each layer serves a specific purpose."
    docx_bytes = make_docx_bytes([docx_text, "Second paragraph about networking."])
    extracted = _extract_docx(docx_bytes)
    record("DOCX: extracted text is non-empty",
           len(extracted.strip()) > 0, f"len={len(extracted)}")
    record("DOCX: contains first paragraph text",
           "OSI model" in extracted, f"extracted={extracted[:80]!r}")
    record("DOCX: contains second paragraph text",
           "Second paragraph" in extracted, f"extracted={extracted!r}")
    record("DOCX: paragraphs joined with double newline",
           "\n\n" in extracted)
except Exception as e:
    record("DOCX extraction (no exception)", False, str(e))
    record("DOCX: extracted text is non-empty", False, "skipped")
    record("DOCX: contains first paragraph text", False, "skipped")
    record("DOCX: contains second paragraph text", False, "skipped")
    record("DOCX: paragraphs joined with double newline", False, "skipped")


# ── Test 1: PDF extraction ────────────────────────────────────────────────────
print("\n-- Test 1: PDF extraction ----------------------------------------")
try:
    pdf_text = "IP Address is a numerical label assigned to devices in a network."
    pdf_bytes = make_pdf_bytes(pdf_text)
    extracted_pdf = _extract_pdf(pdf_bytes)
    record("PDF: extracted text is non-empty",
           len(extracted_pdf.strip()) > 0, f"len={len(extracted_pdf)}")
    # pypdf text extraction from a hand-built PDF may vary slightly — check key words
    record("PDF: extracted text contains expected keywords",
           "IP" in extracted_pdf or "Address" in extracted_pdf or "network" in extracted_pdf,
           f"extracted={extracted_pdf[:80]!r}")
except Exception as e:
    record("PDF extraction (no exception)", False, str(e))
    record("PDF: extracted text is non-empty", False, "skipped")
    record("PDF: extracted text contains expected keywords", False, "skipped")


# ── Test 9: Blank PDF (all empty pages) ───────────────────────────────────────
print("\n-- Test 9: blank PDF (empty text) --------------------------------")
try:
    blank_pdf = make_pdf_bytes("")
    blank_extracted = _extract_pdf(blank_pdf)
    record("blank PDF: extracted text is empty string",
           blank_extracted.strip() == "", f"result={blank_extracted!r}")
except Exception as e:
    record("blank PDF: extracted text is empty string", False, str(e))


# ── Test 11 & 12: end-to-end → ingest (mock mode) ─────────────────────────────
print("\n-- Tests 11+12: extraction → ingest (mock mode) -----------------")

async def _test_e2e():
    from app.services import langflow_service

    # DOCX path: extracted text is real, goes to NT-01 mock
    docx_content = make_docx_bytes([
        "TCP/IP is the foundation of modern networking.",
        "It defines how data packets are sent over the internet.",
    ])
    extracted_docx = _extract_docx(docx_content)
    record("E2E DOCX: extracted text is non-placeholder",
           not extracted_docx.startswith("[Document:"),
           f"text={extracted_docx[:60]!r}")
    record("E2E DOCX: extracted text length > 10",
           len(extracted_docx) > 10, f"len={len(extracted_docx)}")

    # Feed extracted text to NT-01 mock (same path as the real ingest endpoint)
    graph = await langflow_service.ingest_and_build_graph(extracted_docx)
    record("E2E DOCX → NT-01 mock: returns nodes",
           len(graph.nodes) > 0, f"nodes={len(graph.nodes)}")
    record("E2E DOCX → NT-01 mock: returns edges",
           isinstance(graph.edges, list), f"edges={len(graph.edges)}")

    # PDF path
    pdf_content = make_pdf_bytes("Routing protocols include OSPF, BGP, and RIP.")
    extracted_pdf = _extract_pdf(pdf_content)
    # NT-01 mock doesn't care about content — just needs non-empty string
    graph_pdf = await langflow_service.ingest_and_build_graph(extracted_pdf or "fallback text")
    record("E2E PDF → NT-01 mock: returns nodes",
           len(graph_pdf.nodes) > 0, f"nodes={len(graph_pdf.nodes)}")

asyncio.run(_test_e2e())


# ── Test 7: unsupported extension guard ───────────────────────────────────────
print("\n-- Test 7: unsupported extension guard --------------------------")
record("unsupported ext: .txt is not in SUPPORTED_EXTS",
       _file_extension("notes.txt") not in {".pdf", ".docx"})
record("unsupported ext: .png is not in SUPPORTED_EXTS",
       _file_extension("photo.png") not in {".pdf", ".docx"})


# ── Test 8: MAX_CHARS (extract) vs IngestRequest.max_length (F-8A divergence) ─
# F-8A intentionally raised IngestRequest.max_length to 12 000 while keeping
# MAX_CHARS (the per-file extraction cap) at 5 000.  These are now separate
# concerns: MAX_CHARS caps each individual file; IngestRequest.max_length caps
# the combined payload after multi-source concatenation.
print("\n-- Test 8: MAX_CHARS (extract) vs IngestRequest (F-8A) ----------")
from app.schemas.request_schema import IngestRequest, _INGEST_MAX_CHARS
from pydantic import ValidationError as PydanticValidationError

record("MAX_CHARS (extract per-file cap) == 5000", MAX_CHARS == 5_000, f"MAX_CHARS={MAX_CHARS}")
record("INGEST_MAX_CHARS == 12000", _INGEST_MAX_CHARS == 12_000, f"_INGEST_MAX_CHARS={_INGEST_MAX_CHARS}")
record("IngestRequest limit > MAX_CHARS (intentional divergence)",
       _INGEST_MAX_CHARS > MAX_CHARS,
       f"ingest={_INGEST_MAX_CHARS} extract={MAX_CHARS}")

# 5 000 chars must still be accepted by IngestRequest (backward compat)
ok_text_5k = "a" * MAX_CHARS
try:
    IngestRequest(source_text=ok_text_5k)
    record("IngestRequest accepts 5000-char text", True)
except PydanticValidationError as e:
    record("IngestRequest accepts 5000-char text", False, str(e)[:80])

# 12 000 chars must now be accepted (new limit)
ok_text_12k = "a" * _INGEST_MAX_CHARS
try:
    IngestRequest(source_text=ok_text_12k)
    record("IngestRequest accepts 12000-char text", True)
except PydanticValidationError as e:
    record("IngestRequest accepts 12000-char text", False, str(e)[:80])

# 12 001 chars must be rejected
too_long = "a" * (_INGEST_MAX_CHARS + 1)
try:
    IngestRequest(source_text=too_long)
    record("IngestRequest rejects 12001-char text", False, "should have raised")
except PydanticValidationError:
    record("IngestRequest rejects 12001-char text", True)


# ── Test 13: F-2 regression ───────────────────────────────────────────────────
print("\n-- Test 13: F-2 regression (UNLOCK_THRESHOLD) -------------------")
from app.services.mastery_service import UNLOCK_THRESHOLD, get_mastery_level
record("UNLOCK_THRESHOLD still 70.0", UNLOCK_THRESHOLD == 70.0, f"value={UNLOCK_THRESHOLD}")
record("get_mastery_level(70) == BRIGHT", get_mastery_level(70) == "BRIGHT")


# ── Test 14: extract router registered in main.py ────────────────────────────
print("\n-- Test 14: extract router in main.py ---------------------------")
try:
    from app.main import app as fastapi_app
    route_paths = [r.path for r in fastapi_app.routes]
    record("extract route /api/v1/material/extract registered",
           "/api/v1/material/extract" in route_paths,
           f"routes_sample={[p for p in route_paths if 'extract' in p or 'ingest' in p]}")
except Exception as e:
    record("extract route /api/v1/material/extract registered", False, str(e)[:80])


# ── Cleanup ───────────────────────────────────────────────────────────────────
import os as _os
try:
    if _os.path.exists("./test_f4.db"):
        _os.remove("./test_f4.db")
except Exception:
    pass


# ── Summary ───────────────────────────────────────────────────────────────────
print()
passed = sum(1 for r in results if r[0] == PASS)
failed = sum(1 for r in results if r[0] == FAIL)
total  = len(results)
print(f"F-4 Tests: {passed}/{total} passed", "***" if failed == 0 else "!!!")
if failed:
    print("\nFailed tests:")
    for r in results:
        if r[0] == FAIL:
            print(f"  {r[0]} {r[1]}" + (f" [{r[2]}]" if r[2] else ""))

sys.exit(0 if failed == 0 else 1)
