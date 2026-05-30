from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.job import SyncJob
from app.models.media import MediaAsset
from app.schemas.jobs import UploadResponse
from app.services.storage import persist_upload
from app.worker.tasks import process_job

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def create_upload(
    file: UploadFile = File(...),
    source_language: str = Form("auto"),
    target_language: str = Form("en"),
    db: Session = Depends(get_db),
) -> UploadResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must include a filename")

    try:
        storage_path, size_bytes = await persist_upload(file)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc

    media_asset = MediaAsset(
        original_filename=file.filename,
        content_type=file.content_type,
        size_bytes=size_bytes,
        storage_path=str(storage_path),
    )
    job = SyncJob(
        media_asset=media_asset,
        source_language=source_language,
        target_language=target_language,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    process_job.delay(str(job.id))

    job = (
        db.query(SyncJob)
        .options(joinedload(SyncJob.media_asset))
        .filter(SyncJob.id == job.id)
        .one()
    )
    return UploadResponse(job=job)
