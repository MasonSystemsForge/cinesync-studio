import shutil

from fastapi import APIRouter
from sqlalchemy import text

from app.db.session import SessionLocal

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health_check() -> dict[str, str]:
    with SessionLocal() as db:
        db.execute(text("select 1"))

    return {
        "api": "ok",
        "database": "ok",
        "ffmpeg": "available" if shutil.which("ffmpeg") else "missing",
    }
