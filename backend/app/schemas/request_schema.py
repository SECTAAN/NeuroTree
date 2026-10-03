from pydantic import BaseModel, Field, field_validator
import re


# ── Material ──────────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    """POST /api/v1/material/ingest — teks dokumen sumber."""
    source_text: str = Field(
        ...,
        min_length=10,
        max_length=5000,
        description="Isi dokumen/buku teks yang akan diproses AI.",
    )
    # F-2: optional tree identity — persisted to Session row
    tree_name: str = Field(
        default="",
        max_length=255,
        description="Nama learning tree (misal: Jaringan Komputer).",
    )
    learning_goal: str = Field(
        default="",
        max_length=1000,
        description="Tujuan belajar (misal: Persiapan CCNA).",
    )

    @field_validator("source_text")
    @classmethod
    def strip_and_block_scripts(cls, v: str) -> str:
        v = v.strip()
        # Blokir tag executable untuk mencegah prompt injection
        if re.search(r"<\s*(script|iframe|object|embed)\b", v, re.IGNORECASE):
            raise ValueError("Teks mengandung konten yang tidak diizinkan.")
        return v


# ── Quiz ──────────────────────────────────────────────────────────────────────

class GenerateQuizRequest(BaseModel):
    """POST /api/v1/quiz/generate — minta soal baru untuk sebuah node."""
    node_id: str = Field(..., min_length=1, max_length=64)


class EvaluateAnswerRequest(BaseModel):
    """POST /api/v1/quiz/evaluate — kirim jawaban user untuk dinilai AI."""
    node_id: str = Field(..., min_length=1, max_length=64)
    user_answer: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Jawaban esai user. Maksimal 1.000 karakter.",
    )

    @field_validator("user_answer")
    @classmethod
    def strip_answer(cls, v: str) -> str:
        return v.strip()
