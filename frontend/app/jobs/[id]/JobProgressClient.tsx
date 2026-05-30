"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { SyncJob, fetchJson, formatBytes } from "@/lib/api";

const stages = ["upload", "transcribing", "translating", "rendering", "completed"] as const;

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
      <section className="panel">
        <div className="error">{error}</div>
      </section>
    );
  }

  if (!job) {
    return (
      <section className="panel">
        <p className="muted">Loading job...</p>
      </section>
    );
  }

  return (
    <section className="grid">
      <div className="panel">
        <p className="eyebrow">Job progress</p>
        <h1>{job.media_asset.original_filename}</h1>
        <p>
          {job.source_language} to {job.target_language} - {formatBytes(job.media_asset.size_bytes)}
        </p>
        <StatusBadge status={job.status} />
        <div style={{ marginTop: 24 }}>
          <ProgressBar value={job.progress} />
        </div>
        <p className="muted">{job.progress}% complete</p>
        {error ? <div className="error">Refresh failed: {error}</div> : null}
      </div>

      <div className="panel">
        <h2>Pipeline status</h2>
        <div className="timeline">
          {stages.map((stage) => {
            const active = job.stage === stage;
            const done = stages.indexOf(job.stage as (typeof stages)[number]) > stages.indexOf(stage);
            return (
              <div className="timeline-item" key={stage}>
                <strong>{stage}</strong>
                <span className="muted">{active ? "Active" : done ? "Done" : "Waiting"}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2>Provider output</h2>
        <h3>Transcript</h3>
        <pre>{job.transcript_text ?? "Waiting for mock transcription..."}</pre>
        <h3>Translation</h3>
        <pre>{job.translated_text ?? "Waiting for mock translation..."}</pre>
        <h3>Render artifact</h3>
        <pre>{job.render_path ?? "Waiting for mock render..."}</pre>
        {job.error_message ? <div className="error">{job.error_message}</div> : null}
      </div>

      <Link href="/dashboard" className="button secondary">
        Back to dashboard
      </Link>
    </section>
  );
}
