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
