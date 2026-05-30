from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.job import JobStatus, SyncJob
from app.schemas.jobs import JobRead
from app.worker.tasks import process_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobRead])
def list_jobs(db: Session = Depends(get_db)) -> list[SyncJob]:
    return (
        db.query(SyncJob)
        .options(joinedload(SyncJob.media_asset))
        .order_by(desc(SyncJob.created_at))
        .limit(100)
        .all()
    )


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: UUID, db: Session = Depends(get_db)) -> SyncJob:
    job = (
        db.query(SyncJob)
        .options(joinedload(SyncJob.media_asset))
        .filter(SyncJob.id == job_id)
        .one_or_none()
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.post("/{job_id}/retry", response_model=JobRead)
def retry_job(job_id: UUID, db: Session = Depends(get_db)) -> SyncJob:
    job = (
        db.query(SyncJob)
        .options(joinedload(SyncJob.media_asset))
        .filter(SyncJob.id == job_id)
        .one_or_none()
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status not in {JobStatus.failed, JobStatus.completed}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only failed or completed jobs can be retried")

    job.status = JobStatus.queued
    job.progress = 0
    job.error_message = None
    job.completed_at = None
    db.add(job)
    db.commit()
    db.refresh(job)
    process_job.delay(str(job.id))
    return job
