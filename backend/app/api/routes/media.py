from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.media import MediaAsset

router = APIRouter(prefix="/media", tags=["media"])


def _get_media_or_404(media_id: UUID, db: Session) -> MediaAsset:
    media = db.get(MediaAsset, media_id)
    if media is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media asset not found")
    return media


def _media_path_or_404(media: MediaAsset) -> Path:
    media_path = Path(media.storage_path)
    if not media_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file is missing")
    return media_path


@router.get("/{media_id}/stream")
def stream_media(media_id: UUID, db: Session = Depends(get_db)) -> FileResponse:
    media = _get_media_or_404(media_id, db)
    media_path = _media_path_or_404(media)
    return FileResponse(
        media_path,
        media_type=media.content_type or "application/octet-stream",
        filename=media.original_filename,
    )


@router.get("/{media_id}/download")
def download_media(media_id: UUID, db: Session = Depends(get_db)) -> FileResponse:
    media = _get_media_or_404(media_id, db)
    media_path = _media_path_or_404(media)
    return FileResponse(
        media_path,
        media_type="application/octet-stream",
        filename=media.original_filename,
    )
