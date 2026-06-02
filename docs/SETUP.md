# Setup Guide

## Requirements

- Node.js and npm for frontend work
- Python and virtualenv for backend work, if using the backend locally
- Docker, if using the full local stack
- FFmpeg, if rendering/export features are used outside Docker

## Environment setup

```bash
cp .env.example .env
```

Fill in local values only. Do not commit `.env`.

## Docker workflow

```bash
docker compose up --build
```

Typical local URLs:

- Frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## Manual frontend workflow

```bash
cd frontend
npm install
npm run dev
```

## Manual backend workflow

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Notes

- Keep uploads and renders local.
- Use demo media only.
- Do not commit generated videos, private uploads, or client assets.
