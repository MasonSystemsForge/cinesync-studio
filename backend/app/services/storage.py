from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import get_settings


async def persist_upload(file: UploadFile) -> tuple[Path, int]:
    settings = get_settings()
    suffix = Path(file.filename or "upload.bin").suffix
    safe_name = f"{uuid4()}{suffix}"
    destination = settings.upload_dir / safe_name
    size = 0

    with destination.open("wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > settings.max_upload_bytes:
                destination.unlink(missing_ok=True)
                raise ValueError(f"Upload exceeds {settings.max_upload_mb} MB limit")
            buffer.write(chunk)

    return destination, size
