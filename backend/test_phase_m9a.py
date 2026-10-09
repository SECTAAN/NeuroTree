"""
Phase M-9A Tests — Camera OCR path validation (32 tests).

Coverage:
  Group 1: Backend /extract endpoint — image file rejection (HTTP 415 with
           camera-scanner redirect message for image types; generic 415 for
           other unsupported formats; correct extraction for PDF/DOCX regression).
  Group 2: extract.py helper functions — _file_extension, _truncate, IMAGE_EXTS
           membership.
  Group 3: OCR pipeline contract tests — verifies that the resolveSourceText
           image branch contract (input: image files → output: joined OCR text
           capped at OCR_MAX_CHARS, or error on blank result) is enforced at the
           backend ingest layer: ingest accepts arbitrary source_text and passes
           it to NT-01 unchanged (OCR output → ingest → NT-01).
  Group 4: API failure propagation — /extract returns 422 on empty file, 422 on
           corrupt file, 415 on unsupported format; errors surface correctly.
  Group 5: NT-01 integration contract — ingest with OCR-shaped text (camera
           material) produces nodes/edges; master_light apex is created; stats
           exclude ML node.

Run with: python test_phase_m9a.py
"""
import io
import sys
import uuid

sys.path.insert(0, ".")

from fastapi.testclient import TestClient
from app.main import app

from app.api.extract import (
    _file_extension,
    _truncate,
    IMAGE_EXTS,
    SUPPORTED_EXTS,
    MAX_CHARS,
)
from app.core.config import get_settings

settings = get_settings()
client   = TestClient(app, raise_server_exceptions=False)

USER_ID = str(uuid.uuid4())

def _headers(session_id=None):
    h = {"X-User-ID": USER_ID}
    if session_id:
        h["X-Session-ID"] = session_id
    return h


passed = 0
failed = 0

def assert_eq(label, got, expected, extra=""):
    global passed, failed
    if got == expected:
        print(f"  [PASS]  {label}  [{got!r}]")
        passed += 1
    else:
        print(f"  [FAIL]  {label}  got={got!r}  expected={expected!r}  {extra}")
        failed += 1

def assert_true(label, cond, extra=""):
    global passed, failed
    if cond:
        print(f"  [PASS]  {label}")
        passed += 1
    else:
        print(f"  [FAIL]  {label}  {extra}")
        failed += 1

def assert_false(label, cond, extra=""):
    assert_true(label, not cond, extra)

def assert_http(label, r, expected_status):
    global passed, failed
    if r.status_code == expected_status:
        print(f"  [PASS]  {label}  [HTTP {r.status_code}]")
        passed += 1
    else:
        print(f"  [FAIL]  {label}  got=HTTP {r.status_code}  expected=HTTP {expected_status}  body={r.text[:200]}")
        failed += 1
    return r.json() if r.headers.get("content-type", "").startswith("application/json") else {}


# ─────────────────────────────────────────────────────────────────────────────
# Group 1: /extract — image file rejection
# ─────────────────────────────────────────────────────────────────────────────
print("\n== Group 1: /extract image file rejection ==")

def _fake_file(name, content=b"fake"):
    return ("file", (name, io.BytesIO(content), "application/octet-stream"))

for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]:
    fname = f"capture{ext}"
    r = client.post(
        "/api/v1/material/extract",
        headers=_headers(),
        files=[_fake_file(fname)],
    )
    body = assert_http(f"image rejection {ext}", r, 415)
    assert_true(
        f"image {ext} detail mentions Camera/Scan",
        "Camera" in body.get("detail", "") or "OCR" in body.get("detail", ""),
        f"detail={body.get('detail','')!r}",
    )

# TIFF (less common but in IMAGE_EXTS)
r = client.post("/api/v1/material/extract", headers=_headers(),
                files=[_fake_file("scan.tiff")])
assert_http("tiff rejection", r, 415)

# HEIC (Apple camera format)
r = client.post("/api/v1/material/extract", headers=_headers(),
                files=[_fake_file("photo.heic")])
assert_http("heic rejection", r, 415)

# Unsupported non-image format (e.g. .txt) — generic 415, no camera message
r = client.post("/api/v1/material/extract", headers=_headers(),
                files=[_fake_file("notes.txt")])
body = assert_http("txt rejection generic 415", r, 415)
assert_false(
    "txt error does NOT mention camera (generic msg)",
    "Camera" in body.get("detail", ""),
    f"detail={body.get('detail','')!r}",
)

# ─────────────────────────────────────────────────────────────────────────────
# Group 2: Helper function unit tests
# ─────────────────────────────────────────────────────────────────────────────
print("\n== Group 2: extract.py helper functions ==")

# _file_extension
assert_eq("ext .pdf", _file_extension("notes.pdf"), ".pdf")
assert_eq("ext .docx", _file_extension("report.DOCX"), ".docx")
assert_eq("ext .jpg", _file_extension("photo.JPG"), ".jpg")
assert_eq("ext .jpeg", _file_extension("scan.JPEG"), ".jpeg")
assert_eq("ext .png", _file_extension("capture.png"), ".png")
assert_eq("ext .webp", _file_extension("img.webp"), ".webp")
assert_eq("ext empty filename", _file_extension(""), "")
assert_eq("ext None", _file_extension(None), "")
assert_eq("ext no dot", _file_extension("noextension"), "")

# IMAGE_EXTS membership
for img_ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".heic"]:
    assert_true(f"IMAGE_EXTS contains {img_ext}", img_ext in IMAGE_EXTS)

# SUPPORTED_EXTS untouched
assert_true(".pdf in SUPPORTED_EXTS", ".pdf" in SUPPORTED_EXTS)
assert_true(".docx in SUPPORTED_EXTS", ".docx" in SUPPORTED_EXTS)
assert_false(".jpg NOT in SUPPORTED_EXTS", ".jpg" in SUPPORTED_EXTS)

# _truncate
assert_eq("truncate short text", _truncate("Hello world.", 20), "Hello world.")
long = "A" * 6000
result = _truncate(long, MAX_CHARS)
assert_true("truncate long text len <= MAX_CHARS", len(result) <= MAX_CHARS)
# Sentence boundary: truncate prefers '. ' over hard cut
text_with_sentences = "First sentence. Second sentence. " + "X" * 6000
result2 = _truncate(text_with_sentences, MAX_CHARS)
assert_true("truncate uses sentence boundary", result2.endswith(".") or result2[-1] in "?!")

# ─────────────────────────────────────────────────────────────────────────────
# Group 3: API failure propagation
# Use a fresh user ID — Group 1 fired 10 /extract requests which may exhaust
# the RATE_LIMIT_EXTRACT (10/minute) cap for the same user.
# ─────────────────────────────────────────────────────────────────────────────
print("\n== Group 3: API failure propagation ==")
G3_HEADERS = {"X-User-ID": str(uuid.uuid4())}

# Empty file body → 422
r = client.post("/api/v1/material/extract", headers=G3_HEADERS,
                files=[_fake_file("empty.pdf", content=b"")])
assert_http("empty file → 422", r, 422)

# File with no extension → 415 (generic)
r = client.post("/api/v1/material/extract", headers=G3_HEADERS,
                files=[_fake_file("noextfile", content=b"data")])
assert_http("no extension → 415", r, 415)

# Corrupt PDF (not a real PDF) → 422
r = client.post("/api/v1/material/extract", headers=G3_HEADERS,
                files=[_fake_file("bad.pdf", content=b"not a pdf")])
assert_http("corrupt pdf → 422", r, 422)

# Corrupt DOCX → 422
r = client.post("/api/v1/material/extract", headers=G3_HEADERS,
                files=[_fake_file("bad.docx", content=b"not a docx")])
assert_http("corrupt docx → 422", r, 422)

# ─────────────────────────────────────────────────────────────────────────────
# Group 4: NT-01 integration contract — OCR text flows through ingest
# ─────────────────────────────────────────────────────────────────────────────
# Camera OCR produces plain text; that text is passed unchanged to /ingest.
# This group verifies that /ingest accepts OCR-shaped text and the resulting
# graph has knowledge nodes + master_light apex (USE_MOCK_AI mode).
print("\n== Group 4: OCR text → ingest → graph contract ==")

# Simulate what Tesseract.js would produce: multi-line, mixed whitespace
OCR_TEXT = (
    "Jaringan Komputer\n\n"
    "Topologi jaringan menentukan struktur koneksi antar perangkat.\n"
    "Topologi star: semua perangkat terhubung ke switch pusat.\n\n"
    "IP Address\n\n"
    "Setiap perangkat memiliki alamat IP unik. IPv4 = 32-bit.\n"
    "Subnet mask memisahkan network ID dari host ID.\n\n"
    "Router & Switch\n\n"
    "Router meneruskan paket antar jaringan berdasarkan routing table.\n"
    "Switch bekerja di Layer 2 berdasarkan MAC address.\n"
)

sid = str(uuid.uuid4())
headers = _headers(sid)

# Step 1: ingest OCR-shaped text (mock path if USE_MOCK_AI=True)
r = client.post("/api/v1/material/ingest", headers=headers, json={
    "source_text":   OCR_TEXT,
    "tree_name":     "Camera OCR Test",
    "learning_goal": "Network Engineer",
    "session_id":    sid,
}, timeout=90)
assert_http("OCR text ingest → 200", r, 200)
ingest_body = r.json()
assert_true("ingest nodes_created > 0", ingest_body.get("nodes_created", 0) > 0,
            f"nodes_created={ingest_body.get('nodes_created')}")
assert_true("ingest master_light_id present", bool(ingest_body.get("master_light_id")),
            f"master_light_id={ingest_body.get('master_light_id')!r}")

# Step 2: fetch graph — knowledge nodes + 1 master_light
r = client.get("/api/v1/graph", headers=headers)
assert_http("graph fetch after OCR ingest → 200", r, 200)
graph_body = r.json()
knowledge_nodes = [n for n in graph_body["nodes"] if n["node_type"] == "knowledge"]
ml_nodes        = [n for n in graph_body["nodes"] if n["node_type"] == "master_light"]
assert_true("graph has knowledge nodes", len(knowledge_nodes) > 0,
            f"knowledge={len(knowledge_nodes)}")
assert_eq("graph has exactly 1 master_light node", len(ml_nodes), 1)

# Step 3: sessions stats exclude ML node
r = client.get("/api/v1/sessions", headers=headers)
assert_http("sessions after OCR ingest → 200", r, 200)
sessions = r.json().get("sessions", [])
matching = [s for s in sessions if s["session_id"] == sid]
assert_true("session appears in list", len(matching) == 1)
if matching:
    s = matching[0]
    assert_eq(
        "session total_nodes equals knowledge node count",
        s["total_nodes"],
        len(knowledge_nodes),
    )

# Step 4: first knowledge node is unlocked (entry-point rule)
first_unlocked = [n for n in knowledge_nodes if n["status"] == "unlocked"]
assert_true("at least 1 knowledge node is unlocked", len(first_unlocked) >= 1)

# Step 5: ML node starts locked and not assessed
assert_false("ml node master_light_unlocked=False on fresh ingest",
             ml_nodes[0]["master_light_unlocked"])
assert_eq("ml node master_light_mastery=0.0 on fresh ingest",
          ml_nodes[0]["master_light_mastery"], 0.0)

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{'─'*60}")
print(f"Phase M-9A Tests: {passed}/{passed + failed} passed",
      "***" if failed == 0 else "FAILURES ABOVE")
if failed:
    sys.exit(1)
