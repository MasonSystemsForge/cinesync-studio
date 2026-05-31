from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.billing import CreditLedgerEntry, LedgerEntryType, RenderCost
from app.models.job import JobStatus, SyncJob
from app.models.project import Project
from app.schemas.jobs import DashboardStudioSummary, DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

STARTING_CREDITS = 10000.0
STARTING_BALANCE_USD = 250.0
MONTHLY_BUDGET_USD = 250.0


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


@router.get("/studio", response_model=DashboardStudioSummary)
def dashboard_studio_summary(db: Session = Depends(get_db)) -> DashboardStudioSummary:
    total_projects = db.query(func.count(Project.id)).scalar() or 0
    total_jobs = db.query(func.count(SyncJob.id)).scalar() or 0
    active_jobs = (
        db.query(func.count(SyncJob.id))
        .filter(SyncJob.status.in_([JobStatus.queued, JobStatus.processing]))
        .scalar()
        or 0
    )
    completed_jobs = db.query(SyncJob).filter(SyncJob.status == JobStatus.completed).all()
    failed_jobs = db.query(func.count(SyncJob.id)).filter(SyncJob.status == JobStatus.failed).scalar() or 0
    latest_cost = db.query(RenderCost).order_by(desc(RenderCost.created_at)).first()

    render_durations = []
    for job in completed_jobs:
        if job.completed_at and job.created_at:
            created = job.created_at.replace(tzinfo=None) if job.created_at.tzinfo else job.created_at
            completed = job.completed_at.replace(tzinfo=None) if job.completed_at.tzinfo else job.completed_at
            render_durations.append(max(0.0, (completed - created).total_seconds()))
    avg_render_time = sum(render_durations) / len(render_durations) if render_durations else None

    success_rate = 1.0 if total_jobs == 0 else len(completed_jobs) / max(1, total_jobs)
    debit_credits = (
        db.query(func.coalesce(func.sum(CreditLedgerEntry.credits), 0.0))
        .filter(CreditLedgerEntry.entry_type == LedgerEntryType.debit)
        .scalar()
        or 0.0
    )
    credit_credits = (
        db.query(func.coalesce(func.sum(CreditLedgerEntry.credits), 0.0))
        .filter(CreditLedgerEntry.entry_type == LedgerEntryType.credit)
        .scalar()
        or 0.0
    )
    debit_usd = (
        db.query(func.coalesce(func.sum(CreditLedgerEntry.amount_usd), 0.0))
        .filter(CreditLedgerEntry.entry_type == LedgerEntryType.debit)
        .scalar()
        or 0.0
    )
    credit_usd = (
        db.query(func.coalesce(func.sum(CreditLedgerEntry.amount_usd), 0.0))
        .filter(CreditLedgerEntry.entry_type == LedgerEntryType.credit)
        .scalar()
        or 0.0
    )
    credits_remaining = STARTING_CREDITS + credit_credits - debit_credits
    credit_balance_usd = STARTING_BALANCE_USD + credit_usd - debit_usd
    budget_used_percent = min(100.0, (debit_usd / MONTHLY_BUDGET_USD) * 100.0) if MONTHLY_BUDGET_USD else 0.0

    return DashboardStudioSummary(
        total_projects=total_projects,
        total_jobs=total_jobs,
        active_jobs=active_jobs,
        latest_cost_usd=latest_cost.estimated_cost_usd if latest_cost else 0.0,
        avg_render_time_seconds=avg_render_time,
        success_rate=success_rate,
        credits_remaining=credits_remaining,
        credit_balance_usd=credit_balance_usd,
        budget_used_percent=budget_used_percent,
    )
