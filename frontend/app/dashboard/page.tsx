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

const tools = [
  { title: "Video translation", kicker: "Core", text: "Create target-language scripts from uploaded source media." },
  { title: "Subtitle timing", kicker: "Assist", text: "Prepare caption-ready passes from mock transcript output." },
  { title: "Voice direction", kicker: "Creative", text: "Capture tone notes before production dubbing providers are connected." },
  { title: "Render review", kicker: "FFmpeg", text: "Track the mock render artifact and handoff metadata." }
];

const templates = [
  { title: "Product launch trailer", text: "Short-form marketing localization with punchy subtitles." },
  { title: "Course module", text: "Long-form educational voice and caption adaptation." },
  { title: "Social cutdown", text: "Fast translation workflow for vertical clips and teasers." }
];

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
    <section className="page-stack">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Create like an AI studio</span>
          <h2 className="hero-title">Turn source footage into localized story assets.</h2>
          <p className="hero-copy">
            Upload a clip, queue the mock AI pipeline, and watch transcription, translation, and FFmpeg-ready
            render metadata move through a creator-first workspace.
          </p>
          <div className="hero-actions">
            <Link href="/upload" className="button">
              Create localization
            </Link>
            <a href="http://localhost:8000/docs" className="button button-secondary">
              API docs
            </a>
          </div>
          <div className="chip-row" style={{ marginTop: 18 }}>
            <span className="chip">FastAPI</span>
            <span className="chip">Celery queue</span>
            <span className="chip">Mock providers</span>
            <span className="chip">FFmpeg aware</span>
          </div>
        </div>
        <div className="preview-grid">
          <div className="preview-tile large">
            <span className="preview-label">Studio canvas</span>
          </div>
          <div className="preview-tile">
            <span className="preview-label">Localized cut preview</span>
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
        <div className="inline-actions" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <span className="eyebrow">Creation tools</span>
            <h2>Choose a workflow</h2>
          </div>
          <Link href="/upload" className="button button-secondary">
            New upload
          </Link>
        </div>
        <div className="tools-grid">
          {tools.map((tool) => (
            <div className="tool-card" key={tool.title}>
              <span className="card-kicker">{tool.kicker}</span>
              <h3>{tool.title}</h3>
              <span>{tool.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <span className="eyebrow">Recent generations</span>
          <h2>Job queue</h2>
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

        <div className="panel">
          <span className="eyebrow">Templates</span>
          <h2>Start from a style</h2>
          <div className="templates-grid" style={{ gridTemplateColumns: "1fr" }}>
            {templates.map((template) => (
              <Link href="/upload" className="template-card" key={template.title}>
                <span className="card-kicker">Preset</span>
                <h3>{template.title}</h3>
                <span>{template.text}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
