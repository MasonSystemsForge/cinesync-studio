from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
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
        job.render_path = renderer.render(job.id, job.media_asset.storage_path, job.translated_text or "")
        if job.project is not None:
            db.add(
                RenderVariant(
                    project=job.project,
                    job=job,
                    label="Draft render v1",
                    status=ExportStatus.ready,
                    render_path=job.render_path,
                    render_metadata={
                        "provider": "mock_render",
                        "aspect_ratio": job.project.aspect_ratio,
                        "resolution": job.project.resolution,
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
