# NeuroTree — AI Adaptive Learning Platform

## Project
NeuroTree is an AI-powered adaptive learning platform that converts learning materials into an interactive knowledge circuit.

Core metaphor:
- Knowledge chunk = lamp
- Relationship/prerequisite = cable
- Lamp brightness = mastery
- Mastery >= 70 = mastered/unlocked
- Mastery < 70 = review

## Stack
Frontend:
- React + Vite
- TailwindCSS
- React Flow
- Framer Motion

Backend:
- Python
- FastAPI
- SQLite

AI:
- Langflow
- NT-01 Knowledge Extraction
- NT-02 Active Recall Generator
- NT-03 Mastery Evaluator
- NT-04 Adaptive Learning Agent
- NT-05 Knowledge Gap & Career Pathway

IBM Bob is used as the development assistant.

## Architecture

User
→ React
→ FastAPI
→ Langflow
→ structured JSON
→ FastAPI
→ React

Langflow flows:
NT-01 → material to knowledge chunks
NT-02 → chunk to active recall question
NT-03 → answer to mastery evaluation
NT-04 → mastery/profile to next learning action
NT-05 → global profile to knowledge gaps/pathway

## Completed Phases

F-1: Langflow integration
F-2: Dashboard and recommendations
F-3: Career Map
F-4: PDF/DOCX document ingestion
F-5: Quiz persistence and mastery UI
F-6:
- P0-1 My Trees uses real sessions
- P0-2 page/tree metadata persistence
- P0-5 empty graph guard
- P1-1 ingest timeout increased to 90s

All completed phases are committed to Git branch `master2`.

## Current Git
Branch: master2
Remote: origin/master2

Always inspect the current repository state before modifying code.

## Important Rules

- Do not modify NT-01 through NT-05 unless explicitly requested.
- Do not change completed F-1 through F-6 behavior unless explicitly requested.
- Prefer small, isolated changes.
- Reuse existing API patterns and components.
- Do not create unnecessary endpoints.
- Do not commit or push unless explicitly requested.
- Run relevant regression tests and frontend build after implementation.
- Do not expose or commit API keys/secrets.
- `.bob/` is local-only and ignored by Git.

## Mastery Rule

The application uses:
- 0–69.99 → review
- 70–100 → mastered/unlocked

Keep this threshold consistent across backend and frontend.

## Current Remaining F-6 Issues

P0-3:
Camera path currently sends a placeholder instead of real OCR/material extraction.

P0-4:
Frontend API base URL is currently hardcoded and should eventually use VITE_API_URL with a development fallback.

P1-2:
GlowingNodeCard mastery color threshold needs to match the 70 mastery rule.

P1-3:
RouterModal/FlashcardPanel still use mock router data.

P1-5:
Recommendation chip may have a race condition if target node is not yet available.

P1-6:
Landing page auto-advances after 6 seconds.

P2:
Optional UI/code cleanup items remain.

## Development Workflow

Before coding:
1. Inspect relevant files.
2. Check current Git status.
3. Understand existing implementation.

During coding:
- Modify only requested scope.
- Avoid unnecessary refactoring.

After coding:
1. Run relevant tests.
2. Run frontend build.
3. Report changed files.
4. Report tests/build.
5. Report remaining issues.
6. Stop and wait for further instructions.

## NeuroTree Goal

The MVP demo flow should work:

NewTree
→ PDF/DOCX/Text
→ Material extraction
→ NT-01
→ Knowledge Circuit
→ Active Recall
→ NT-03 Mastery
→ NT-04 Unlock/Review
→ NT-05 Knowledge Gap/Career Pathway
→ My Trees
→ Refresh persistence