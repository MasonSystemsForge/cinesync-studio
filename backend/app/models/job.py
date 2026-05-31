import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class JobStatus(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class JobStage(str, enum.Enum):
    upload = "upload"
    transcribing = "transcribing"
    translating = "translating"
    rendering = "rendering"
    completed = "completed"
    failed = "failed"


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    media_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("media_assets.id"), nullable=False, index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    source_language: Mapped[str] = mapped_column(String(32), default="auto")
    target_language: Mapped[str] = mapped_column(String(32), default="en")
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.queued, index=True)
    stage: Mapped[JobStage] = mapped_column(Enum(JobStage), default=JobStage.upload)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    transcript_text: Mapped[str | None] = mapped_column(Text)
    translated_text: Mapped[str | None] = mapped_column(Text)
    render_path: Mapped[str | None] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    media_asset = relationship("MediaAsset", back_populates="jobs")
    project = relationship("Project", back_populates="jobs")
    render_variants = relationship("RenderVariant", back_populates="job")
    render_costs = relationship("RenderCost", back_populates="job")
    credit_ledger_entries = relationship("CreditLedgerEntry", back_populates="job")


    @property
    def latest_cost_usd(self) -> float | None:
        if not self.render_costs:
            return None
        latest = max(self.render_costs, key=lambda cost: cost.created_at)
        return latest.estimated_cost_usd

    @property
    def latest_render_seconds(self) -> float | None:
        if not self.render_costs:
            return None
        latest = max(self.render_costs, key=lambda cost: cost.created_at)
        return latest.render_seconds
