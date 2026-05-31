from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.project import ExportStatus, ProjectStatus, ReviewStatus, SceneStatus
from app.schemas.jobs import JobRead, MediaAssetRead


class SceneRead(BaseModel):
    id: UUID
    title: str
    sort_order: int
    start_ms: int
    end_ms: int
    status: SceneStatus
    prompt: str | None

    model_config = ConfigDict(from_attributes=True)


class SubtitleSegmentRead(BaseModel):
    id: UUID
    scene_id: UUID | None
    sort_order: int
    start_ms: int
    end_ms: int
    source_text: str
    translated_text: str
    status: ReviewStatus

    model_config = ConfigDict(from_attributes=True)


class RenderVariantRead(BaseModel):
    id: UUID
    job_id: UUID | None
    label: str
    status: ExportStatus
    render_path: str | None
    render_metadata: dict | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PromptRunRead(BaseModel):
    id: UUID
    prompt: str
    mode: str
    model_name: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewDecisionRead(BaseModel):
    id: UUID
    reviewer: str
    status: ReviewStatus
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExportRead(BaseModel):
    id: UUID
    format: str
    status: ExportStatus
    output_path: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectRead(BaseModel):
    id: UUID
    name: str
    brief: str | None
    source_language: str
    target_language: str
    status: ProjectStatus
    aspect_ratio: str
    resolution: str
    caption_style: str
    voice_profile: str
    created_at: datetime
    updated_at: datetime
    media_asset: MediaAssetRead | None
    jobs: list[JobRead]
    scenes: list[SceneRead]
    subtitles: list[SubtitleSegmentRead]
    render_variants: list[RenderVariantRead]
    prompt_runs: list[PromptRunRead]
    review_decisions: list[ReviewDecisionRead]
    exports: list[ExportRead]

    model_config = ConfigDict(from_attributes=True)


class ProjectListItem(BaseModel):
    id: UUID
    name: str
    status: ProjectStatus
    source_language: str
    target_language: str
    created_at: datetime
    updated_at: datetime
    media_asset: MediaAssetRead | None

    model_config = ConfigDict(from_attributes=True)
