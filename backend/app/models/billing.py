import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class LedgerEntryType(str, enum.Enum):
    credit = "credit"
    debit = "debit"


class CreditLedgerEntry(Base):
    __tablename__ = "credit_ledger_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sync_jobs.id"), nullable=True, index=True)
    entry_type: Mapped[LedgerEntryType] = mapped_column(Enum(LedgerEntryType), default=LedgerEntryType.debit)
    credits: Mapped[float] = mapped_column(Float, default=0.0)
    amount_usd: Mapped[float] = mapped_column(Float, default=0.0)
    description: Mapped[str] = mapped_column(String(255), default="Render usage")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    project = relationship("Project", back_populates="credit_ledger_entries")
    job = relationship("SyncJob", back_populates="credit_ledger_entries")


class RenderCost(Base):
    __tablename__ = "render_costs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sync_jobs.id"), nullable=False, index=True)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    credits_used: Mapped[float] = mapped_column(Float, default=0.0)
    render_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    project = relationship("Project", back_populates="render_costs")
    job = relationship("SyncJob", back_populates="render_costs")
