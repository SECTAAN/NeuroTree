"""
LangFlow Service — AI pipeline orchestrator.

Milestone 2: Returns static MOCK DATA that mirrors the shape of real LangFlow
             responses.  Every function is clearly marked # MOCK so they can
             be replaced one-by-one in Milestone 5 with real httpx calls.

Mock data simulates a "Computer Networking" document being processed so the
demo circuit has meaningful nodes and edges out of the box.
"""
from __future__ import annotations

import random

from app.schemas.langflow_schema import (
    LangFlowGraphOutput,
    LangFlowNodeChunk,
    LangFlowQuizOutput,
    LangFlowEvalOutput,
)

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


# ── Public API (will be replaced with real httpx calls in Milestone 5) ─────────

async def ingest_and_build_graph(source_text: str) -> LangFlowGraphOutput:  # MOCK
    """
    Flow A + Flow B: Chunk document and extract prerequisite graph.
    Returns the same mock graph regardless of input text.
    """
    # Milestone 5: replace body with httpx call to LangFlow webhook
    return _MOCK_GRAPH


async def generate_quiz_question(node_id: str, key_concepts: list[str]) -> LangFlowQuizOutput:  # MOCK
    """
    Flow C: Generate a fresh quiz question for a given node.
    Uses random.choice to vary the question each call (simulates LLM temperature).
    """
    # Milestone 5: replace body with httpx call to LangFlow webhook
    pool = _MOCK_QUESTIONS.get(node_id, _DEFAULT_QUESTIONS)
    return LangFlowQuizOutput(question=random.choice(pool))


async def evaluate_answer(
    node_title: str,
    key_concepts: list[str],
    user_answer: str,
) -> LangFlowEvalOutput:  # MOCK
    """
    Flow D: Evaluate user's essay answer and return a score + feedback.
    Mock score is deterministic based on answer length to simulate AI grading.
    """
    # Milestone 5: replace body with httpx call to LangFlow webhook
    word_count = len(user_answer.split())
    if word_count >= 20:
        score = random.randint(75, 95)
        feedback = random.choice(_MOCK_FEEDBACK_BY_RANGE["high"])
    elif word_count >= 8:
        score = random.randint(45, 74)
        feedback = random.choice(_MOCK_FEEDBACK_BY_RANGE["medium"])
    else:
        score = random.randint(10, 44)
        feedback = random.choice(_MOCK_FEEDBACK_BY_RANGE["low"])

    return LangFlowEvalOutput(score=score, feedback=feedback)
