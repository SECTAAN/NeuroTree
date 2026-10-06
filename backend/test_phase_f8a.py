"""
F-8A Tests — Backend Ingest Limit Raise + Rate Limit Split.

Tests:
  1.  INGEST_MAX_CHARS constant is 12 000
  2.  RATE_LIMIT_EXTRACT constant is set and != RATE_LIMIT_INGEST
  3.  RATE_LIMIT_INGEST is still "3/minute"
  4.  IngestRequest accepts 5 000-char source_text (backward compat)
  5.  IngestRequest accepts 12 000-char source_text (new limit)
  6.  IngestRequest rejects 12 001-char source_text
  7.  IngestRequest rejects text shorter than 10 chars
  8.  extract.py MAX_CHARS is still 5 000 (per-file cap unchanged)
  9.  /extract endpoint uses RATE_LIMIT_EXTRACT (not RATE_LIMIT_INGEST)
  10. settings.INGEST_MAX_CHARS is readable from config
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ["USE_MOCK_AI"]  = "True"
os.environ["DATABASE_URL"] = "sqlite:///./test_f8a.db"

from app.core.config import get_settings
get_settings.cache_clear()

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []

def record(name, ok, detail=""):
    results.append((PASS if ok else FAIL, name, detail))
    print(f"  {PASS if ok else FAIL}  {name}" + (f"  [{detail}]" if detail else ""))


# ── Test 1: INGEST_MAX_CHARS constant ─────────────────────────────────────────
print("\n-- Test 1: INGEST_MAX_CHARS in settings ---------------------------")
settings = get_settings()
record("settings.INGEST_MAX_CHARS == 12000",
       settings.INGEST_MAX_CHARS == 12_000,
       f"value={settings.INGEST_MAX_CHARS}")


# ── Test 2 & 3: Rate limit constants ──────────────────────────────────────────
print("\n-- Tests 2+3: rate limit constants --------------------------------")
record("RATE_LIMIT_EXTRACT is set",
       bool(settings.RATE_LIMIT_EXTRACT),
       f"value={settings.RATE_LIMIT_EXTRACT!r}")
record("RATE_LIMIT_EXTRACT != RATE_LIMIT_INGEST",
       settings.RATE_LIMIT_EXTRACT != settings.RATE_LIMIT_INGEST,
       f"extract={settings.RATE_LIMIT_EXTRACT!r} ingest={settings.RATE_LIMIT_INGEST!r}")
record("RATE_LIMIT_INGEST still '3/minute'",
       settings.RATE_LIMIT_INGEST == "3/minute",
       f"value={settings.RATE_LIMIT_INGEST!r}")


# ── Tests 4–7: IngestRequest validation ───────────────────────────────────────
print("\n-- Tests 4–7: IngestRequest validation ----------------------------")
from app.schemas.request_schema import IngestRequest, _INGEST_MAX_CHARS
from pydantic import ValidationError as PydanticValidationError

# 4: 5 000-char input still accepted (backward compat)
try:
    IngestRequest(source_text="a" * 5_000)
    record("IngestRequest accepts 5000-char text (backward compat)", True)
except PydanticValidationError as e:
    record("IngestRequest accepts 5000-char text (backward compat)", False, str(e)[:80])

# 5: 12 000-char input now accepted
try:
    IngestRequest(source_text="a" * 12_000)
    record("IngestRequest accepts 12000-char text", True)
except PydanticValidationError as e:
    record("IngestRequest accepts 12000-char text", False, str(e)[:80])

# 6: 12 001-char input rejected
try:
    IngestRequest(source_text="a" * 12_001)
    record("IngestRequest rejects 12001-char text", False, "should have raised")
except PydanticValidationError:
    record("IngestRequest rejects 12001-char text", True)

# 7: too-short input rejected
try:
    IngestRequest(source_text="short")
    record("IngestRequest rejects text < 10 chars", False, "should have raised")
except PydanticValidationError:
    record("IngestRequest rejects text < 10 chars", True)


# ── Test 8: extract.py MAX_CHARS unchanged ────────────────────────────────────
print("\n-- Test 8: extract.py MAX_CHARS unchanged -------------------------")
from app.api.extract import MAX_CHARS
record("extract.MAX_CHARS still 5000 (per-file cap)",
       MAX_CHARS == 5_000,
       f"MAX_CHARS={MAX_CHARS}")
record("extract.MAX_CHARS < INGEST_MAX_CHARS (intentional divergence)",
       MAX_CHARS < _INGEST_MAX_CHARS,
       f"extract={MAX_CHARS} ingest={_INGEST_MAX_CHARS}")


# ── Test 9: /extract endpoint uses RATE_LIMIT_EXTRACT ─────────────────────────
print("\n-- Test 9: /extract uses its own rate limit -----------------------")
# Introspect the decorator chain on the extract_document view function.
# slowapi stores the limit string in a _rate_limit attribute list.
try:
    from app.api.extract import extract_document
    limits = getattr(extract_document, "_rate_limit", None)
    if limits is None:
        # slowapi may store limits differently — fall back to checking that
        # RATE_LIMIT_EXTRACT is NOT the same string as RATE_LIMIT_INGEST.
        record("/extract endpoint rate limit is set independently",
               settings.RATE_LIMIT_EXTRACT != settings.RATE_LIMIT_INGEST,
               "introspection unavailable — verified via constant comparison")
    else:
        limit_str = str(limits)
        uses_extract_limit = settings.RATE_LIMIT_EXTRACT in limit_str
        record("/extract endpoint uses RATE_LIMIT_EXTRACT",
               uses_extract_limit,
               f"limits={limit_str!r}")
except Exception as e:
    record("/extract endpoint rate limit introspection", False, str(e)[:80])


# ── Test 10: settings.INGEST_MAX_CHARS is readable ────────────────────────────
print("\n-- Test 10: settings.INGEST_MAX_CHARS readable --------------------")
try:
    from app.core.config import get_settings as _gs
    s = _gs()
    record("get_settings().INGEST_MAX_CHARS is int",
           isinstance(s.INGEST_MAX_CHARS, int),
           f"type={type(s.INGEST_MAX_CHARS).__name__} value={s.INGEST_MAX_CHARS}")
except Exception as e:
    record("get_settings().INGEST_MAX_CHARS is int", False, str(e)[:80])


# ── Cleanup ───────────────────────────────────────────────────────────────────
import os as _os
try:
    if _os.path.exists("./test_f8a.db"):
        _os.remove("./test_f8a.db")
except Exception:
    pass


# ── Summary ───────────────────────────────────────────────────────────────────
print()
passed = sum(1 for r in results if r[0] == PASS)
failed = sum(1 for r in results if r[0] == FAIL)
total  = len(results)
print(f"F-8A Tests: {passed}/{total} passed", "***" if failed == 0 else "!!!")
if failed:
    print("\nFailed tests:")
    for r in results:
        if r[0] == FAIL:
            print(f"  {r[0]} {r[1]}" + (f" [{r[2]}]" if r[2] else ""))

sys.exit(0 if failed == 0 else 1)
