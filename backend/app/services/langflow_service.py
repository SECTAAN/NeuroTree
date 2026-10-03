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
    NT04Output,
    NT05Output,
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


async def generate_quiz_question(
    node_id: str,
    key_concepts: list[str],
    node_content: str = "",
    node_title: str = "",
) -> LangFlowQuizOutput:
    """
    NT-02: Generate a fresh active-recall question for a knowledge chunk.

    MOCK path (USE_MOCK_AI=True):
        Picks randomly from a per-node question bank; expected_answer is empty.

    LIVE path (USE_MOCK_AI=False):
        Sends the full chunk JSON to NT-02 and returns the structured question
        including expected_answer (stored server-side, never sent to frontend).
    """
    if get_settings().USE_MOCK_AI:
        pool = _MOCK_QUESTIONS.get(node_id, _DEFAULT_QUESTIONS)
        return LangFlowQuizOutput(question=random.choice(pool), expected_answer="")

    # ── LIVE path ─────────────────────────────────────────────────────────────
    from app.services.langflow_client import run_flow, parse_json_output, LangFlowError
    from app.schemas.langflow_schema import NT02Output

    settings = get_settings()

    # Build the chunk payload NT-02 expects
    import json as _json
    chunk_payload = _json.dumps(
        {
            "chunk_id":    node_id,
            "title":       node_title,
            "description": node_content,
            "difficulty":  1,
            "prerequisites": [],
        },
        ensure_ascii=False,
    )

    try:
        raw_text = await run_flow(
            flow_id=settings.LANGFLOW_FLOW_NT02,
            input_value=chunk_payload,
        )
    except LangFlowError as exc:
        logger.error("NT-02 call failed: %s", exc)
        raise

    raw_dict = parse_json_output(raw_text, settings.LANGFLOW_FLOW_NT02)
    nt02 = NT02Output.model_validate(raw_dict)

    logger.info(
        "NT-02 returned chunk_id=%r  question_type=%r",
        nt02.chunk_id, nt02.question_type,
    )

    return LangFlowQuizOutput(
        question=nt02.question,
        expected_answer=nt02.expected_answer,
        key_concepts=nt02.key_concepts,
    )


async def evaluate_answer(
    node_title: str,
    key_concepts: list[str],
    user_answer: str,
    node_content: str = "",
    previous_mastery: float = 0.0,
    expected_answer: str = "",
) -> LangFlowEvalOutput:
    """
    NT-03: Evaluate the user's essay answer and return mastery score + feedback.

    MOCK path (USE_MOCK_AI=True):
        Scores by word count; returns mastery as accumulated progressive score.

    LIVE path (USE_MOCK_AI=False):
        Sends {question, expected_answer, chunk_content, previous_mastery,
        user_answer} to NT-03 and returns its mastery_score directly.

    Option A: NT-03's mastery_score is stored as-is in Node.mastery_score.
              calculate_progressive_mastery() is NOT called on this path.
    """
    if get_settings().USE_MOCK_AI:
        return _mock_evaluate(user_answer, previous_mastery)

    # ── LIVE path ─────────────────────────────────────────────────────────────
    from app.services.langflow_client import run_flow, parse_json_output, LangFlowError
    from app.schemas.langflow_schema import NT03Output

    settings = get_settings()

    import json as _json
    eval_payload = _json.dumps(
        {
            "question":         key_concepts[0] if key_concepts else node_title,
            "expected_answer":  expected_answer,
            "chunk_content":    node_content,
            "previous_mastery": previous_mastery,
            "user_answer":      user_answer,
        },
        ensure_ascii=False,
    )

    try:
        raw_text = await run_flow(
            flow_id=settings.LANGFLOW_FLOW_NT03,
            input_value=eval_payload,
        )
    except LangFlowError as exc:
        logger.error("NT-03 call failed: %s", exc)
        raise

    raw_dict = parse_json_output(raw_text, settings.LANGFLOW_FLOW_NT03)
    nt03 = NT03Output.model_validate(raw_dict)

    logger.info(
        "NT-03 returned mastery_score=%.1f  next_action=%r",
        nt03.mastery_score, nt03.next_action,
    )

    return LangFlowEvalOutput(
        score=nt03.mastery_score,
        feedback=nt03.feedback,
        missing_concepts=nt03.missing_concepts,
        next_action=nt03.next_action,
    )


async def get_adaptive_recommendation(
    mastered_nodes: list[dict],
    unlocked_nodes: list[dict],
    locked_nodes: list[dict],
    edges: list[dict],
) -> NT04Output:
    """
    NT-04: Analyse the user's full mastery profile and return the next best
    learning action.

    MOCK path (USE_MOCK_AI=True):
        Returns a deterministic recommendation pointing at the first unlocked node,
        or a fill_gap action when nothing is unlocked.

    LIVE path (USE_MOCK_AI=False):
        Sends the full knowledge-state JSON to NT-04 and parses its recommendation.

    Input shape sent to NT-04 (mirrors live test):
        {
          "mastered_nodes":  [{"id": ..., "title": ..., "mastery_score": ...}],
          "unlocked_nodes":  [...],
          "locked_nodes":    [...],
          "knowledge_graph": {"edges": [{"source": ..., "target": ...}]}
        }
    """
    if get_settings().USE_MOCK_AI:
        return _mock_adaptive_recommendation(mastered_nodes, unlocked_nodes, locked_nodes)

    # ── LIVE path ─────────────────────────────────────────────────────────────
    from app.services.langflow_client import run_flow, parse_json_output, LangFlowError

    settings = get_settings()

    import json as _json
    payload = _json.dumps(
        {
            "mastered_nodes":  mastered_nodes,
            "unlocked_nodes":  unlocked_nodes,
            "locked_nodes":    locked_nodes,
            "knowledge_graph": {"edges": edges},
        },
        ensure_ascii=False,
    )

    try:
        raw_text = await run_flow(
            flow_id=settings.LANGFLOW_FLOW_NT04,
            input_value=payload,
        )
    except LangFlowError as exc:
        logger.error("NT-04 call failed: %s", exc)
        raise

    raw_dict = parse_json_output(raw_text, settings.LANGFLOW_FLOW_NT04)
    nt04 = NT04Output.model_validate(raw_dict)

    logger.info(
        "NT-04 returned action=%r  target=%r  priority=%r",
        nt04.action, nt04.target_chunk_id, nt04.priority,
    )

    return nt04


# ── Mock helpers ──────────────────────────────────────────────────────────────

def _mock_adaptive_recommendation(
    mastered_nodes: list[dict],
    unlocked_nodes: list[dict],
    locked_nodes: list[dict],
) -> NT04Output:
    """
    Mock adaptive recommendation.
    - If there are unlocked nodes: recommend the first one.
    - If everything is mastered: return fill_gap pointing at the first locked node.
    - If nothing exists: return a generic review action.
    """
    from app.schemas.langflow_schema import NT04ProgressSummary

    total = len(mastered_nodes) + len(unlocked_nodes) + len(locked_nodes)
    mastered_count = len(mastered_nodes)
    pct = round(mastered_count / total * 100.0, 1) if total > 0 else 0.0
    progress = NT04ProgressSummary(
        total_chunks=total,
        mastered_chunks=mastered_count,
        completion_percentage=pct,
    )

    if unlocked_nodes:
        target = unlocked_nodes[0]
        return NT04Output(
            action="next_chunk",
            target_chunk_id=target["id"],
            target_chunk_title=target.get("title", ""),
            reason="Lanjutkan ke materi berikutnya yang sudah terbuka.",
            priority="high",
            suggested_review_chunks=[],
            progress_summary=progress,
        )
    if locked_nodes:
        target = locked_nodes[0]
        return NT04Output(
            action="fill_gap",
            target_chunk_id=target["id"],
            target_chunk_title=target.get("title", ""),
            reason="Selesaikan prasyarat untuk membuka materi ini.",
            priority="medium",
            suggested_review_chunks=[n["id"] for n in mastered_nodes[:2]],
            progress_summary=progress,
        )
    return NT04Output(
        action="review",
        target_chunk_id="",
        target_chunk_title="",
        reason="Semua materi sudah selesai! Review untuk memperdalam pemahaman.",
        priority="low",
        suggested_review_chunks=[n["id"] for n in mastered_nodes[:3]],
        progress_summary=progress,
    )


def _mock_evaluate(user_answer: str, previous_mastery: float = 0.0) -> LangFlowEvalOutput:
    """
    Mock evaluation: accumulates mastery using the progressive formula
    (previous_mastery + ai_score * 0.4) so mock behavior is consistent.
    """
    from app.services.mastery_service import calculate_progressive_mastery
    word_count = len(user_answer.split())
    if word_count >= 20:
        ai_score = random.randint(75, 95)
        feedback = random.choice(_MOCK_FEEDBACK_BY_RANGE["high"])
    elif word_count >= 8:
        ai_score = random.randint(45, 74)
        feedback = random.choice(_MOCK_FEEDBACK_BY_RANGE["medium"])
    else:
        ai_score = random.randint(10, 44)
        feedback = random.choice(_MOCK_FEEDBACK_BY_RANGE["low"])
    # Mock still uses progressive accumulation so smoke_test unlock logic works
    accumulated = calculate_progressive_mastery(previous_mastery, ai_score)
    return LangFlowEvalOutput(score=accumulated, feedback=feedback)


async def get_knowledge_gap_pathway(
    career_goal: str,
    mastered_chunks: list[dict],
    weak_chunks: list[dict],
    missing_chunks: list[dict],
) -> NT05Output:
    """
    NT-05: Analyse the user's global knowledge profile and generate a
    personalised learning pathway toward a career goal.

    MOCK path (USE_MOCK_AI=True):
        Returns a static pathway with up to 3 missing/weak chunks prioritised.

    LIVE path (USE_MOCK_AI=False):
        Sends the full profile JSON to NT-05 and parses its pathway output.

    Input shape sent to NT-05:
        {
          "career_goal":      "Network Engineer",
          "mastered_chunks":  [{"id": ..., "title": ..., "mastery_score": ...}],
          "weak_chunks":      [{"id": ..., "title": ..., "mastery_score": ...}],
          "missing_chunks":   [{"id": ..., "title": ...}]
        }
    """
    if get_settings().USE_MOCK_AI:
        return _mock_knowledge_gap_pathway(career_goal, mastered_chunks, weak_chunks, missing_chunks)

    # ── LIVE path ─────────────────────────────────────────────────────────────
    from app.services.langflow_client import run_flow, parse_json_output, LangFlowError

    settings = get_settings()

    import json as _json
    payload = _json.dumps(
        {
            "career_goal":     career_goal,
            "mastered_chunks": mastered_chunks,
            "weak_chunks":     weak_chunks,
            "missing_chunks":  missing_chunks,
        },
        ensure_ascii=False,
    )

    try:
        raw_text = await run_flow(
            flow_id=settings.LANGFLOW_FLOW_NT05,
            input_value=payload,
        )
    except LangFlowError as exc:
        logger.error("NT-05 call failed: %s", exc)
        raise

    raw_dict = parse_json_output(raw_text, settings.LANGFLOW_FLOW_NT05)
    nt05 = NT05Output.model_validate(raw_dict)

    logger.info(
        "NT-05 returned target_goal=%r  path_steps=%d  gaps=%d",
        nt05.target_goal, len(nt05.recommended_path), len(nt05.knowledge_gaps),
    )

    return nt05


def _mock_knowledge_gap_pathway(
    career_goal: str,
    mastered_chunks: list[dict],
    weak_chunks: list[dict],
    missing_chunks: list[dict],
) -> NT05Output:
    """
    Mock NT-05 pathway: prioritise weak chunks first, then missing chunks.
    Returns up to 5 path steps.
    """
    from app.schemas.langflow_schema import NT05PathStep

    strong_titles  = [c.get("title", c["id"]) for c in mastered_chunks]
    weak_titles    = [c.get("title", c["id"]) for c in weak_chunks]
    missing_titles = [c.get("title", c["id"]) for c in missing_chunks]

    gaps = weak_titles + missing_titles

    path_items = list(weak_chunks) + list(missing_chunks)
    steps = []
    for i, chunk in enumerate(path_items[:5], start=1):
        steps.append(NT05PathStep(
            step=i,
            chunk_id=chunk["id"],
            chunk_title=chunk.get("title", chunk["id"]),
            reason="Diprioritaskan untuk mencapai tujuan karir." if i == 1
                   else "Diperlukan sebagai prasyarat berikutnya.",
        ))

    return NT05Output(
        target_goal=career_goal,
        strong_concepts=strong_titles,
        weak_concepts=weak_titles,
        knowledge_gaps=gaps,
        missing_prerequisites=missing_titles,
        recommended_path=steps,
        estimated_completion_days=len(steps),
        reasoning="Jalur belajar dibangun berdasarkan gap antara penguasaan saat ini dan target karir.",
    )

