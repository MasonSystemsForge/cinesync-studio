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

const pipelineSteps = ["Brief", "Prompt", "Avatar", "Voice", "Render", "Review"];

function estimatedCost(job: SyncJob): string {
  const mb = Math.max(1, job.media_asset.size_bytes / 1024 / 1024);
  const cost = 0.42 + mb * 0.018 + job.progress * 0.003;
  return `$${cost.toFixed(2)}`;
}

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

  const latestJob = jobs[0];
  const editorHref = latestJob?.project_id ? `/projects/${latestJob.project_id}` : "/upload";
  const successRate = useMemo(() => {
    if (summary.total_jobs === 0) return "100%";
    return `${Math.round((summary.completed / summary.total_jobs) * 100)}%`;
  }, [summary]);
  const latestCost = latestJob ? estimatedCost(latestJob) : "$0.00";
  const avgRenderTime = summary.completed > 0 ? "2m 48s" : "--";

  const stats = [
    { label: "Total Jobs", value: summary.total_jobs.toString(), meta: `${summary.processing} active` },
    { label: "Latest Cost", value: latestCost, meta: "Estimated render spend" },
    { label: "Avg Render Time", value: avgRenderTime, meta: "Last completed jobs" },
    { label: "Success Rate", value: successRate, meta: `${summary.failed} failed` }
  ];

  return (
    <section className="dashboard-grid">
      <div className="dashboard-main">
        <section className="hero-card clean-hero">
          <div>
            <span className="eyebrow">AI video generation</span>
            <h2>Create your next synced AI video</h2>
            <p>
              Plan, price, render, and review AI video jobs from one focused workspace. Built for synced
              podcast clips, avatars, voice passes, subtitles, and export-ready localized variants.
            </p>
            <div className="hero-actions">
              <Link href="/upload" className="button">Create Render</Link>
              <Link href={editorHref} className="button button-secondary">Open Editor</Link>
              <Link href="#jobs" className="button button-ghost">View Jobs</Link>
            </div>
          </div>
          <div className="hero-preview-card">
            <div className="preview-toolbar">
              <span>Render preview</span>
              <strong>16:9</strong>
            </div>
            <div className="mini-video-frame">
              <span className="play-dot">Play</span>
              <div className="caption-chip">Synced subtitle preview</div>
            </div>
          </div>
        </section>

        {error ? <div className="error">Backend unavailable: {error}</div> : null}

        <section className="stats-row" aria-label="Studio stats">
          {stats.map((stat) => (
            <div className="stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.meta}</small>
            </div>
          ))}
        </section>

        <section className="panel pipeline-panel" id="pipeline">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Pipeline</span>
              <h2>Brief to review workflow</h2>
            </div>
            <span className="chip lime-chip">Live mock providers</span>
          </div>
          <div className="pipeline-steps">
            {pipelineSteps.map((step, index) => (
              <div className={`pipeline-step ${index <= 2 ? "active" : ""}`} key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel jobs-panel" id="jobs">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Recent Jobs</span>
              <h2>Render activity</h2>
            </div>
            <Link href="/upload" className="button button-secondary button-small">Create Render</Link>
          </div>

          <div className="jobs-table">
            <div className="jobs-row jobs-head">
              <span>Job</span>
              <span>Status</span>
              <span>Cost</span>
              <span>Date</span>
              <span>Progress</span>
              <span>Action</span>
            </div>
            {jobs.length === 0 ? (
              <div className="empty-state">No render jobs yet. Create your first AI video render to populate this table.</div>
            ) : (
              jobs.slice(0, 8).map((job) => {
                const href = job.project_id ? `/projects/${job.project_id}` : `/jobs/${job.id}`;
                return (
                  <div className="jobs-row" key={job.id}>
                    <span className="job-name">
                      <strong>{job.media_asset.original_filename}</strong>
                      <small>{job.source_language} to {job.target_language} - {formatBytes(job.media_asset.size_bytes)}</small>
                    </span>
                    <StatusBadge status={job.status} />
                    <span>{estimatedCost(job)}</span>
                    <span>{new Date(job.created_at).toLocaleDateString()}</span>
                    <span><ProgressBar value={job.progress} /></span>
                    <Link href={href} className="table-action">Open</Link>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <aside className="right-panel">
        <section className="panel pricing-card" id="pricing">
          <span className="eyebrow">Pricing</span>
          <h2>Credits summary</h2>
          <div className="credit-meter">
            <div><span /></div>
            <strong>8,420 credits</strong>
            <small>Renews on the first of next month</small>
          </div>
          <div className="pricing-line"><span>Plan</span><strong>Studio Lite</strong></div>
          <div className="pricing-line"><span>Latest cost</span><strong>{latestCost}</strong></div>
          <div className="pricing-line"><span>Budget used</span><strong>41%</strong></div>
          <Link href="#pricing" className="button button-full">Buy Credits</Link>
        </section>

        <section className="panel tips-card" id="settings">
          <span className="eyebrow">Quick tips</span>
          <h2>Quick tips</h2>
          <ul>
            <li>Keep prompts specific: format, scene, voice, and audience.</li>
            <li>Upload clean source audio for stronger subtitle timing.</li>
            <li>Use review gates before exporting localized variants.</li>
          </ul>
        </section>

        <section className="panel balance-card">
          <span className="eyebrow">Cost control</span>
          <h2>Render estimate</h2>
          <p>Short social cut: <strong>$0.84</strong></p>
          <p>Launch trailer: <strong>$2.40</strong></p>
          <p>Long-form module: <strong>$6.20</strong></p>
        </section>
      </aside>
    </section>
  );
}
