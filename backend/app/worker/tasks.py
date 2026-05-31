from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.billing import CreditLedgerEntry, LedgerEntryType, RenderCost
from app.models.job import JobStage, JobStatus, SyncJob
from app.models.project import ExportStatus, ProjectStatus, RenderVariant, ReviewStatus, SubtitleSegment
from app.providers.mock_ai import MockSpeechToTextProvider, MockTranslationProvider
from app.providers.mock_render import MockRenderProvider
from app.worker.celery_app import celery_app


def _set_progress(
    db: Session,
    job: SyncJob,
    *,
    status: JobStatus,
    stage: JobStage,
    progress: int,
    error_message: str | None = None,
) -> None:
    job.status = status
    job.stage = stage
    job.progress = progress
    job.error_message = error_message
    db.add(job)
    db.commit()
    db.refresh(job)


def _estimate_render_cost(job: SyncJob) -> tuple[float, float, float]:
    media_mb = max(1.0, job.media_asset.size_bytes / 1024 / 1024)
    duration_seconds = max(1.0, (job.media_asset.duration_ms or 45000) / 1000)
    render_seconds = max(1.0, duration_seconds * 0.35)
    estimated_cost_usd = round(0.35 + media_mb * 0.015 + render_seconds * 0.025, 2)
    credits_used = round(estimated_cost_usd * 100, 2)
    return estimated_cost_usd, credits_used, render_seconds


@celery_app.task(name="jobs.process")
def process_job(job_id: str) -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        job = db.get(SyncJob, UUID(job_id))
        if job is None:
            return

        transcriber = MockSpeechToTextProvider(settings.mock_provider_latency_seconds)
        translator = MockTranslationProvider(settings.mock_provider_latency_seconds)
        renderer = MockRenderProvider(settings.render_dir, settings.mock_provider_latency_seconds)

        if job.project is not None:
            job.project.status = ProjectStatus.processing
            db.add(job.project)
            db.commit()

        _set_progress(db, job, status=JobStatus.processing, stage=JobStage.transcribing, progress=20)
        job.transcript_text = transcriber.transcribe(job.media_asset.storage_path, job.source_language)
        db.commit()

        _set_progress(db, job, status=JobStatus.processing, stage=JobStage.translating, progress=55)
        job.translated_text = translator.translate(job.transcript_text or "", job.target_language)
        if job.project is not None and not job.project.subtitles:
            scene_lookup = {scene.sort_order: scene for scene in job.project.scenes}
            source_lines = [
                "Meet the workflow that keeps global launches moving.",
                "Generate localized edits without rebuilding your production stack.",
                "Review, approve, and export every variant from one place.",
            ]
            target_lines = [
                job.translated_text or "",
                f"[{job.target_language}] Captions are prepared for safe-frame review.",
                f"[{job.target_language}] Render metadata is ready for approval.",
            ]
            for index, (source_text, translated_text) in enumerate(zip(source_lines, target_lines, strict=True)):
                db.add(
                    SubtitleSegment(
                        project=job.project,
                        scene=scene_lookup.get(index),
                        sort_order=index,
                        start_ms=[3120, 12080, 27100][index],
                        end_ms=[6400, 16720, 31900][index],
                        source_text=source_text,
                        translated_text=translated_text,
                        status=ReviewStatus.pending,
                    )
                )
        db.commit()

        _set_progress(db, job, status=JobStatus.processing, stage=JobStage.rendering, progress=85)
        subtitle_payload = []
        if job.project is not None:
            subtitle_payload = [
                {
                    "start_ms": subtitle.start_ms,
                    "end_ms": subtitle.end_ms,
                    "text": subtitle.translated_text,
                }
                for subtitle in job.project.subtitles
            ]
        render_result = renderer.render(
            job.id,
            job.media_asset.storage_path,
            job.translated_text or "",
            subtitle_payload,
        )
        job.render_path = render_result.output_path
        estimated_cost_usd, credits_used, render_seconds = _estimate_render_cost(job)
        db.add(
            RenderCost(
                project=job.project,
                job=job,
                estimated_cost_usd=estimated_cost_usd,
                credits_used=credits_used,
                render_seconds=render_seconds,
            )
        )
        db.add(
            CreditLedgerEntry(
                project=job.project,
                job=job,
                entry_type=LedgerEntryType.debit,
                credits=credits_used,
                amount_usd=estimated_cost_usd,
                description="Mock render usage",
            )
        )
        if job.project is not None:
            db.add(
                RenderVariant(
                    project=job.project,
                    job=job,
                    label="Draft render v1",
                    status=ExportStatus.ready,
                    render_path=job.render_path,
                    render_metadata=render_result.metadata
                    | {
                        "aspect_ratio": job.project.aspect_ratio,
                        "resolution": job.project.resolution,
                        "estimated_cost_usd": estimated_cost_usd,
                        "credits_used": credits_used,
                    },
                )
            )
            job.project.status = ProjectStatus.review
            for export in job.project.exports:
                export.status = ExportStatus.ready
                export.output_path = job.render_path
                db.add(export)
            db.add(job.project)
        db.commit()

        job.status = JobStatus.completed
        job.stage = JobStage.completed
        job.progress = 100
        job.completed_at = datetime.now(UTC)
        db.add(job)
        db.commit()
    except Exception as exc:
        db.rollback()
        job = db.get(SyncJob, UUID(job_id))
        if job is not None:
            if job.project is not None:
                job.project.status = ProjectStatus.failed
                db.add(job.project)
                db.commit()
            _set_progress(
                db,
                job,
                status=JobStatus.failed,
                stage=JobStage.failed,
                progress=job.progress,
                error_message=str(exc),
            )
        raise
    finally:
        db.close()
