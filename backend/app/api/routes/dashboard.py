from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.job import JobStatus, SyncJob
from app.schemas.jobs import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)) -> DashboardSummary:
    counts = dict(db.query(SyncJob.status, func.count(SyncJob.id)).group_by(SyncJob.status).all())
    return DashboardSummary(
        total_jobs=sum(counts.values()),
        queued=counts.get(JobStatus.queued, 0),
        processing=counts.get(JobStatus.processing, 0),
        completed=counts.get(JobStatus.completed, 0),
        failed=counts.get(JobStatus.failed, 0),
    )
