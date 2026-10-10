"""
Career API — /api/v1/career/*

Endpoints:
  GET  /api/v1/career/suggest   — derive candidate career names from the session's
                                  node titles using a rule-based domain mapper.
                                  Returns a prioritised list so Panel A can call
                                  pathway() with a real career name.

  POST /api/v1/career/pathway   — NT-05: knowledge gap analysis + personalized
                                  learning pathway toward a career goal

Session scoping (F-6): uses X-Session-ID (falls back to X-User-ID).
"""
from fastapi import APIRouter, Depends, status, Request, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DbSession

from app.api.dependencies import get_active_session_id
from app.db.database import get_db
from app.models.node import Node
from app.services import langflow_service
from app.services.mastery_service import UNLOCK_THRESHOLD, MASTERY_MAX
from app.core.security import limiter
from app.core.config import get_settings

router = APIRouter(tags=["Career"])
settings = get_settings()


# ── Domain career mapper ───────────────────────────────────────────────────────
# Maps knowledge-domain keywords to a ranked list of career names.
#
# Two keyword groups per rule:
#   substring_kws  — long / unambiguous terms; matched anywhere in the corpus
#                    (e.g. "machine learning", "routing", "cybersecurity")
#   word_kws       — short or easily mis-matched terms (e.g. "lan", "wan", "ai",
#                    "api", "web", "node"); MUST match as whole words only.
#
# Whole-word matching uses `\b` regex boundaries so that:
#   "lan" matches "lan topology" but NOT "pengumpulan" or "kolaborasi"
#   "wan" matches "wan link"     but NOT "ilmuwan" or "penyampaian"
#   "ai"  matches "ai model"     but NOT "visualisasi" or "penyimpanan"
#
# Scoring: each matched keyword (substring OR word boundary) counts as 1 hit.
# Domains are ranked by hit count (descending); ties broken by rule index.
# This prevents a single ambiguous hit from beating multiple genuine hits in
# another domain.
#
# Data Science / Indonesian-language additions to rule[03]:
# Titles like "Analisis Data", "Ilmuwan Data", "Visualisasi Insight" contain
# strong signals for Data Science careers but were not matched before.
import re as _re

_DOMAIN_RULES: list[tuple[list[str], list[str], list[str]]] = [
    #  (substring_kws,                word_kws,           careers)
    #
    # Design notes:
    #   substring_kws — long, specific terms unlikely to appear outside their domain
    #   word_kws      — short terms matched only at word boundaries (\b)
    #
    # Ambiguity guard: single-letter or extremely common English words are never
    # used as keywords. Short acronyms that are also common English words/abbreviations
    # in non-IT contexts ("ios" in "iOS" vs "previous", "gcp" in "Google Cloud"
    # vs "Good Clinical Practice") are moved to word_kws or made more specific.
    (
        # Networking — unambiguous multi-character terms
        ["network topology", "ip address", "ip addressing", "routing protocol",
         "switching", "tcp/ip", "vlan", "subnet mask", "subnetting",
         "firewall configuration", "vpn", "dns server", "dhcp", "bandwidth",
         "network security", "routing table", "network infrastructure"],
        # Short terms that MUST be whole words
        ["wan", "lan", "tcp", "udp"],
        ["Network Engineer", "Network Administrator", "Cybersecurity Analyst",
         "Network Security Engineer", "Cloud Infrastructure Engineer"],
    ),
    (
        ["cybersecurity", "intrusion detection", "malware analysis",
         "penetration testing", "cryptograph", "encryption algorithm",
         "siem", "digital forensic", "vulnerability assessment",
         "ethical hacking", "threat modeling", "security incident"],
        ["ids", "ips"],
        ["Cybersecurity Analyst", "Penetration Tester", "Security Operations Engineer",
         "Information Security Manager"],
    ),
    (
        ["machine learning", "deep learning", "neural network",
         "natural language processing", "artificial intelligence",
         "model training", "feature engineering", "gradient descent",
         "random forest", "convolutional", "transformer model",
         "dataset preparation", "regression model", "classification model"],
        ["nlp", "ai"],
        ["Machine Learning Engineer", "AI Engineer", "Data Scientist",
         "MLOps Engineer"],
    ),
    (
        # Data Science — includes Indonesian-language title fragments.
        # "analytics" removed from substring_kws (too common in marketing etc.);
        # replaced by more specific multi-word forms.
        ["data science", "data scientist", "ilmuwan data", "analisis data",
         "eksplorasi data", "data visualization", "data analytics",
         "database design", "etl pipeline", "data warehouse", "nosql",
         "data pipeline", "tableau dashboard", "power bi", "spark cluster",
         "hadoop", "pengumpulan data", "pemrosesan data", "penyimpanan data",
         "data wrangling", "statistical analysis"],
        ["sql", "etl", "data"],
        ["Data Scientist", "Data Analyst", "Data Engineer",
         "Business Intelligence Developer"],
    ),
    (
        # Cloud & DevOps — "gcp" moved to word_kws to avoid matching
        # "GCP Guidelines" (Good Clinical Practice) in biology/medical texts.
        ["kubernetes", "docker container", "cloud architecture",
         "infrastructure as code", "terraform", "serverless",
         "cloud deployment", "cloud platform", "devops pipeline",
         "continuous integration", "continuous deployment", "azure devops",
         "amazon web services", "google cloud platform"],
        ["aws", "gcp", "cloud", "devops"],
        ["Cloud Engineer", "DevOps Engineer", "Site Reliability Engineer",
         "Cloud Architect"],
    ),
    (
        ["html", "css", "javascript", "react", "vue.js", "angular",
         "frontend development", "backend development", "rest api",
         "microservice architecture"],
        ["web", "api", "node"],
        ["Full-Stack Web Developer", "Frontend Engineer", "Backend Engineer",
         "Software Engineer"],
    ),
    (
        # Mobile — "ios" moved to word_kws to avoid matching "previous"
        # or Indonesian words containing "ios".
        ["android development", "flutter", "kotlin", "swift", "react native",
         "mobile app", "mobile development"],
        ["ios"],
        ["Mobile App Developer", "Android Engineer", "iOS Engineer"],
    ),
    (
        ["operating system", "kernel", "linux", "unix", "system programming",
         "embedded system", "firmware", "device driver"],
        [],
        ["Systems Programmer", "Embedded Systems Engineer", "Linux Engineer"],
    ),
    (
        ["project management", "agile methodology", "scrum framework",
         "kanban board", "risk management", "stakeholder management",
         "waterfall methodology", "sprint planning", "project delivery"],
        [],
        ["IT Project Manager", "Scrum Master", "Product Manager"],
    ),
]

_FALLBACK_CAREERS: list[str] = [
    "Software Developer",
    "Data Analyst",
    "System Analyst",
]

# ── Architectural note ────────────────────────────────────────────────────────
# _DOMAIN_RULES only covers 9 IT/tech domains.  For any tree whose content falls
# outside these domains (Accounting, Biology, UI/UX, Agriculture, Marketing, etc.)
# _suggest_careers_from_titles() will return _FALLBACK_CAREERS — a generic result
# that does NOT reflect the actual domain.
#
# This is an honest limitation: the keyword-based domain mapper cannot classify
# unknown domains without being extended with domain-specific rules.  The
# /career/suggest response includes "source": "fallback" to signal this.
#
# Panel B custom career submissions (e.g. "Financial Analyst") are NOT affected
# by this limitation for the suggest step.  The pathway endpoint will still receive
# the user's typed career name.  However, _career_relevance_score() and
# _CAREER_REQUIRED_SKILLS in langflow_service.py also only cover the same set of
# IT/tech careers, so the mock pathway for unsupported careers uses a generic
# "unknown career" path — see langflow_service._mock_knowledge_gap_pathway().


def _kw_hits(keywords_sub: list[str], keywords_word: list[str], corpus: str) -> int:
    """
    Count how many distinct keywords match the corpus.

    substring_kws: plain `in` check (safe for long, unambiguous terms)
    word_kws:      \\b-bounded regex check (prevents false hits inside longer words)
    """
    hits = sum(1 for kw in keywords_sub if kw in corpus)
    for kw in keywords_word:
        if _re.search(r"\b" + _re.escape(kw) + r"\b", corpus):
            hits += 1
    return hits


def _suggest_careers_from_titles(node_titles: list[str]) -> list[str]:
    """
    Pure function — derives a ranked list of career names from node titles.

    Algorithm:
    1. Join all node titles into a single lowercase corpus string.
    2. For each domain rule, count keyword hits using _kw_hits():
       - long/unambiguous keywords: plain substring match
       - short/ambiguous keywords (wan, lan, ai, api, ...): whole-word match only
    3. Rank domains by descending hit count (ties broken by rule index).
    4. Return up to 5 careers from the top-ranked domains, deduplicated.
    5. If no rule matches, return _FALLBACK_CAREERS[:3].

    This prevents Indonesian words like "pengumpu**lan**" and "ilmu**wan**"
    from triggering the networking rule via the substring "lan"/"wan".
    """
    corpus = " ".join(node_titles).lower()

    # Minimum hit threshold: require at least 2 distinct keyword matches before
    # accepting a domain rule as a match.  A single hit can be a coincidental
    # substring — e.g. "gcp" in "GCP Guidelines" (Good Clinical Practice) in a
    # biology text would otherwise falsely suggest Cloud Engineer.
    # Two independent hits from the same rule make the domain inference much more
    # reliable without sacrificing recall for genuine IT/tech trees.
    _MIN_HITS = 2

    scored: list[tuple[int, int, list[str]]] = []
    for idx, rule in enumerate(_DOMAIN_RULES):
        sub_kws, word_kws, careers = rule
        hits = _kw_hits(sub_kws, word_kws, corpus)
        if hits >= _MIN_HITS:
            scored.append((hits, idx, careers))

    if not scored:
        return _FALLBACK_CAREERS[:3]

    scored.sort(key=lambda t: (-t[0], t[1]))

    seen: set[str] = set()
    results: list[str] = []
    for _, _, careers in scored:
        for career in careers:
            if career not in seen:
                seen.add(career)
                results.append(career)

    return results[:5]


# ── GET /career/suggest ────────────────────────────────────────────────────────

@router.get("/career/suggest", status_code=status.HTTP_200_OK)
def suggest_careers(
    session_id: str = Depends(get_active_session_id),
    db: DbSession = Depends(get_db),
):
    """
    Derive career name candidates from the session's knowledge-node titles.

    This endpoint is called by Panel A (auto-recommendation) in CareerMap so
    that a real career title — not a user's learning intention — is passed to
    POST /career/pathway.

    Returns:
        {
          "careers": ["Network Engineer", "Network Administrator", ...],
          "source": "domain_match" | "fallback",
          "node_count": <int>
        }

    `source` tells the frontend how the list was derived so it can display
    appropriate UI context.
    """
    nodes = (
        db.query(Node)
        .filter(Node.session_id == session_id, Node.node_type == "knowledge")
        .all()
    )

    titles = [n.title for n in nodes]
    careers = _suggest_careers_from_titles(titles)

    # Detect whether we matched something domain-specific or fell back
    corpus = " ".join(titles).lower()
    matched = any(
        _kw_hits(sub_kws, word_kws, corpus) > 0
        for sub_kws, word_kws, _ in _DOMAIN_RULES
    )

    return {
        "careers":    careers,
        "source":     "domain_match" if (titles and matched) else "fallback",
        "node_count": len(titles),
    }


# ── Request schema ────────────────────────────────────────────────────────────
# Defined inline here to keep it co-located with the single endpoint that uses it.

class CareerPathwayRequest(BaseModel):
    career_goal: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="The career role or goal the user is aiming for. e.g. 'Network Engineer'",
    )


# ── POST /career/pathway ───────────────────────────────────────────────────────

@router.post("/career/pathway", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_QUIZ)   # reuse quiz limiter (conservative)
async def get_career_pathway(
    request: Request,                        # required by slowapi
    body: CareerPathwayRequest,
    session_id: str = Depends(get_active_session_id),
    db: DbSession = Depends(get_db),
):
    """
    NT-05: Knowledge Gap & Personalized Learning Pathway.

    Builds the user's current mastery profile from DB, then calls LangFlow NT-05
    which analyses the gap between the current knowledge state and the target
    career goal and returns a prioritised step-by-step learning pathway.

    LIVE path (USE_MOCK_AI=False):
        Calls NT-05 with the full profile JSON. NT-05 returns:
          - strong_concepts, weak_concepts, knowledge_gaps
          - missing_prerequisites, recommended_path, reasoning,
            estimated_completion_days

    MOCK path (USE_MOCK_AI=True):
        Returns a deterministic pathway prioritising weak chunks first,
        then missing (locked/unstarted) chunks.

    Node classification:
        mastered  — status == 'unlocked' AND mastery_score >= UNLOCK_THRESHOLD
        weak      — status == 'unlocked' AND 0 < mastery_score < UNLOCK_THRESHOLD
        missing   — status == 'locked' OR mastery_score == 0
    """
    # M-7: exclude master_light nodes — they have a separate mastery track
    nodes = (
        db.query(Node)
        .filter(Node.session_id == session_id, Node.node_type == "knowledge")
        .all()
    )

    mastered_chunks = []
    weak_chunks     = []
    missing_chunks  = []

    for n in nodes:
        entry = {"id": n.id, "title": n.title, "mastery_score": round(n.mastery_score, 2)}
        if n.mastery_score >= UNLOCK_THRESHOLD:
            mastered_chunks.append(entry)
        elif n.mastery_score > 0:
            weak_chunks.append(entry)
        else:
            missing_chunks.append({"id": n.id, "title": n.title})

    result = await langflow_service.get_knowledge_gap_pathway(
        career_goal=body.career_goal,
        mastered_chunks=mastered_chunks,
        weak_chunks=weak_chunks,
        missing_chunks=missing_chunks,
        session_id=session_id,      # forwarded to LIVE NT-05 as user_id context
    )

    return {
        "career_goal":           result.target_goal or body.career_goal,
        "strong_concepts":       result.strong_concepts,
        "weak_concepts":         result.weak_concepts,
        "knowledge_gaps":        result.knowledge_gaps,
        "missing_prerequisites": result.missing_prerequisites,
        "recommended_path": [
            {
                "step":        step.step,
                "chunk_id":    step.chunk_id,
                "chunk_title": step.chunk_title,
                "reason":      step.reason,
            }
            for step in result.recommended_path
        ],
        "estimated_completion_days": result.estimated_completion_days,
        "reasoning":             result.reasoning,
        # tree_career_match (0.0–1.0): fraction of tree nodes relevant to career.
        # Frontend uses this to show a mismatch notice when the active tree
        # content does not match the target career (e.g. DS tree + NE goal).
        "tree_career_match":     result.tree_career_match,
        "profile_summary": {
            "mastered": len(mastered_chunks),
            "weak":     len(weak_chunks),
            "missing":  len(missing_chunks),
            "total":    len(nodes),
        },
    }
