from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.job import JobStage, JobStatus


class MediaAssetRead(BaseModel):
    id: UUID
    original_filename: str
    content_type: str | None
    size_bytes: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobRead(BaseModel):
    id: UUID
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


class DashboardSummary(BaseModel):
    total_jobs: int
    queued: int
    processing: int
    completed: int
    failed: int
