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
import re as _re

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
    question: str = "",
) -> LangFlowEvalOutput:
    """
    NT-03: Evaluate the user's essay answer and return mastery score + feedback.

    MOCK path (USE_MOCK_AI=True):
        Scores by word count; returns mastery as accumulated progressive score.

    LIVE path (USE_MOCK_AI=False):
        Sends {question, expected_answer, chunk_content, previous_mastery,
        user_answer} to NT-03 and returns its mastery_score directly.

    The `question` parameter should be the actual NT-02 generated question text
    (stored as node.last_question). Falls back to key_concepts[0] or node_title
    for backward compatibility when last_question is empty.

    Option A: NT-03's mastery_score is stored as-is in Node.mastery_score.
              calculate_progressive_mastery() is NOT called on this path.
    """
    if get_settings().USE_MOCK_AI:
        return _mock_evaluate(user_answer, previous_mastery)

    # ── LIVE path ─────────────────────────────────────────────────────────────
    from app.services.langflow_client import run_flow, parse_json_output, LangFlowError
    from app.schemas.langflow_schema import NT03Output

    settings = get_settings()

    # Use the actual NT-02 question if available; fall back for backward compat
    resolved_question = question or (key_concepts[0] if key_concepts else node_title)

    import json as _json
    eval_payload = _json.dumps(
        {
            "question":         resolved_question,
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
    F-7B.2: Mock evaluation returns a raw NT-03 score (0–100), matching the LIVE
    path contract.  quiz.py accumulates these raw scores and applies
    SESSION_PROGRESSION_WEIGHT (0.25) via calculate_session_mastery() — calling
    calculate_progressive_mastery() here would cause double-discounting.

    Score bands (by word count, mirrors NT-03 scoring heuristics):
      >= 20 words → 75–95  (high)
       8–19 words → 45–74  (medium)
        < 8 words → 10–44  (low)

    `previous_mastery` is accepted for signature compatibility with the LIVE
    evaluate_answer() caller but is intentionally not used here — the baseline
    is applied by quiz.py's calculate_session_mastery() after all 3 scores are
    accumulated.
    """
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
    return LangFlowEvalOutput(score=float(ai_score), feedback=feedback)


async def get_knowledge_gap_pathway(
    career_goal: str,
    mastered_chunks: list[dict],
    weak_chunks: list[dict],
    missing_chunks: list[dict],
    session_id: str = "",
) -> NT05Output:
    """
    NT-05: Analyse the user's global knowledge profile and generate a
    personalised learning pathway toward a career goal.

    MOCK path (USE_MOCK_AI=True):
        Returns a career-aware pathway.  Chunks whose titles contain keywords
        matching the requested career domain are surfaced first in the
        recommended_path and knowledge_gaps.  knowledge_gaps are labelled with
        the target career goal so they are visually distinct per Panel A/B call.

    LIVE path (USE_MOCK_AI=False):
        Sends the full profile JSON to NT-05 in the field names the NT-05
        Prompt Template expects:
          - target_goal  (was "career_goal" — Bug 3 fix)
          - all_chunks   (union of all chunks — gives NT-05 complete context)
          - user_id      (session_id for NT-05 personalisation)
        This aligns the backend payload with the NT-05 prompt template which
        declares {profile_input} containing target_goal / all_chunks / user_id.

    Input shape sent to NT-05 (LIVE):
        {
          "target_goal":      "Network Engineer",     ← was career_goal
          "user_id":          "<session_id>",
          "mastered_chunks":  [{"id": ..., "title": ..., "mastery_score": ...}],
          "weak_chunks":      [{"id": ..., "title": ..., "mastery_score": ...}],
          "missing_chunks":   [{"id": ..., "title": ...}],
          "all_chunks":       [...mastered + weak + missing combined...]
        }
    """
    if get_settings().USE_MOCK_AI:
        return _mock_knowledge_gap_pathway(career_goal, mastered_chunks, weak_chunks, missing_chunks)

    # ── LIVE path ─────────────────────────────────────────────────────────────
    from app.services.langflow_client import run_flow, parse_json_output, LangFlowError

    settings = get_settings()

    import json as _json

    # all_chunks = union of every chunk the session has, preserving order:
    # mastered → weak → missing (gives NT-05 the complete knowledge graph context)
    all_chunks = mastered_chunks + weak_chunks + [
        {"id": c["id"], "title": c["title"], "mastery_score": 0} for c in missing_chunks
    ]

    # career_required_skills: structured competency list for the target career.
    # Injected so NT-05's LLM can distinguish "what the career needs" from
    # "what's in the tree", enabling it to produce career-specific gaps even
    # when the tree content is unrelated to the target career.
    # Imported late to avoid circular dependency — _CAREER_REQUIRED_SKILLS is
    # defined later in this same module.
    career_required_skills = _CAREER_REQUIRED_SKILLS.get(career_goal, _DEFAULT_REQUIRED_SKILLS)

    payload = _json.dumps(
        {
            "target_goal":            career_goal,       # field name NT-05 prompt expects
            "user_id":                session_id or "",
            "mastered_chunks":        mastered_chunks,
            "weak_chunks":            weak_chunks,
            "missing_chunks":         missing_chunks,
            "all_chunks":             all_chunks,
            # career_required_skills helps NT-05 evaluate the gap between the tree
            # and the actual career, not just summarise the tree.
            "career_required_skills": career_required_skills,
            # learning_history not tracked yet — pass empty list so NT-05 won't error
            "learning_history": [],
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


# ── Career-domain keyword lookup ──────────────────────────────────────────────
# Two lists per career:
#   substring_kws — long / unambiguous terms; matched anywhere in title
#   word_kws      — short or easily mis-matched terms; matched as whole words
#                   using \b regex boundaries
#
# This mirrors the two-list approach in _DOMAIN_RULES (career.py) to prevent
# false hits like "ip" inside "deskriptif" or "ai" inside "visualisasi".
#
# Also included: _CAREER_REQUIRED_SKILLS — a short human-readable list of
# competencies that define each career.  Used to:
#   1. Detect when a tree's content is mismatched with the target career.
#   2. Provide NT-05 (LIVE) with structured career context it might not infer.
#   3. Populate knowledge_gaps with meaningful entries when zero tree nodes
#      match the career (instead of showing all DS nodes for "Network Engineer").

_CAREER_KEYWORDS: dict[str, tuple[list[str], list[str]]] = {
    # (substring_kws, word_kws)
    "Network Engineer": (
        ["network", "routing", "switching", "tcp/ip", "ip address", "vlan",
         "subnet", "firewall", "vpn", "dns", "dhcp", "bandwidth", "topology"],
        ["tcp", "udp", "wan", "lan"],
    ),
    "Network Administrator": (
        ["network", "routing", "switching", "ip address", "vlan", "dns", "dhcp",
         "network configuration", "network monitoring"],
        ["tcp", "wan", "lan"],
    ),
    "Cybersecurity Analyst": (
        ["security", "cybersecurity", "firewall", "intrusion", "malware",
         "encryption", "siem", "forensic", "penetration", "threat", "vulnerability"],
        ["ids", "ips"],
    ),
    "Network Security Engineer": (
        ["network", "security", "firewall", "vpn", "intrusion", "encryption",
         "routing", "switching"],
        ["ids", "ips", "lan", "wan"],
    ),
    "Machine Learning Engineer": (
        ["machine learning", "deep learning", "neural network", "neural",
         "natural language processing", "regression", "classification",
         "model training", "feature engineering", "dataset"],
        ["nlp", "ai"],
    ),
    "AI Engineer": (
        ["artificial intelligence", "machine learning", "deep learning",
         "neural network", "natural language processing", "computer vision",
         "model deployment"],
        ["ai", "nlp"],
    ),
    "Data Scientist": (
        ["data science", "machine learning", "statistics", "regression",
         "classification", "analytics", "dataset", "visualization",
         "exploratory", "hypothesis", "model evaluation"],
        ["sql", "etl"],
    ),
    "Data Engineer": (
        ["data pipeline", "data warehouse", "data lake", "etl",
         "spark", "hadoop", "kafka", "airflow", "database",
         "data ingestion", "data processing"],
        ["sql", "etl"],
    ),
    "Data Analyst": (
        ["data analysis", "analytics", "visualization", "dashboard",
         "tableau", "power bi", "reporting", "business intelligence"],
        ["sql"],
    ),
    "Cloud Engineer": (
        ["cloud", "aws", "azure", "gcp", "kubernetes", "docker",
         "container", "terraform", "infrastructure", "serverless",
         "cloud architecture"],
        [],
    ),
    "DevOps Engineer": (
        ["devops", "ci/cd", "continuous integration", "kubernetes", "docker",
         "automation", "pipeline", "terraform", "monitoring", "deployment"],
        [],
    ),
    "Full-Stack Web Developer": (
        ["web development", "html", "css", "javascript", "react", "vue",
         "angular", "rest", "microservice", "frontend", "backend"],
        ["web", "api", "node"],
    ),
    "Frontend Engineer": (
        ["html", "css", "javascript", "react", "vue", "angular",
         "responsive design", "ui", "frontend"],
        ["web"],
    ),
    "Backend Engineer": (
        ["backend", "server", "database", "rest", "microservice",
         "authentication", "authorization"],
        ["api", "node"],
    ),
    "Software Engineer": (
        ["software", "programming", "algorithm", "data structure",
         "design pattern", "object-oriented", "software development"],
        ["oop"],
    ),
    "Mobile App Developer": (
        ["mobile", "android", "ios", "flutter", "kotlin", "swift",
         "react native", "app development"],
        [],
    ),
    "Systems Programmer": (
        ["operating system", "kernel", "linux", "unix", "system programming",
         "embedded", "firmware", "driver"],
        [],
    ),
    "Embedded Systems Engineer": (
        ["embedded", "firmware", "microcontroller", "real-time", "hardware",
         "driver", "low-level"],
        [],
    ),
    "Linux Engineer": (
        ["linux", "unix", "shell", "kernel", "system administration",
         "bash", "operating system"],
        [],
    ),
    "IT Project Manager": (
        ["project management", "agile", "scrum", "kanban", "risk management",
         "stakeholder", "waterfall", "sprint", "delivery"],
        [],
    ),
    "Cloud Architect": (
        ["cloud", "aws", "azure", "gcp", "cloud architecture", "infrastructure",
         "scalability", "reliability", "terraform"],
        [],
    ),
    "Site Reliability Engineer": (
        ["reliability", "sre", "monitoring", "observability", "incident",
         "kubernetes", "docker", "automation"],
        [],
    ),
    "MLOps Engineer": (
        ["mlops", "model deployment", "model monitoring", "pipeline",
         "machine learning", "ci/cd", "docker", "kubernetes"],
        [],
    ),
    "Business Intelligence Developer": (
        ["business intelligence", "data warehouse", "tableau", "power bi",
         "reporting", "dashboard", "analytics", "etl"],
        ["sql"],
    ),
    "Information Security Manager": (
        ["security", "cybersecurity", "risk management", "compliance",
         "policy", "audit", "governance", "information security"],
        ["ids", "ips"],
    ),
    "Penetration Tester": (
        ["penetration", "ethical hacking", "vulnerability", "exploit",
         "security testing", "malware analysis", "forensic"],
        [],
    ),
    "Cloud Infrastructure Engineer": (
        ["cloud", "infrastructure", "aws", "azure", "gcp", "terraform",
         "kubernetes", "docker", "networking", "routing"],
        [],
    ),
    "Scrum Master": (
        ["agile", "scrum", "sprint", "retrospective", "backlog",
         "kanban", "team facilitation"],
        [],
    ),
    "Product Manager": (
        ["product management", "roadmap", "stakeholder", "user story",
         "requirements", "agile", "sprint"],
        [],
    ),
}

# Short human-readable required competency list per career.
# Used when tree content has zero relevance to the target career to provide
# honest "what you'd need to learn" output instead of echoing tree gaps.
_CAREER_REQUIRED_SKILLS: dict[str, list[str]] = {
    "Network Engineer":          ["Network Topologies", "IP Addressing & Subnetting", "Routing & Switching", "TCP/IP Protocols", "Firewall & VPN", "DNS & DHCP"],
    "Network Administrator":     ["Network Configuration", "IP Addressing", "DNS & DHCP", "Routing & Switching", "Network Monitoring"],
    "Cybersecurity Analyst":     ["Threat Analysis", "Firewall Management", "Intrusion Detection", "Malware Analysis", "Encryption", "SIEM"],
    "Network Security Engineer": ["Network Security", "Firewall Configuration", "VPN", "IDS/IPS", "Routing & Switching"],
    "Machine Learning Engineer": ["Machine Learning Algorithms", "Deep Learning", "Model Training", "Feature Engineering", "Python for ML"],
    "AI Engineer":               ["Artificial Intelligence", "Machine Learning", "Deep Learning", "NLP", "Model Deployment"],
    "Data Scientist":            ["Statistics", "Machine Learning", "Data Analysis", "Data Visualization", "Python/R", "Hypothesis Testing"],
    "Data Engineer":             ["ETL Pipelines", "Data Warehousing", "SQL", "Spark/Hadoop", "Data Modeling"],
    "Data Analyst":              ["SQL", "Data Visualization", "Statistical Analysis", "Dashboard (Tableau/Power BI)", "Business Intelligence"],
    "Cloud Engineer":            ["AWS/Azure/GCP", "Cloud Architecture", "Kubernetes", "Docker", "Terraform", "Serverless"],
    "DevOps Engineer":           ["CI/CD Pipelines", "Docker & Kubernetes", "Infrastructure as Code", "Monitoring", "Automation"],
    "Full-Stack Web Developer":  ["HTML/CSS", "JavaScript", "React/Vue/Angular", "REST APIs", "Backend Frameworks", "Databases"],
    "Frontend Engineer":         ["HTML/CSS", "JavaScript", "React or Vue", "Responsive Design", "Browser APIs"],
    "Backend Engineer":          ["Server-Side Languages", "REST APIs", "Database Design", "Authentication", "Microservices"],
    "Software Engineer":         ["Algorithms & Data Structures", "Object-Oriented Design", "Design Patterns", "Testing", "Version Control"],
    "Mobile App Developer":      ["Android or iOS Development", "Flutter or React Native", "Mobile UX", "REST APIs", "App Store Deployment"],
    "Systems Programmer":        ["Operating Systems", "Linux/Unix", "Kernel Programming", "Embedded Systems", "C/C++"],
    "IT Project Manager":        ["Project Management", "Agile/Scrum", "Risk Management", "Stakeholder Communication", "Delivery Planning"],
    "Scrum Master":              ["Scrum Framework", "Agile Principles", "Sprint Planning", "Retrospectives", "Team Facilitation"],
    "MLOps Engineer":            ["ML Pipeline Automation", "Model Deployment", "Docker/Kubernetes", "CI/CD for ML", "Monitoring"],
    "Business Intelligence Developer": ["SQL", "ETL", "Data Warehousing", "Tableau/Power BI", "Reporting", "Analytics"],
    "Cloud Architect":           ["Cloud Design Principles", "Multi-Region Architecture", "AWS/Azure/GCP", "Security & Compliance", "Cost Optimization"],
    "Site Reliability Engineer": ["SRE Practices", "Monitoring & Observability", "Incident Response", "Kubernetes", "Automation"],
    "Information Security Manager": ["Security Governance", "Risk Management", "Compliance", "Security Auditing", "Policy Development"],
    "Penetration Tester":        ["Ethical Hacking", "Vulnerability Assessment", "Exploit Development", "Security Testing", "Forensics"],
}

# Sentinel: _career_relevance_score returns this when the career is not registered.
# It means "unknown" — the tree-career relevance cannot be computed accurately.
_CAREER_UNKNOWN_SCORE = -1

# Default keywords and skills for careers NOT in _CAREER_KEYWORDS / _CAREER_REQUIRED_SKILLS.
# These are IT-generic and only make sense when the user types an IT/tech-adjacent career.
# For truly non-IT careers (Financial Analyst, Agronomist, etc.) the defaults do NOT apply —
# instead the mock reports "career not in our reference database" honestly.
_DEFAULT_CAREER_KEYWORDS_ENTRY: tuple[list[str], list[str]] = (
    [],  # no substring keywords for unknown careers
    [],  # no word keywords for unknown careers
)
_DEFAULT_REQUIRED_SKILLS: list[str] = []  # empty means "not in reference database"


def _career_relevance_score(chunk_title: str, career_goal: str) -> int:
    """
    Returns the number of career-domain keywords found in ``chunk_title``.
    Higher score = more relevant to the requested career.

    Returns ``_CAREER_UNKNOWN_SCORE`` (-1) when ``career_goal`` is not in
    ``_CAREER_KEYWORDS``.  Callers must check for this sentinel before treating
    the score as a relevance signal.  Returning -1 prevents the mock from
    claiming "tree_career_match=0" (mismatch) when the career simply isn't
    registered — these are two different situations.

    Uses word-boundary matching (\b) for short/ambiguous terms to prevent
    false hits like "ip" matching inside "deskriptif", or "ai" inside
    "visualisasi".  Long, unambiguous terms still use plain substring matching.
    """
    if career_goal not in _CAREER_KEYWORDS:
        return _CAREER_UNKNOWN_SCORE
    title_lower = chunk_title.lower()
    sub_kws, word_kws = _CAREER_KEYWORDS[career_goal]
    score = sum(1 for kw in sub_kws if kw in title_lower)
    for kw in word_kws:
        if _re.search(r"\b" + _re.escape(kw) + r"\b", title_lower):
            score += 1
    return score


def _mock_knowledge_gap_pathway(
    career_goal: str,
    mastered_chunks: list[dict],
    weak_chunks: list[dict],
    missing_chunks: list[dict],
) -> NT05Output:
    """
    Mock NT-05 pathway -- career-aware, separation-enforced, honest about limits (M-18).

    Three distinct cases:

    Case 1 -- UNKNOWN CAREER (not in _CAREER_KEYWORDS):
        career_goal is a valid career name the system does not recognise yet.
        e.g. "Financial Analyst", "Agronomist", "Product Designer"
        tree_career_match = -1.0  (sentinel: "not computable")
        knowledge_gaps = []  (cannot determine without reference data)
        recommended_path = all weak+missing tree nodes (user's actual content)
        reasoning = honest "career not in our reference DB" message

    Case 2 -- KNOWN CAREER, tree is relevant (match > 0):
        knowledge_gaps = career-required skills the tree does not cover yet
        recommended_path = career-relevant weak/missing nodes (filtered)
        tree_career_match in (0, 1]

    Case 3 -- KNOWN CAREER, tree is mismatched (match == 0):
        knowledge_gaps = canonical required skills from _CAREER_REQUIRED_SKILLS
        recommended_path = []  (no relevant tree nodes to step through)
        tree_career_match = 0.0

    In all cases:
    - strong_concepts = mastered tree nodes (factual, not career-filtered)
    - weak_concepts   = weak tree nodes (factual, not career-filtered)
    - missing_prerequisites = ALL missing tree nodes (structural fact)
    """
    from app.schemas.langflow_schema import NT05PathStep

    strong_titles  = [c.get("title", c["id"]) for c in mastered_chunks]
    weak_titles    = [c.get("title", c["id"]) for c in weak_chunks]
    all_chunks     = mastered_chunks + weak_chunks + missing_chunks
    total_chunks   = len(all_chunks)

    career_is_known = career_goal in _CAREER_KEYWORDS

    # Case 1: career not in our keyword database
    if not career_is_known:
        # We cannot compute relevance, so we do not claim mismatch.
        # Show all weak+missing nodes as the recommended path.
        path_items = weak_chunks + missing_chunks
        steps = [
            NT05PathStep(
                step=i,
                chunk_id=c["id"],
                chunk_title=c.get("title", c["id"]),
                reason=(
                    f"Topik dari pohon belajar Anda yang belum dikuasai. "
                    f"Relevansinya dengan karir '{career_goal}' tidak dapat dinilai otomatis."
                ),
            )
            for i, c in enumerate(path_items[:5], start=1)
        ]
        if total_chunks == 0:
            reasoning = (
                f"Belum ada topik dalam pohon belajar ini. "
                f"Unggah materi yang relevan untuk karir '{career_goal}'."
            )
        else:
            reasoning = (
                f"Karir '{career_goal}' belum ada dalam basis data referensi kami, "
                f"sehingga analisis gap otomatis tidak dapat dilakukan. "
                f"Hasil di atas hanya menampilkan topik dari pohon belajar aktif Anda. "
                f"Untuk analisis yang lebih mendalam, gunakan mode LIVE (NT-05 AI)."
            )
        return NT05Output(
            target_goal=career_goal,
            strong_concepts=strong_titles,
            weak_concepts=weak_titles,
            knowledge_gaps=[],
            missing_prerequisites=[c.get("title", c["id"]) for c in missing_chunks],
            recommended_path=steps,
            estimated_completion_days=len(steps),
            reasoning=reasoning,
            tree_career_match=-1.0,
        )

    # Cases 2 & 3: known career
    def _score(chunk: dict) -> int:
        s = _career_relevance_score(chunk.get("title", chunk["id"]), career_goal)
        return s if s != _CAREER_UNKNOWN_SCORE else 0

    scored_weak    = sorted(weak_chunks,    key=_score, reverse=True)
    scored_missing = sorted(missing_chunks, key=_score, reverse=True)

    relevant_weak    = [c for c in scored_weak    if _score(c) > 0]
    relevant_missing = [c for c in scored_missing if _score(c) > 0]
    relevant_all     = sum(1 for c in all_chunks if _score(c) > 0)

    tree_career_match = round(relevant_all / total_chunks, 2) if total_chunks > 0 else 0.0

    required_skills = _CAREER_REQUIRED_SKILLS.get(career_goal, [])

    if relevant_all > 0:
        # Case 2: tree has career-relevant content
        gaps = (
            [c.get("title", c["id"]) for c in relevant_weak]
            + [c.get("title", c["id"]) for c in relevant_missing]
        )
        # Supplement: add required skills whose full phrase is not present in tree titles.
        # Use normalised phrase matching (lowercase, strip punctuation except hyphens).
        tree_corpus = " " + " ".join(c.get("title", c["id"]).lower() for c in all_chunks) + " "
        for skill in required_skills:
            skill_phrase = _re.sub(r"[^a-z0-9\- ]", "", skill.lower()).strip()
            if skill_phrase and skill_phrase not in tree_corpus and skill not in gaps:
                gaps.append(skill)
    else:
        # Case 3: mismatch
        gaps = list(required_skills)

    path_items = relevant_weak + relevant_missing
    steps = []
    for i, chunk in enumerate(path_items[:5], start=1):
        reason = (
            f"Topik ini paling relevan untuk karir '{career_goal}' "
            "dan belum dikuasai -- prioritas tertinggi."
            if i == 1 else
            f"Diperlukan untuk mencapai '{career_goal}'; "
            "selesaikan sebelum melanjutkan ke tahap berikutnya."
        )
        steps.append(NT05PathStep(
            step=i,
            chunk_id=chunk["id"],
            chunk_title=chunk.get("title", chunk["id"]),
            reason=reason,
        ))

    if total_chunks == 0:
        reasoning = (
            f"Belum ada topik dalam pohon belajar ini. "
            f"Untuk mengejar karir '{career_goal}', mulailah dengan unggah materi yang relevan."
        )
    elif tree_career_match == 0.0:
        reasoning = (
            f"Pohon belajar aktif Anda membahas topik yang berbeda dari '{career_goal}'. "
            f"Tidak ada topik dalam pohon ini yang langsung relevan untuk karir tersebut. "
            f"Daftar di bawah menunjukkan kompetensi yang umumnya dibutuhkan untuk '{career_goal}' -- "
            "unggah materi yang sesuai untuk mendapat analisis yang lebih personal."
        )
    elif tree_career_match < 0.3:
        reasoning = (
            f"Hanya sebagian kecil ({int(tree_career_match * 100)}%) topik dalam pohon belajar Anda "
            f"yang relevan untuk karir '{career_goal}'. "
            "Jalur di bawah menampilkan topik-topik yang ada dan relevan terlebih dahulu, "
            "dilengkapi dengan kompetensi wajib yang belum tercakup."
        )
    elif path_items:
        reasoning = (
            f"Jalur belajar ini dibangun untuk tujuan karir '{career_goal}'. "
            "Hanya topik yang relevan dengan karir tersebut yang dimasukkan dalam jalur, "
            "diurutkan dari yang paling mendesak untuk dikuasai."
        )
    else:
        reasoning = (
            f"Semua topik yang relevan untuk karir '{career_goal}' sudah dikuasai. "
            "Pertimbangkan memperluas materi belajar atau melanjutkan ke tingkat lanjutan."
        )

    return NT05Output(
        target_goal=career_goal,
        strong_concepts=strong_titles,
        weak_concepts=weak_titles,
        knowledge_gaps=gaps,
        missing_prerequisites=[c.get("title", c["id"]) for c in scored_missing],
        recommended_path=steps,
        estimated_completion_days=len(steps),
        reasoning=reasoning,
        tree_career_match=tree_career_match,
    )
