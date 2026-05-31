"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { SyncJob, fetchJson, formatBytes } from "@/lib/api";

const stages = ["upload", "transcribing", "translating", "rendering", "completed"] as const;

const stageCopy: Record<string, string> = {
  upload: "Media accepted and job created",
  transcribing: "Mock speech provider extracts source transcript",
  translating: "Mock translation provider adapts the text",
  rendering: "FFmpeg-aware mock render writes an artifact",
  completed: "Localized render metadata is ready",
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
      <div className="hero-card">
        <div>
          <span className="eyebrow">Generation detail</span>
          <h2 className="hero-title">{job.media_asset.original_filename}</h2>
          <p className="hero-copy">
            {job.source_language} to {job.target_language} - {formatBytes(job.media_asset.size_bytes)}. Follow the
            job as it moves through the mocked CineSync provider chain.
          </p>
          <div className="inline-actions">
            <StatusBadge status={job.status} />
            <span className="chip">Stage: {job.stage}</span>
            <span className="chip">Updated: {new Date(job.updated_at).toLocaleTimeString()}</span>
          </div>
          <div style={{ marginTop: 24 }}>
            <ProgressBar value={job.progress} />
          </div>
          <p className="muted">{job.progress}% complete</p>
          {error ? <div className="error">Refresh failed: {error}</div> : null}
        </div>
        <div className="preview-grid">
          <div className="preview-tile large">
            <span className="preview-label">Localized preview</span>
          </div>
          <div className="preview-tile">
            <span className="preview-label">Render artifact monitor</span>
          </div>
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <span className="eyebrow">Pipeline</span>
          <h2>Live progress</h2>
          <div className="timeline">
            {stages.map((stage, index) => {
              const active = job.stage === stage;
              const done = currentStageIndex > index;
              return (
                <div className={`timeline-item ${active ? "active" : ""}`} key={stage}>
                  <div>
                    <strong>{stage}</strong>
                    <p className="muted" style={{ marginBottom: 0 }}>{stageCopy[stage]}</p>
                  </div>
                  <span className="chip">{active ? "Active" : done ? "Done" : "Waiting"}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <span className="eyebrow">Asset details</span>
          <h2>Source media</h2>
          <div className="timeline">
            <div className="timeline-item">
              <strong>File type</strong>
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
          </div>
        </div>
      </div>

      <div className="output-grid">
        <div className="output-card">
          <span className="eyebrow">Transcript</span>
          <pre>{job.transcript_text ?? "Waiting for mock transcription..."}</pre>
        </div>
        <div className="output-card">
          <span className="eyebrow">Translation</span>
          <pre>{job.translated_text ?? "Waiting for mock translation..."}</pre>
        </div>
        <div className="output-card">
          <span className="eyebrow">Render</span>
          <pre>{job.render_path ?? "Waiting for mock render..."}</pre>
        </div>
      </div>

      {job.error_message ? <div className="error">{job.error_message}</div> : null}

      <div className="inline-actions">
        <Link href="/dashboard" className="button button-secondary">
          Back to dashboard
        </Link>
        <Link href="/upload" className="button">
          Create another
        </Link>
      </div>
    </section>
  );
}
