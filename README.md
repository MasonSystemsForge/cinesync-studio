# CineSync Studio

CineSync Studio is a scaffold for an AI-assisted video localization workflow. It includes:

- Next.js frontend with upload, dashboard, and job-progress pages
- FastAPI backend with upload, dashboard, job, and health routes
- PostgreSQL persistence via SQLAlchemy models
- Redis-backed Celery worker for job orchestration
- FFmpeg installed in the backend/worker image
- Mock speech-to-text, translation, and render providers

## Repository layout

```text
.
|-- backend/              # FastAPI app, SQLAlchemy models, Celery worker
|-- frontend/             # Next.js App Router UI
|-- uploads/              # Local upload mount for development
|-- docker-compose.yml    # PostgreSQL, Redis, API, worker, frontend
`-- .env.example          # Local environment template
```

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Frontend: <http://localhost:3000>
- API docs: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>

## Backend API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | API/database/FFmpeg health |
| `POST` | `/uploads` | Multipart media upload; queues a sync job |
| `GET` | `/jobs` | Recent sync jobs |
| `GET` | `/jobs/{job_id}` | Job progress and provider output |
| `POST` | `/jobs/{job_id}/retry` | Requeue a completed or failed job |
| `GET` | `/dashboard/summary` | Job status counts |

## Local development without Docker

Backend:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Worker:

```bash
cd backend
. .venv/bin/activate
celery -A app.worker.celery_app.celery_app worker --loglevel=info
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

For local non-Docker backend runs, set `DATABASE_URL`, `CELERY_BROKER_URL`, and `CELERY_RESULT_BACKEND`
to reachable PostgreSQL and Redis instances.

## Mock provider flow

1. Upload saves media metadata and stores the file under `UPLOAD_DIR`.
2. FastAPI creates a `SyncJob` row and queues `jobs.process`.
3. Celery simulates transcription, translation, and rendering.
4. The render provider writes a JSON artifact containing FFmpeg detection metadata.
5. The frontend polls `/jobs/{job_id}` to show stage and progress updates.


## Database migrations

The backend includes Alembic scaffolding for production-safe schema management:

```bash
cd backend
alembic upgrade head
```

For local Docker-based development, the API still creates tables on startup as a convenience. Use Alembic for deployed environments and future schema changes.


## FFmpeg exports

Worker renders now create subtitle sidecars for each processed job:

- `.srt` subtitle file
- `.vtt` subtitle file
- `.mp4` export with a soft subtitle track when FFmpeg can read a video source
- `.json` fallback artifact when source media is missing, audio-only, or FFmpeg cannot mux the source

Ready project exports can be downloaded from:

```text
GET /projects/{project_id}/exports/{export_id}/download
```
