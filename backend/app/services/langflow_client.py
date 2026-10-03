"""
LangFlow HTTP Client — shared low-level transport layer.

All five NT flows are reached through the same LangFlow REST API:
    POST {LANGFLOW_BASE_URL}/api/v1/run/{flow_id}

This module provides a single async function `run_flow()` that:
  1. Builds the correct request payload.
  2. Attaches the API key header (if set).
  3. Posts to LangFlow with a configurable timeout.
  4. Retries once on transient network errors (not on 4xx/5xx).
  5. Extracts the text output from LangFlow's response envelope.
  6. Raises LangFlowError on any failure so callers get a clean exception.

LangFlow response envelope shape (run endpoint):
{
  "outputs": [
    {
      "outputs": [
        {
          "results": {
            "message": {
              "text": "<the actual output string>"
            }
          }
        }
      ]
    }
  ]
}

Usage:
    from app.services.langflow_client import run_flow
    text = await run_flow(flow_id, input_value="hello")
"""
from __future__ import annotations

import json
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
_TIMEOUT_SECONDS = 60.0   # LangFlow LLM calls can be slow
_MAX_RETRIES     = 1       # retry once on network-level failure only


# ── Public exception ──────────────────────────────────────────────────────────

class LangFlowError(Exception):
    """Raised when LangFlow returns an error or an unexpected response shape."""
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


# ── Core function ─────────────────────────────────────────────────────────────

async def run_flow(
    flow_id: str,
    input_value: str,
    *,
    input_type: str = "chat",
    output_type: str = "chat",
    session_id: str | None = None,
) -> str:
    """
    Run a LangFlow flow and return the plain-text output string.

    Args:
        flow_id:      UUID of the LangFlow flow to run.
        input_value:  The string sent to the flow's ChatInput component.
        input_type:   LangFlow input type (default: "chat").
        output_type:  LangFlow output type (default: "chat").
        session_id:   Optional session ID forwarded to LangFlow for memory.

    Returns:
        The text extracted from LangFlow's response envelope.

    Raises:
        LangFlowError: on HTTP error, timeout, or malformed response.
    """
    settings = get_settings()
    url      = f"{settings.LANGFLOW_BASE_URL}/api/v1/run/{flow_id}"

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if settings.LANGFLOW_API_KEY:
        headers["x-api-key"] = settings.LANGFLOW_API_KEY

    payload: dict = {
        "input_value":  input_value,
        "input_type":   input_type,
        "output_type":  output_type,
    }
    if session_id:
        payload["session_id"] = session_id

    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.post(url, headers=headers, json=payload)

            if response.status_code >= 400:
                raise LangFlowError(
                    f"LangFlow returned HTTP {response.status_code}: {response.text[:200]}",
                    status_code=response.status_code,
                )

            return _extract_text(response.json(), flow_id)

        except LangFlowError:
            raise  # don't retry on HTTP errors — they are deterministic

        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            last_exc = exc
            logger.warning(
                "LangFlow transient error (attempt %d/%d) for flow %s: %s",
                attempt + 1, _MAX_RETRIES + 1, flow_id, exc,
            )
            if attempt < _MAX_RETRIES:
                continue  # retry

    # Exhausted retries
    raise LangFlowError(
        f"LangFlow unreachable after {_MAX_RETRIES + 1} attempts: {last_exc}"
    )


# ── Response envelope extractor ───────────────────────────────────────────────

def _extract_text(body: dict, flow_id: str) -> str:
    """
    Navigates LangFlow's nested response envelope to extract the output text.

    Expected path:
        body["outputs"][0]["outputs"][0]["results"]["message"]["text"]

    Falls back to the top-level "message" key if the nested path is absent
    (some LangFlow versions vary slightly).
    """
    try:
        text = (
            body["outputs"][0]
                ["outputs"][0]
                ["results"]["message"]["text"]
        )
        if not isinstance(text, str):
            raise TypeError(f"Expected str, got {type(text)}")
        return text

    except (KeyError, IndexError, TypeError) as exc:
        # Log the full body at DEBUG level for diagnosis, not at WARNING
        # (the body may contain sensitive prompt content)
        logger.debug("Unexpected LangFlow envelope for flow %s: %s", flow_id, body)
        raise LangFlowError(
            f"Unexpected LangFlow response shape for flow {flow_id}: {exc}"
        ) from exc


# ── JSON helper ───────────────────────────────────────────────────────────────

def parse_json_output(text: str, flow_id: str) -> dict:
    """
    Parse a JSON string returned by LangFlow.

    LangFlow sometimes wraps JSON in markdown fences (```json ... ```).
    This helper strips them before parsing.

    Raises:
        LangFlowError: if the text cannot be parsed as JSON.
    """
    cleaned = text.strip()

    # Strip optional markdown code fence
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        # Drop first line (```json or ```) and last line (```)
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        cleaned = "\n".join(inner).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.warning(
            "LangFlow flow %s returned non-JSON output: %s…",
            flow_id, cleaned[:120],
        )
        raise LangFlowError(
            f"LangFlow flow {flow_id} returned invalid JSON: {exc}"
        ) from exc
