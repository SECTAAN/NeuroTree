"""
LangFlow Service — AI pipeline orchestrator.

Each public function has two paths:
  LIVE path  — calls the real LangFlow flow via langflow_client.run_flow().
               Active when settings.USE_MOCK_AI is False (default).
  MOCK path  — returns pre-built static data.
               Active when settings.USE_MOCK_AI is True (demo / offline guard).

All mock data is preserved intact so the application remains fully functional
without a LangFlow connection.
"""
from __future__ import annotations

import logging
import random

from app.core.config import get_settings
from app.schemas.langflow_schema import (
    LangFlowGraphOutput,
    LangFlowNodeChunk,
    LangFlowQuizOutput,
    LangFlowEvalOutput,
    NT01Output,
)

logger = logging.getLogger(__name__)

# ── Mock graph seed ────────────────────────────────────────────────────────────
# Represents the output of Flow A (chunking) + Flow B (graph extraction)
_MOCK_GRAPH = LangFlowGraphOutput(
    nodes=[
        LangFlowNodeChunk(
            id="node_01",
            title="Network Basics",
            content=(
                "Jaringan komputer adalah kumpulan perangkat yang saling terhubung "
                "untuk berbagi data dan sumber daya. Konsep dasarnya meliputi: "
                "topologi jaringan (star, ring, bus, mesh), media transmisi (kabel "
                "UTP, fiber optik, wireless), dan protokol komunikasi."
            ),
            key_concepts=["Topologi Jaringan", "Media Transmisi", "Protokol"],
        ),
        LangFlowNodeChunk(
            id="node_02",
            title="IP Addressing",
            content=(
                "IP Address adalah alamat logis yang diberikan kepada setiap perangkat "
                "dalam jaringan. IPv4 terdiri dari 32 bit (4 oktet), contoh: 192.168.1.1. "
                "Subnet mask menentukan bagian mana dari IP yang merupakan network ID "
                "dan host ID."
            ),
            key_concepts=["IPv4", "IPv6", "Subnet Mask", "CIDR"],
        ),
        LangFlowNodeChunk(
            id="node_03",
            title="Routing & Switching",
            content=(
                "Router adalah perangkat yang meneruskan paket data antar jaringan "
                "berbeda berdasarkan IP Address tujuan. Switch beroperasi di layer 2 "
                "(Data Link) dan meneruskan frame berdasarkan MAC Address."
            ),
            key_concepts=["Router", "Switch", "Routing Table", "MAC Address"],
        ),
        LangFlowNodeChunk(
            id="node_04",
            title="TCP/IP Model",
            content=(
                "Model TCP/IP mendefinisikan bagaimana data dikomunikasikan melalui "
                "internet. Terdiri dari 4 layer: Application, Transport (TCP/UDP), "
                "Internet (IP), dan Network Access."
            ),
            key_concepts=["TCP", "UDP", "HTTP", "DNS", "Layer Model"],
        ),
        LangFlowNodeChunk(
            id="node_05",
            title="Network Security Fundamentals",
            content=(
                "Keamanan jaringan melindungi integritas, kerahasiaan, dan ketersediaan "
                "data. Konsep utama: Firewall (filter traffic), VPN (enkripsi koneksi), "
                "dan IDS/IPS (deteksi intrusi)."
            ),
            key_concepts=["Firewall", "VPN", "Encryption", "IDS/IPS"],
        ),
    ],
    edges=[
        {"source_id": "node_01", "target_id": "node_02", "relationship": "prerequisite"},
        {"source_id": "node_01", "target_id": "node_03", "relationship": "prerequisite"},
        {"source_id": "node_02", "target_id": "node_04", "relationship": "prerequisite"},
        {"source_id": "node_03", "target_id": "node_04", "relationship": "prerequisite"},
        {"source_id": "node_04", "target_id": "node_05", "relationship": "prerequisite"},
    ],
)

# Quiz question bank keyed by node_id — Flow C mock (variety per node)
_MOCK_QUESTIONS: dict[str, list[str]] = {
    "node_01": [
        "Dengan kata-katamu sendiri, jelaskan apa itu topologi jaringan dan berikan satu contoh nyata!",
        "Apa perbedaan utama antara kabel UTP dan fiber optik sebagai media transmisi?",
        "Mengapa protokol komunikasi diperlukan dalam sebuah jaringan?",
    ],
    "node_02": [
        "Coba jelaskan apa fungsi IP Address dengan analogi kehidupan sehari-hari!",
        "Apa perbedaan antara IPv4 dan IPv6, dan mengapa IPv6 diperlukan?",
        "Bagaimana subnet mask membantu membagi jaringan menjadi sub-jaringan yang lebih kecil?",
    ],
    "node_03": [
        "Jelaskan perbedaan cara kerja Router dan Switch dalam meneruskan data!",
        "Mengapa sebuah Router membutuhkan Routing Table untuk bekerja?",
        "Di layer OSI mana Router dan Switch beroperasi? Jelaskan alasannya!",
    ],
    "node_04": [
        "Jelaskan perbedaan antara TCP dan UDP. Kapan kamu akan memilih UDP daripada TCP?",
        "Apa yang dimaksud dengan 'handshake' dalam protokol TCP?",
        "Bagaimana DNS membantu pengguna internet mengakses website tanpa menghafal IP Address?",
    ],
    "node_05": [
        "Jelaskan bagaimana Firewall melindungi jaringan dari akses yang tidak sah!",
        "Apa itu VPN dan mengapa perusahaan sering menggunakannya untuk karyawan remote?",
        "Jelaskan perbedaan antara IDS (Intrusion Detection System) dan IPS (Intrusion Prevention System)!",
    ],
}
_DEFAULT_QUESTIONS = [
    "Jelaskan konsep utama dari materi ini dengan kata-katamu sendiri!",
    "Berikan satu contoh nyata dari konsep yang baru kamu pelajari!",
    "Mengapa konsep ini penting dalam konteks yang lebih luas?",
]

# Feedback pool — Flow D mock
_MOCK_FEEDBACK_BY_RANGE = {
    "high": [
        "Jawaban yang sangat baik! Kamu menunjukkan pemahaman konseptual yang kuat.",
        "Luar biasa! Analogi yang kamu gunakan sangat tepat dan mudah dipahami.",
        "Jawaban sempurna. Kamu telah menguasai konsep inti materi ini.",
    ],
    "medium": [
        "Jawaban cukup baik. Pemahaman dasarnya sudah benar, coba tambahkan detail lebih spesifik.",
        "Bagus! Kamu sudah menangkap ide utamanya, meski penjelasannya bisa lebih mendalam.",
        "Hampir sempurna. Coba hubungkan konsep ini dengan contoh nyata untuk pemahaman lebih dalam.",
    ],
    "low": [
        "Jawaban menunjukkan pemahaman awal yang baik, namun masih perlu diperdalam.",
        "Ada beberapa konsep yang sudah tepat, tapi inti materi belum sepenuhnya tercakup.",
        "Coba baca kembali materinya dan fokus pada kata kunci utama sebelum mencoba lagi.",
    ],
}


# ── Public API ────────────────────────────────────────────────────────────────
# Each function checks USE_MOCK_AI first.
# The LIVE branch will be filled in Phase B / C / D.

async def ingest_and_build_graph(source_text: str) -> LangFlowGraphOutput:
    """
    NT-01: Chunk document and extract prerequisite Knowledge Graph.

    MOCK path (USE_MOCK_AI=True):
        Returns the hardcoded TCP/IP network graph — unchanged mock behavior.

    LIVE path (USE_MOCK_AI=False):
        1. Sends source_text to NT-01 via LangFlow API.
        2. Parses NT-01's JSON output into NT01Output.
        3. Maps NT-01 schema → internal LangFlowGraphOutput:
               NT01Chunk.chunk_id   → LangFlowNodeChunk.id
               NT01Chunk.title      → LangFlowNodeChunk.title
               NT01Chunk.description→ LangFlowNodeChunk.content
               (key_concepts left empty — NT-01 does not produce them;
                NT-02/NT-03 use the content directly)
               NT01Relationship.source/target_chunk_id → edge source_id/target_id
               NT01Relationship.relationship_type      → edge relationship
    """
    if get_settings().USE_MOCK_AI:
        return _MOCK_GRAPH

    # ── LIVE path ─────────────────────────────────────────────────────────────
    from app.services.langflow_client import run_flow, parse_json_output, LangFlowError

    settings = get_settings()

    try:
        raw_text = await run_flow(
            flow_id=settings.LANGFLOW_FLOW_NT01,
            input_value=source_text,
        )
    except LangFlowError as exc:
        logger.error("NT-01 call failed: %s", exc)
        raise

    raw_dict = parse_json_output(raw_text, settings.LANGFLOW_FLOW_NT01)
    nt01 = NT01Output.model_validate(raw_dict)

    logger.info(
        "NT-01 returned topic=%r  chunks=%d  relationships=%d",
        nt01.topic, len(nt01.chunks), len(nt01.relationships),
    )

    # ── Mapping: NT-01 → internal graph ───────────────────────────────────────
    nodes = [
        LangFlowNodeChunk(
            id=chunk.chunk_id,
            title=chunk.title,
            content=chunk.description,   # NT-01 field name differs
            key_concepts=[],             # populated by NT-02 in Phase C
        )
        for chunk in nt01.chunks
    ]

    edges = [
        {
            "source_id":    rel.source_chunk_id,
            "target_id":    rel.target_chunk_id,
            "relationship": rel.relationship_type,
        }
        for rel in nt01.relationships
    ]

    return LangFlowGraphOutput(nodes=nodes, edges=edges)


async def generate_quiz_question(node_id: str, key_concepts: list[str]) -> LangFlowQuizOutput:
    """
    NT-02: Generate a fresh active-recall question for a knowledge chunk.

    MOCK: picks randomly from a per-node question bank.
    LIVE: calls NT-02 via LangFlow API (Phase C).
    """
    if get_settings().USE_MOCK_AI:
        pool = _MOCK_QUESTIONS.get(node_id, _DEFAULT_QUESTIONS)
        return LangFlowQuizOutput(question=random.choice(pool))

    # ── LIVE (Phase C — not yet implemented) ──────────────────────────────────
    pool = _MOCK_QUESTIONS.get(node_id, _DEFAULT_QUESTIONS)
    return LangFlowQuizOutput(question=random.choice(pool))


async def evaluate_answer(
    node_title: str,
    key_concepts: list[str],
    user_answer: str,
) -> LangFlowEvalOutput:
    """
    NT-03: Evaluate the user's essay answer and return mastery score + feedback.

    MOCK: scores by word count to simulate AI grading.
    LIVE: calls NT-03 via LangFlow API (Phase C).

    Option A confirmed: NT-03's mastery_score is stored directly as the node's
    mastery (not fed into calculate_progressive_mastery).
    """
    if get_settings().USE_MOCK_AI:
        return _mock_evaluate(user_answer)

    # ── LIVE (Phase C — not yet implemented) ──────────────────────────────────
    return _mock_evaluate(user_answer)


# ── Mock helpers (shared between MOCK path and LIVE placeholder) ──────────────

def _mock_evaluate(user_answer: str) -> LangFlowEvalOutput:
    word_count = len(user_answer.split())
    if word_count >= 20:
        score    = random.randint(75, 95)
        feedback = random.choice(_MOCK_FEEDBACK_BY_RANGE["high"])
    elif word_count >= 8:
        score    = random.randint(45, 74)
        feedback = random.choice(_MOCK_FEEDBACK_BY_RANGE["medium"])
    else:
        score    = random.randint(10, 44)
        feedback = random.choice(_MOCK_FEEDBACK_BY_RANGE["low"])
    return LangFlowEvalOutput(score=score, feedback=feedback)
