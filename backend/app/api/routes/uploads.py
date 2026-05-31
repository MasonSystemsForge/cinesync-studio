from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.job import SyncJob
from app.models.media import MediaAsset
from app.models.project import Export, Project, PromptRun, ReviewDecision, Scene, SceneStatus
from app.schemas.jobs import UploadResponse
from app.services.storage import persist_upload
from app.worker.tasks import process_job

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _seed_project(project: Project, prompt: str) -> None:
    scene_specs = [
        ("Hook", 0, 0, 8000, SceneStatus.approved),
        ("Problem", 1, 8000, 18000, SceneStatus.draft),
        ("Product", 2, 18000, 34000, SceneStatus.generating),
        ("CTA", 3, 34000, 41000, SceneStatus.queued),
        ("End card", 4, 41000, 45000, SceneStatus.queued),
    ]
    project.scenes = [
        Scene(
            title=title,
            sort_order=sort_order,
            start_ms=start_ms,
            end_ms=end_ms,
            status=scene_status,
            prompt=prompt,
        )
        for title, sort_order, start_ms, end_ms, scene_status in scene_specs
    ]
    project.prompt_runs = [
        PromptRun(
            prompt=prompt or "Generate a localized, review-ready video variant from the uploaded source media.",
            mode="text_media",
            model_name="CineSync v1 Enterprise",
            status="queued",
        )
    ]
    project.review_decisions = [
        ReviewDecision(reviewer="Owner", notes="Review localized captions and render artifact before export.")
    ]
    project.exports = [Export(format="mp4")]


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def create_upload(
    file: UploadFile = File(...),
    source_language: str = Form("auto"),
    target_language: str = Form("en"),
    notes: str = Form(""),
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
    project = Project(
        media_asset=media_asset,
        name=Path(file.filename).stem or "Untitled localization project",
        brief=notes,
        source_language=source_language,
        target_language=target_language,
    )
    _seed_project(project, notes)
    job = SyncJob(
        project=project,
        media_asset=media_asset,
        source_language=source_language,
        target_language=target_language,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    db.refresh(project)

    process_job.delay(str(job.id))

    job = (
        db.query(SyncJob)
        .options(joinedload(SyncJob.media_asset), joinedload(SyncJob.project))
        .filter(SyncJob.id == job.id)
        .one()
    )
    return UploadResponse(job=job, project=job.project)
