"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

const models = [
  { name: "CineSync v1", tag: "Localization", text: "Balanced transcript, translation, and render metadata pipeline." },
  { name: "Trailer Boost", tag: "Creative", text: "Sharper pacing language for launch cuts and teasers." },
  { name: "Lecture Clean", tag: "Education", text: "Readable timing and glossary-safe adaptation." },
  { name: "Compliance Pass", tag: "Review", text: "Enterprise QA preset for regulated video workflows." }
];

const assets = [
  { title: "Hero trailer source", meta: "16:9 - 00:45 - MOV" },
  { title: "Spanish launch brief", meta: "Glossary - Brand terms" },
  { title: "Caption safe zones", meta: "Preset - Social + OTT" }
];

const generations = [
  { title: "Localized product reveal", meta: "ES subtitles - 1080p" },
  { title: "Training module draft", meta: "FR transcript - QA pending" },
  { title: "Social teaser batch", meta: "DE copy pass - 9:16" },
  { title: "Executive recap", meta: "JA adaptation - Rendered" }
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

  const stats = useMemo(
    () => [
      ["Total jobs", summary.total_jobs, "+12.4% throughput"],
      ["Queued", summary.queued, "SLA monitored"],
      ["Rendering", summary.processing, "Celery active"],
      ["Completed", summary.completed, "Ready for review"],
      ["Failed", summary.failed, "Needs triage"]
    ] as const,
    [summary]
  );

  return (
    <section className="page-stack">
      <div className="hero-console">
        <div className="command-card">
          <div>
            <span className="eyebrow">Generation command center</span>
            <h2 className="hero-title">Produce localized video variants with operator-grade control.</h2>
            <p className="hero-copy">
              Brief the pipeline, select a model preset, queue media, and monitor each job through transcription,
              translation, and FFmpeg-ready render handoff.
            </p>
          </div>

          <div className="prompt-composer">
            <textarea defaultValue="Create a Spanish launch trailer cut with concise subtitles, preserve product names, and keep a cinematic high-energy tone." />
            <div className="composer-footer">
              <div className="segmented" aria-label="Generation mode">
                <span className="active">Text + media</span>
                <span>Subtitle pass</span>
                <span>Dubbing brief</span>
              </div>
              <Link href="/upload" className="button">
                Generate video
              </Link>
            </div>
          </div>

          <div className="settings-grid">
            {[
              ["Aspect", "16:9"],
              ["Duration", "45 sec"],
              ["Resolution", "1080p"],
              ["Safety", "Brand locked"]
            ].map(([label, value], index) => (
              <div className={`setting-card ${index === 0 ? "active" : ""}`} key={label}>
                <span className="muted">{label}</span>
                <h3>{value}</h3>
              </div>
            ))}
          </div>
        </div>

        <div className="preview-monitor">
          <div className="monitor-toolbar">
            <span className="eyebrow">Live preview</span>
            <span className="chip">Safe frame on</span>
          </div>
          <div className="monitor-stage">
            <div className="monitor-toolbar">
              <span className="chip">Scene 03</span>
              <span className="chip">Draft render</span>
            </div>
            <div className="monitor-window">
              <span className="play-button">Play</span>
            </div>
            <div className="timeline-scrub">
              <span>00:18</span>
              <div className="scrub-line"><span /></div>
              <span>00:45</span>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="error">Backend unavailable: {error}</div> : null}

      <div className="stats-grid">
        {stats.map(([label, value, delta]) => (
          <div className="stat-card" key={label}>
            <span className="muted">{label}</span>
            <span className="stat-value">{value}</span>
            <span className="stat-delta">{delta}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Model presets</span>
            <h2>Production controls</h2>
          </div>
          <div className="segmented">
            <span className="active">Recommended</span>
            <span>Fast</span>
            <span>Quality</span>
          </div>
        </div>
        <div className="model-grid">
          {models.map((model, index) => (
            <div className={`model-card ${index === 0 ? "active" : ""}`} key={model.name}>
              <span className="card-kicker">{model.tag}</span>
              <h3>{model.name}</h3>
              <p>{model.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="ops-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Render operations</span>
              <h2>Live job queue</h2>
            </div>
            <Link href="/upload" className="button button-secondary">New job</Link>
          </div>
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
          <span className="eyebrow">Source kit</span>
          <h2>Workspace assets</h2>
          <div className="asset-grid" style={{ gridTemplateColumns: "1fr" }}>
            {assets.map((asset) => (
              <Link href="/upload" className="asset-card" key={asset.title}>
                <div className="asset-thumb" />
                <h3>{asset.title}</h3>
                <p>{asset.meta}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Generation board</span>
            <h2>Recent video variants</h2>
          </div>
          <span className="chip">Enterprise review mode</span>
        </div>
        <div className="generation-grid">
          {generations.map((item) => (
            <div className="generation-card" key={item.title}>
              <div className="generation-thumb" />
              <h3>{item.title}</h3>
              <p>{item.meta}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
