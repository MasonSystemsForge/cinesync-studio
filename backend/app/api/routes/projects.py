from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.session import get_db
from app.models.job import JobStatus, SyncJob
from app.models.project import (
    Project,
    ProjectStatus,
    PromptRun,
    ReviewDecision,
    Scene,
    SubtitleSegment,
)
from app.schemas.jobs import JobRead
from app.schemas.projects import (
    ProjectListItem,
    ProjectRead,
    ProjectUpdate,
    PromptRunCreate,
    PromptRunRead,
    RenderJobCreate,
    ReviewDecisionCreate,
    ReviewDecisionRead,
    SceneRead,
    SceneUpdate,
    SubtitleSegmentRead,
    SubtitleSegmentUpdate,
)
from app.worker.tasks import process_job

router = APIRouter(prefix="/projects", tags=["projects"])


def project_loader(query):
    return query.options(
        joinedload(Project.media_asset),
        selectinload(Project.jobs).joinedload(SyncJob.media_asset),
        selectinload(Project.scenes),
        selectinload(Project.subtitles),
        selectinload(Project.render_variants),
        selectinload(Project.prompt_runs),
        selectinload(Project.review_decisions),
        selectinload(Project.exports),
    )


def _get_project_or_404(db: Session, project_id: UUID) -> Project:
    project = project_loader(db.query(Project)).filter(Project.id == project_id).one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _queue_project_job(db: Session, project: Project, payload: RenderJobCreate | None = None) -> SyncJob:
    if project.media_asset is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project has no source media asset")

    if payload and payload.prompt:
        db.add(
            PromptRun(
                project=project,
                prompt=payload.prompt,
                mode=payload.mode,
                model_name=payload.model_name,
                status="queued",
            )
        )

    job = SyncJob(
        project=project,
        media_asset=project.media_asset,
        source_language=project.source_language,
        target_language=project.target_language,
    )
    project.status = ProjectStatus.processing
    db.add(job)
    db.add(project)
    db.commit()
    db.refresh(job)
    process_job.delay(str(job.id))
    return job


@router.get("", response_model=list[ProjectListItem])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    return (
        db.query(Project)
        .options(joinedload(Project.media_asset))
        .order_by(desc(Project.updated_at), desc(Project.created_at))
        .limit(100)
        .all()
    )


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: UUID, db: Session = Depends(get_db)) -> Project:
    return _get_project_or_404(db, project_id)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(project_id: UUID, payload: ProjectUpdate, db: Session = Depends(get_db)) -> Project:
    project = _get_project_or_404(db, project_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.add(project)
    db.commit()
    return _get_project_or_404(db, project_id)


@router.patch("/{project_id}/scenes/{scene_id}", response_model=SceneRead)
def update_scene(
    project_id: UUID,
    scene_id: UUID,
    payload: SceneUpdate,
    db: Session = Depends(get_db),
) -> Scene:
    scene = db.query(Scene).filter(Scene.project_id == project_id, Scene.id == scene_id).one_or_none()
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(scene, field, value)
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return scene


@router.patch("/{project_id}/subtitles/{subtitle_id}", response_model=SubtitleSegmentRead)
def update_subtitle(
    project_id: UUID,
    subtitle_id: UUID,
    payload: SubtitleSegmentUpdate,
    db: Session = Depends(get_db),
) -> SubtitleSegment:
    subtitle = (
        db.query(SubtitleSegment)
        .filter(SubtitleSegment.project_id == project_id, SubtitleSegment.id == subtitle_id)
        .one_or_none()
    )
    if subtitle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtitle segment not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(subtitle, field, value)
    db.add(subtitle)
    db.commit()
    db.refresh(subtitle)
    return subtitle


@router.post("/{project_id}/prompt-runs", response_model=PromptRunRead, status_code=status.HTTP_201_CREATED)
def create_prompt_run(project_id: UUID, payload: PromptRunCreate, db: Session = Depends(get_db)) -> PromptRun:
    project = _get_project_or_404(db, project_id)
    prompt_run = PromptRun(
        project=project,
        prompt=payload.prompt,
        mode=payload.mode,
        model_name=payload.model_name,
        status="queued",
    )
    db.add(prompt_run)
    db.commit()
    db.refresh(prompt_run)
    return prompt_run


@router.post("/{project_id}/reviews", response_model=ReviewDecisionRead, status_code=status.HTTP_201_CREATED)
def create_review_decision(
    project_id: UUID,
    payload: ReviewDecisionCreate,
    db: Session = Depends(get_db),
) -> ReviewDecision:
    project = _get_project_or_404(db, project_id)
    decision = ReviewDecision(
        project=project,
        reviewer=payload.reviewer,
        status=payload.status,
        notes=payload.notes,
    )
    if payload.status.value == "approved":
        project.status = ProjectStatus.approved
        db.add(project)
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision


@router.post("/{project_id}/render-jobs", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def create_render_job(project_id: UUID, payload: RenderJobCreate, db: Session = Depends(get_db)) -> SyncJob:
    project = _get_project_or_404(db, project_id)
    job = _queue_project_job(db, project, payload)
    return (
        db.query(SyncJob)
        .options(joinedload(SyncJob.media_asset))
        .filter(SyncJob.id == job.id)
        .one()
    )


@router.post("/{project_id}/jobs/{job_id}/retry", response_model=JobRead)
def retry_project_job(project_id: UUID, job_id: UUID, db: Session = Depends(get_db)) -> SyncJob:
    job = (
        db.query(SyncJob)
        .options(joinedload(SyncJob.media_asset), joinedload(SyncJob.project))
        .filter(SyncJob.project_id == project_id, SyncJob.id == job_id)
        .one_or_none()
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project job not found")
    if job.status not in {JobStatus.failed, JobStatus.completed}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only failed or completed jobs can be retried")

    job.status = JobStatus.queued
    job.progress = 0
    job.error_message = None
    job.completed_at = None
    if job.project is not None:
        job.project.status = ProjectStatus.processing
        db.add(job.project)
    db.add(job)
    db.commit()
    db.refresh(job)
    process_job.delay(str(job.id))
    return job
