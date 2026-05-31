from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.job import JobStage, JobStatus
from app.models.project import ProjectStatus


class MediaAssetRead(BaseModel):
    id: UUID
    original_filename: str
    content_type: str | None
    size_bytes: int
    duration_ms: int | None
    width: int | None
    height: int | None
    frame_rate: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectBrief(BaseModel):
    id: UUID
    name: str
    status: ProjectStatus
    source_language: str
    target_language: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobRead(BaseModel):
    id: UUID
    project_id: UUID | None
    source_language: str
    target_language: str
    status: JobStatus
    stage: JobStage
    progress: int
    error_message: str | None
    transcript_text: str | None
    translated_text: str | None
    render_path: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    latest_cost_usd: float | None
    latest_render_seconds: float | None
    media_asset: MediaAssetRead

    model_config = ConfigDict(from_attributes=True)


class UploadResponse(BaseModel):
    job: JobRead
    project: ProjectBrief


class DashboardSummary(BaseModel):
    total_jobs: int
    queued: int
    processing: int
    completed: int
    failed: int


class DashboardStudioSummary(BaseModel):
    total_projects: int
    total_jobs: int
    active_jobs: int
    latest_cost_usd: float
    avg_render_time_seconds: float | None
    success_rate: float
    credits_remaining: float
    credit_balance_usd: float
    budget_used_percent: float
