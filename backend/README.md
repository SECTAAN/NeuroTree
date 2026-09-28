# NeuroTree Backend

FastAPI backend for the NeuroTree AI Adaptive Learning Platform.

## Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env as needed
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Server starts at: http://localhost:8000  
Swagger UI:       http://localhost:8000/docs  
ReDoc:            http://localhost:8000/redoc

## Structure

```
app/
├── api/            # Endpoint controllers
│   ├── dependencies.py   # X-User-ID header extraction
│   ├── material.py       # /api/v1/material/*
│   └── quiz.py           # /api/v1/quiz/*
├── core/           # Security & configuration
│   ├── config.py         # pydantic-settings (.env loader)
│   ├── security.py       # CORS + rate limiter
│   └── exceptions.py     # Global error hiding
├── db/
│   └── database.py       # SQLAlchemy engine + session factory
├── models/         # SQLAlchemy ORM models
│   ├── session.py        # sessions table
│   ├── node.py           # nodes table
│   └── edge.py           # edges table
├── schemas/        # Pydantic validation schemas (Milestone 2)
├── services/       # Business logic (Milestone 2+)
└── main.py         # FastAPI app entry point
```

## Milestones

| Milestone | Status | Description |
|-----------|--------|-------------|
| 1 | ✅ Done | Skeleton, CORS, DB models |
| 2 | ⏳ Next | Mock API + Mastery Engine |
| 3 | ⏳ | Frontend Foundation |
| 4 | ⏳ | React Flow + Circuit Logic |
| 5 | ⏳ | LangFlow Integration |
