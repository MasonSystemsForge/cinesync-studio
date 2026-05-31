import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ProjectStatus(str, enum.Enum):
    draft = "draft"
    processing = "processing"
    review = "review"
    approved = "approved"
    failed = "failed"


class SceneStatus(str, enum.Enum):
    queued = "queued"
    draft = "draft"
    generating = "generating"
    approved = "approved"


class ReviewStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    changes_requested = "changes_requested"


class ExportStatus(str, enum.Enum):
    pending = "pending"
    rendering = "rendering"
    ready = "ready"
    failed = "failed"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    media_asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    brief: Mapped[str | None] = mapped_column(Text)
    source_language: Mapped[str] = mapped_column(String(32), default="auto")
    target_language: Mapped[str] = mapped_column(String(32), default="en")
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.draft, index=True)
    aspect_ratio: Mapped[str] = mapped_column(String(32), default="16:9")
    resolution: Mapped[str] = mapped_column(String(32), default="1080p")
    caption_style: Mapped[str] = mapped_column(String(100), default="Premium lower third")
    voice_profile: Mapped[str] = mapped_column(String(100), default="Neutral brand narrator")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    media_asset = relationship("MediaAsset", back_populates="projects")
    jobs = relationship("SyncJob", back_populates="project")
    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan", order_by="Scene.sort_order")
    subtitles = relationship(
        "SubtitleSegment",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="SubtitleSegment.sort_order",
    )
    render_variants = relationship(
        "RenderVariant",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="RenderVariant.created_at.desc()",
    )
    prompt_runs = relationship("PromptRun", back_populates="project", cascade="all, delete-orphan")
    review_decisions = relationship("ReviewDecision", back_populates="project", cascade="all, delete-orphan")
    exports = relationship("Export", back_populates="project", cascade="all, delete-orphan")
    render_costs = relationship("RenderCost", back_populates="project", cascade="all, delete-orphan")
    credit_ledger_entries = relationship("CreditLedgerEntry", back_populates="project", cascade="all, delete-orphan")


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    start_ms: Mapped[int] = mapped_column(Integer, default=0)
    end_ms: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[SceneStatus] = mapped_column(Enum(SceneStatus), default=SceneStatus.queued)
    prompt: Mapped[str | None] = mapped_column(Text)

    project = relationship("Project", back_populates="scenes")
    subtitles = relationship("SubtitleSegment", back_populates="scene")


class SubtitleSegment(Base):
    __tablename__ = "subtitle_segments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    scene_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("scenes.id"), nullable=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    start_ms: Mapped[int] = mapped_column(Integer, default=0)
    end_ms: Mapped[int] = mapped_column(Integer, default=0)
    source_text: Mapped[str] = mapped_column(Text, default="")
    translated_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.pending)

    project = relationship("Project", back_populates="subtitles")
    scene = relationship("Scene", back_populates="subtitles")


class RenderVariant(Base):
    __tablename__ = "render_variants"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sync_jobs.id"), nullable=True, index=True)
    label: Mapped[str] = mapped_column(String(120), default="Draft render")
    status: Mapped[ExportStatus] = mapped_column(Enum(ExportStatus), default=ExportStatus.pending)
    render_path: Mapped[str | None] = mapped_column(String(1024))
    render_metadata: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="render_variants")
    job = relationship("SyncJob", back_populates="render_variants")


class PromptRun(Base):
    __tablename__ = "prompt_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(String(64), default="text_media")
    model_name: Mapped[str] = mapped_column(String(120), default="CineSync v1 Enterprise")
    status: Mapped[str] = mapped_column(String(64), default="queued")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="prompt_runs")


class ReviewDecision(Base):
    __tablename__ = "review_decisions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    reviewer: Mapped[str] = mapped_column(String(120), default="Owner")
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.pending)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="review_decisions")


class Export(Base):
    __tablename__ = "exports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    format: Mapped[str] = mapped_column(String(64), default="mp4")
    status: Mapped[ExportStatus] = mapped_column(Enum(ExportStatus), default=ExportStatus.pending)
    output_path: Mapped[str | None] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="exports")
