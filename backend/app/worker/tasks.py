from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.job import JobStage, JobStatus, SyncJob
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

        _set_progress(db, job, status=JobStatus.processing, stage=JobStage.transcribing, progress=20)
        job.transcript_text = transcriber.transcribe(job.media_asset.storage_path, job.source_language)
        db.commit()

        _set_progress(db, job, status=JobStatus.processing, stage=JobStage.translating, progress=55)
        job.translated_text = translator.translate(job.transcript_text or "", job.target_language)
        db.commit()

        _set_progress(db, job, status=JobStatus.processing, stage=JobStage.rendering, progress=85)
        job.render_path = renderer.render(job.id, job.media_asset.storage_path, job.translated_text or "")
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
