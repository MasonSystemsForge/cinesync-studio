"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { SyncJob, fetchJson, formatBytes } from "@/lib/api";

const stages = ["upload", "transcribing", "translating", "rendering", "completed"] as const;

const stageCopy: Record<string, string> = {
  upload: "Source media is registered and ready for worker pickup",
  transcribing: "Speech-to-text provider is extracting the source script",
  translating: "Translation provider is adapting copy for the target locale",
  rendering: "FFmpeg-aware render provider is writing output metadata",
  completed: "Render metadata is ready for enterprise review",
  failed: "The worker reported a failure"
};

type JobProgressClientProps = {
  jobId: string;
};

export function JobProgressClient({ jobId }: JobProgressClientProps) {
  const [job, setJob] = useState<SyncJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadJob() {
      try {
        const nextJob = await fetchJson<SyncJob>(`/jobs/${jobId}`, { cache: "no-store" });
        if (!cancelled) {
          setJob(nextJob);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load job");
        }
      }
    }

    loadJob();
    const interval = window.setInterval(loadJob, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [jobId]);

  if (error && !job) {
    return (
      <section className="page-stack">
        <div className="panel">
          <div className="error">{error}</div>
        </div>
      </section>
    );
  }

  if (!job) {
    return (
      <section className="page-stack">
        <div className="panel">
          <p className="muted">Loading job...</p>
        </div>
      </section>
    );
  }

  const currentStageIndex = stages.includes(job.stage as (typeof stages)[number])
    ? stages.indexOf(job.stage as (typeof stages)[number])
    : -1;

  return (
    <section className="page-stack">
      <div className="hero-console">
        <div className="command-card">
          <span className="eyebrow">Generation control room</span>
          <h2 className="hero-title">{job.media_asset.original_filename}</h2>
          <p className="hero-copy">
            {job.source_language} to {job.target_language} - {formatBytes(job.media_asset.size_bytes)}. Monitor the
            job through provider stages, review generated text, and inspect render handoff metadata.
          </p>
          <div className="inline-actions">
            <StatusBadge status={job.status} />
            <span className="chip">Stage: {job.stage}</span>
            <span className="chip">SLA target: 5 min</span>
            <span className="chip">Updated: {new Date(job.updated_at).toLocaleTimeString()}</span>
          </div>
          <ProgressBar value={job.progress} />
          <p className="muted">{job.progress}% complete</p>
          {error ? <div className="error">Refresh failed: {error}</div> : null}
        </div>

        <div className="preview-monitor">
          <div className="monitor-toolbar">
            <span className="eyebrow">Review player</span>
            <span className="chip">Safe zones enabled</span>
          </div>
          <div className="monitor-stage">
            <div className="monitor-toolbar">
              <span className="chip">{job.target_language.toUpperCase()} draft</span>
              <span className="chip">{job.status}</span>
            </div>
            <div className="monitor-window">
              <span className="play-button">Play</span>
            </div>
            <div className="timeline-scrub">
              <span>00:00</span>
              <div className="scrub-line"><span /></div>
              <span>Render</span>
            </div>
          </div>
        </div>
      </div>

      <div className="job-detail-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Pipeline telemetry</span>
              <h2>Provider execution</h2>
            </div>
            <span className="chip">Celery worker</span>
          </div>
          <div className="timeline">
            {stages.map((stage, index) => {
              const active = job.stage === stage;
              const done = currentStageIndex > index;
              return (
                <div className={`timeline-item ${active ? "active" : ""}`} key={stage}>
                  <div>
                    <strong>{stage}</strong>
                    <p className="muted">{stageCopy[stage]}</p>
                  </div>
                  <span className="chip">{active ? "Active" : done ? "Done" : "Waiting"}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="inspector-card">
          <span className="eyebrow">Inspector</span>
          <h2>Source and governance</h2>
          <div className="timeline">
            <div className="timeline-item">
              <strong>Content type</strong>
              <span className="muted">{job.media_asset.content_type ?? "Unknown"}</span>
            </div>
            <div className="timeline-item">
              <strong>Created</strong>
              <span className="muted">{new Date(job.created_at).toLocaleString()}</span>
            </div>
            <div className="timeline-item">
              <strong>Completed</strong>
              <span className="muted">{job.completed_at ? new Date(job.completed_at).toLocaleString() : "Pending"}</span>
            </div>
            <div className="timeline-item">
              <strong>Review gate</strong>
              <span className="chip">Owner approval</span>
            </div>
          </div>
        </div>
      </div>

      <div className="output-grid">
        <div className="output-card">
          <span className="eyebrow">Transcript</span>
          <h3>Source script</h3>
          <pre>{job.transcript_text ?? "Waiting for speech-to-text provider output..."}</pre>
        </div>
        <div className="output-card">
          <span className="eyebrow">Translation</span>
          <h3>Target copy</h3>
          <pre>{job.translated_text ?? "Waiting for translation provider output..."}</pre>
        </div>
        <div className="output-card">
          <span className="eyebrow">Render handoff</span>
          <h3>Artifact</h3>
          <pre>{job.render_path ?? "Waiting for render provider artifact..."}</pre>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">System log</span>
            <h2>Execution trace</h2>
          </div>
          <span className="chip">Mock provider mode</span>
        </div>
        <div className="log-console">
          [{new Date(job.created_at).toISOString()}] upload accepted for {job.media_asset.original_filename}\n
          [{new Date(job.updated_at).toISOString()}] current stage: {job.stage}\n
          [{new Date().toISOString()}] polling /jobs/{job.id} every 2500ms
        </div>
      </div>

      {job.error_message ? <div className="error">{job.error_message}</div> : null}

      <div className="inline-actions">
        <Link href="/dashboard" className="button button-secondary">
          Back to command center
        </Link>
        <Link href="/upload" className="button">
          Create another generation
        </Link>
      </div>
    </section>
  );
}
