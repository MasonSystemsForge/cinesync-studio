import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.billing import CreditLedgerEntry, LedgerEntryType, RenderCost
from app.models.job import JobStage, JobStatus, SyncJob
from app.models.media import MediaAsset
from app.models.project import (
    Export,
    ExportStatus,
    Project,
    ProjectStatus,
    PromptRun,
    RenderVariant,
    ReviewDecision,
    ReviewStatus,
    Scene,
    SceneStatus,
    SubtitleSegment,
)

DEMO_PROJECT_NAME = "Demo - Product Launch Trailer"


def seed_demo_workspace(db: Session) -> list[Project]:
    existing = db.query(Project).filter(Project.name == DEMO_PROJECT_NAME).first()
    if existing is not None:
        return db.query(Project).order_by(Project.created_at.desc()).limit(6).all()

    settings = get_settings()
    settings.render_dir.mkdir(parents=True, exist_ok=True)
    demo_render = settings.render_dir / "demo-product-launch-render.json"
    demo_render.write_text(
        json.dumps(
            {
                "project": DEMO_PROJECT_NAME,
                "status": "ready",
                "note": "Seeded demo artifact for local product review.",
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    launch_asset = MediaAsset(
        original_filename="product-launch-master.mov",
        content_type="video/mp4",
        size_bytes=84_200_000,
        storage_path=str(demo_render),
        duration_ms=45_000,
        width=1920,
        height=1080,
        frame_rate="30/1",
    )
    launch_project = Project(
        media_asset=launch_asset,
        name=DEMO_PROJECT_NAME,
        brief="Create a Spanish LATAM launch trailer with crisp subtitles, premium voice direction, and review-ready export metadata.",
        source_language="en",
        target_language="es-LATAM",
        status=ProjectStatus.review,
        aspect_ratio="16:9",
        resolution="1080p",
        caption_style="Premium lower third",
        voice_profile="Neutral brand narrator",
    )
    launch_scenes = [
        Scene(title="Hook", sort_order=0, start_ms=0, end_ms=8000, status=SceneStatus.approved, prompt="Open with the product promise."),
        Scene(title="Problem", sort_order=1, start_ms=8000, end_ms=18000, status=SceneStatus.approved, prompt="Frame the launch pain point."),
        Scene(title="Product", sort_order=2, start_ms=18000, end_ms=34000, status=SceneStatus.draft, prompt="Show features with tight captions."),
        Scene(title="CTA", sort_order=3, start_ms=34000, end_ms=45000, status=SceneStatus.queued, prompt="Close with a confident call to action."),
    ]
    launch_project.scenes = launch_scenes
    launch_project.subtitles = [
        SubtitleSegment(scene=launch_scenes[0], sort_order=0, start_ms=3120, end_ms=6400, source_text="Meet the workflow that keeps global launches moving.", translated_text="Presenta el flujo que mantiene los lanzamientos globales en marcha.", status=ReviewStatus.approved),
        SubtitleSegment(scene=launch_scenes[1], sort_order=1, start_ms=12080, end_ms=16720, source_text="Generate localized edits without rebuilding your production stack.", translated_text="Genera versiones localizadas sin reconstruir tu stack de produccion.", status=ReviewStatus.pending),
        SubtitleSegment(scene=launch_scenes[2], sort_order=2, start_ms=27100, end_ms=31900, source_text="Review, approve, and export every variant from one place.", translated_text="Revisa, aprueba y exporta cada variante desde un solo lugar.", status=ReviewStatus.pending),
    ]
    launch_project.prompt_runs = [
        PromptRun(prompt="Generate a Spanish LATAM launch trailer with cinematic pacing, safe subtitles, and brand-safe product terminology.", mode="text_media", model_name="CineSync v1 Enterprise", status="completed")
    ]
    launch_project.review_decisions = [
        ReviewDecision(reviewer="Creative Lead", status=ReviewStatus.pending, notes="Review subtitle row two and final CTA before export.")
    ]
    launch_job = SyncJob(
        project=launch_project,
        media_asset=launch_asset,
        source_language="en",
        target_language="es-LATAM",
        status=JobStatus.completed,
        stage=JobStage.completed,
        progress=100,
        transcript_text="Mock demo transcript for product-launch-master.mov.",
        translated_text="[es-LATAM] Mock demo transcript for product-launch-master.mov.",
        render_path=str(demo_render),
        completed_at=datetime.now(UTC),
    )
    launch_project.render_variants = [
        RenderVariant(job=launch_job, label="Draft render v1", status=ExportStatus.ready, render_path=str(demo_render), render_metadata={"provider": "demo", "estimated_cost_usd": 2.4, "credits_used": 240})
    ]
    launch_project.exports = [Export(format="json", status=ExportStatus.ready, output_path=str(demo_render))]
    db.add(launch_job)
    db.flush()
    db.add(RenderCost(project=launch_project, job=launch_job, estimated_cost_usd=2.4, credits_used=240, render_seconds=68))
    db.add(CreditLedgerEntry(project=launch_project, job=launch_job, entry_type=LedgerEntryType.debit, credits=240, amount_usd=2.4, description="Demo launch trailer render"))

    podcast_asset = MediaAsset(
        original_filename="podcast-clip.wav",
        content_type="audio/wav",
        size_bytes=18_500_000,
        storage_path=str(demo_render),
        duration_ms=62_000,
        width=None,
        height=None,
        frame_rate=None,
    )
    podcast_project = Project(
        media_asset=podcast_asset,
        name="Demo - Podcast Avatar Clip",
        brief="Convert a podcast highlight into an avatar-led social clip with captions.",
        source_language="en",
        target_language="en",
        status=ProjectStatus.processing,
        aspect_ratio="9:16",
        resolution="1080p",
        caption_style="Bold social captions",
        voice_profile="Original host voice",
    )
    podcast_project.scenes = [
        Scene(title="Cold open", sort_order=0, start_ms=0, end_ms=12000, status=SceneStatus.generating, prompt="Open with the strongest quote."),
        Scene(title="Avatar beat", sort_order=1, start_ms=12000, end_ms=42000, status=SceneStatus.draft, prompt="Add avatar framing and caption emphasis."),
    ]
    podcast_project.prompt_runs = [PromptRun(prompt="Create a vertical avatar podcast clip with bold captions and energetic pacing.", status="queued")]
    podcast_project.review_decisions = [ReviewDecision(reviewer="Producer", status=ReviewStatus.pending, notes="Needs avatar review after render.")]
    podcast_project.exports = [Export(format="mp4", status=ExportStatus.pending)]
    podcast_job = SyncJob(
        project=podcast_project,
        media_asset=podcast_asset,
        source_language="en",
        target_language="en",
        status=JobStatus.processing,
        stage=JobStage.rendering,
        progress=72,
        transcript_text="Demo podcast transcript is ready.",
        translated_text="Demo podcast transcript is ready.",
    )
    db.add(podcast_job)

    db.commit()
    return db.query(Project).order_by(Project.created_at.desc()).limit(6).all()
