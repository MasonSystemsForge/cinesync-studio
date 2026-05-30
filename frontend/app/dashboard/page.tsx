"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { DashboardSummary, SyncJob, fetchJson, formatBytes } from "@/lib/api";

const emptySummary: DashboardSummary = {
  total_jobs: 0,
  queued: 0,
  processing: 0,
  completed: 0,
  failed: 0
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const [nextSummary, nextJobs] = await Promise.all([
          fetchJson<DashboardSummary>("/dashboard/summary", { cache: "no-store" }),
          fetchJson<SyncJob[]>("/jobs", { cache: "no-store" })
        ]);
        if (!cancelled) {
          setSummary(nextSummary);
          setJobs(nextJobs);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard data");
        }
      }
    }

    loadDashboard();
    const interval = window.setInterval(loadDashboard, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const stats = [
    ["Total", summary.total_jobs],
    ["Queued", summary.queued],
    ["Processing", summary.processing],
    ["Completed", summary.completed],
    ["Failed", summary.failed]
  ] as const;

  return (
    <section className="grid">
      <div className="hero">
        <div>
          <p className="eyebrow">Localization command center</p>
          <h1>Sync, translate, and render video workflows.</h1>
          <p>
            Track CineSync Studio jobs as they move from upload to mock transcription, mock translation,
            and FFmpeg-ready render output.
          </p>
          <Link href="/upload" className="button">
            Start a job
          </Link>
        </div>
        <div className="panel">
          <h2>Pipeline</h2>
          <p className="muted">Upload media, queue Celery, simulate providers, and monitor progress.</p>
          <div className="timeline">
            {["Upload", "Transcribe", "Translate", "Render"].map((item) => (
              <div className="timeline-item" key={item}>
                <strong>{item}</strong>
                <span className="muted">Ready</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error ? <div className="error">Backend unavailable: {error}</div> : null}

      <div className="stats-grid">
        {stats.map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span className="muted">{label}</span>
            <span className="stat-value">{value}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Recent jobs</h2>
        <div className="jobs-list">
          {jobs.length === 0 ? (
            <p className="muted">No jobs yet. Upload a file to kick off the first localization run.</p>
          ) : (
            jobs.map((job) => (
              <Link href={`/jobs/${job.id}`} className="job-card" key={job.id}>
                <div>
                  <div className="job-title">{job.media_asset.original_filename}</div>
                  <div className="muted">
                    {job.source_language} to {job.target_language} - {formatBytes(job.media_asset.size_bytes)}
                  </div>
                </div>
                <StatusBadge status={job.status} />
                <ProgressBar value={job.progress} />
                <strong>{job.progress}%</strong>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
