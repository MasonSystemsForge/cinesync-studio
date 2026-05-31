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

const sourceAssets = [
  { name: "launch_master.mov", type: "Source clip", duration: "00:45", ratio: "16:9" },
  { name: "brand_terms.csv", type: "Glossary", duration: "142 terms", ratio: "Locked" },
  { name: "speaker_ref.wav", type: "Voice ref", duration: "00:18", ratio: "Clean" },
  { name: "safe_zones.png", type: "Overlay", duration: "OTT", ratio: "16:9" }
];

const sceneStrips = [
  { label: "Hook", time: "00:00", status: "Approved", width: "18%" },
  { label: "Problem", time: "00:08", status: "Draft", width: "22%" },
  { label: "Product", time: "00:18", status: "Generating", width: "26%" },
  { label: "CTA", time: "00:34", status: "Queued", width: "20%" },
  { label: "End card", time: "00:41", status: "Queued", width: "14%" }
];

const subtitleRows = [
  { start: "00:03.12", end: "00:06.40", source: "Meet the workflow that keeps global launches moving.", target: "Presenta el flujo que mantiene los lanzamientos globales en marcha." },
  { start: "00:12.08", end: "00:16.72", source: "Generate localized edits without rebuilding your production stack.", target: "Genera versiones localizadas sin reconstruir tu stack de produccion." },
  { start: "00:27.10", end: "00:31.90", source: "Review, approve, and export every variant from one place.", target: "Revisa, aprueba y exporta cada variante desde un solo lugar." }
];

const inspectorSettings = [
  ["Model", "CineSync v1 Enterprise"],
  ["Locale", "Spanish - LATAM"],
  ["Aspect", "16:9 primary, 9:16 safe"],
  ["Caption style", "Premium lower third"],
  ["Voice", "Neutral brand narrator"],
  ["Review policy", "Legal + owner approval"]
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
      ["Active jobs", summary.queued + summary.processing],
      ["Completed", summary.completed],
      ["Failed", summary.failed],
      ["Total", summary.total_jobs]
    ] as const,
    [summary]
  );

  return (
    <section className="page-stack editor-page">
      <div className="editor-shell">
        <aside className="asset-rail">
          <div className="panel-header compact">
            <div>
              <span className="eyebrow">Source bin</span>
              <h2>Project assets</h2>
            </div>
            <Link href="/upload" className="button button-small button-secondary">Import</Link>
          </div>

          <div className="asset-bin-list">
            {sourceAssets.map((asset, index) => (
              <button className={`asset-bin-item ${index === 0 ? "active" : ""}`} key={asset.name} type="button">
                <span className="asset-thumb-mini" />
                <span>
                  <strong>{asset.name}</strong>
                  <small>{asset.type} - {asset.duration} - {asset.ratio}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="rail-section">
            <span className="eyebrow">Queue health</span>
            <div className="mini-stat-grid">
              {stats.map(([label, value]) => (
                <div className="mini-stat" key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rail-section">
            <span className="eyebrow">Review gates</span>
            {[
              ["Brand glossary", "Locked"],
              ["Subtitle QA", "Required"],
              ["Legal approval", "Before export"]
            ].map(([label, value]) => (
              <div className="review-row" key={label}>
                <strong>{label}</strong>
                <span className="chip">{value}</span>
              </div>
            ))}
          </div>
        </aside>

        <main className="editor-stage-column">
          <div className="editor-toolbar panel">
            <div>
              <span className="eyebrow">Video generation workspace</span>
              <h1>Launch trailer localization</h1>
            </div>
            <div className="inline-actions">
              <span className="chip">Autosaved 12 sec ago</span>
              <span className="chip">Draft v04</span>
              <Link href="/upload" className="button">Generate variant</Link>
            </div>
          </div>

          {error ? <div className="error">Backend unavailable: {error}</div> : null}

          <div className="video-workbench">
            <div className="video-canvas-shell">
              <div className="video-canvas-toolbar">
                <span className="chip">16:9 master</span>
                <span className="chip">Safe captions</span>
                <span className="chip">ES-LATAM</span>
              </div>
              <div className="video-canvas">
                <div className="safe-frame" />
                <div className="video-subtitle-overlay">
                  Presenta el flujo que mantiene los lanzamientos globales en marcha.
                </div>
                <span className="play-button">Play</span>
              </div>
              <div className="transport-bar">
                <span>00:18.12</span>
                <div className="scrub-line"><span /></div>
                <span>00:45.00</span>
              </div>
            </div>

            <div className="prompt-stack">
              <div className="prompt-composer dense">
                <div className="panel-header compact">
                  <div>
                    <span className="eyebrow">Prompt</span>
                    <h2>Generation brief</h2>
                  </div>
                  <div className="segmented">
                    <span className="active">Text + clip</span>
                    <span>Captions</span>
                    <span>Voice</span>
                  </div>
                </div>
                <textarea defaultValue="Generate a Spanish LATAM localized trailer. Keep the energetic product-launch pacing, preserve product names, tighten captions for mobile safe areas, and produce a review-ready render artifact." />
                <div className="composer-footer">
                  <div className="chip-row">
                    <span className="chip">Brand-safe</span>
                    <span className="chip">Glossary locked</span>
                    <span className="chip">Human review</span>
                  </div>
                  <button type="button">Run generation</button>
                </div>
              </div>
            </div>
          </div>

          <div className="timeline-editor panel">
            <div className="panel-header compact">
              <div>
                <span className="eyebrow">Timeline</span>
                <h2>Scenes, subtitles, and render states</h2>
              </div>
              <span className="chip">5 scenes - 3 subtitle rows</span>
            </div>

            <div className="scene-track">
              {sceneStrips.map((scene) => (
                <div className="scene-clip" key={scene.label} style={{ width: scene.width }}>
                  <strong>{scene.label}</strong>
                  <span>{scene.time}</span>
                  <small>{scene.status}</small>
                </div>
              ))}
            </div>

            <div className="track-lane video-lane">
              <span className="track-label">Video</span>
              <div className="track-block long">launch_master.mov</div>
            </div>
            <div className="track-lane caption-lane">
              <span className="track-label">Captions</span>
              <div className="track-block caption" style={{ width: "30%" }}>Subtitle 01</div>
              <div className="track-block caption" style={{ width: "36%" }}>Subtitle 02</div>
              <div className="track-block caption" style={{ width: "25%" }}>Subtitle 03</div>
            </div>
            <div className="track-lane audio-lane">
              <span className="track-label">Audio</span>
              <div className="waveform">
                {Array.from({ length: 46 }).map((_, index) => (
                  <span key={index} style={{ height: `${18 + ((index * 13) % 42)}px` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="subtitle-table panel">
            <div className="panel-header compact">
              <div>
                <span className="eyebrow">Subtitle editor</span>
                <h2>Translation rows</h2>
              </div>
              <span className="chip">Inline QA</span>
            </div>
            <div className="subtitle-grid">
              {subtitleRows.map((row) => (
                <div className="subtitle-row" key={row.start}>
                  <span className="timecode">{row.start} - {row.end}</span>
                  <p>{row.source}</p>
                  <strong>{row.target}</strong>
                </div>
              ))}
            </div>
          </div>
        </main>

        <aside className="inspector-rail">
          <div className="inspector-card">
            <span className="eyebrow">Inspector</span>
            <h2>Output settings</h2>
            <div className="timeline">
              {inspectorSettings.map(([label, value]) => (
                <div className="timeline-item" key={label}>
                  <strong>{label}</strong>
                  <span className="muted">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="inspector-card">
            <span className="eyebrow">Variants</span>
            <h2>Render candidates</h2>
            <div className="variant-list">
              {[
                ["v04", "Balanced", "Active"],
                ["v03", "Faster captions", "Approved"],
                ["v02", "Formal tone", "Archived"]
              ].map(([version, label, status]) => (
                <div className="variant-row" key={version}>
                  <span>{version}</span>
                  <strong>{label}</strong>
                  <small>{status}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="inspector-card">
            <span className="eyebrow">Provider log</span>
            <div className="log-console compact-log">
              [00:18] transcript synced\n
              [00:22] target copy generated\n
              [00:27] subtitle QA pending\n
              [00:31] render slot reserved
            </div>
          </div>
        </aside>
      </div>

      <div className="panel render-queue-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Operations</span>
            <h2>Render queue</h2>
          </div>
          <div className="inline-actions">
            <span className="chip">Polling every 5 sec</span>
            <Link href="/upload" className="button button-secondary">New upload</Link>
          </div>
        </div>

        <div className="render-queue-table">
          <div className="queue-row queue-head">
            <span>Asset</span>
            <span>Status</span>
            <span>Stage</span>
            <span>Progress</span>
            <span>Updated</span>
          </div>
          {jobs.length === 0 ? (
            <div className="queue-empty">No backend jobs yet. Queue a source upload to populate live operations.</div>
          ) : (
            jobs.map((job) => (
              <Link href={job.project_id ? `/projects/${job.project_id}` : `/jobs/${job.id}`} className="queue-row" key={job.id}>
                <span>
                  <strong>{job.media_asset.original_filename}</strong>
                  <small>{formatBytes(job.media_asset.size_bytes)}</small>
                </span>
                <StatusBadge status={job.status} />
                <span className="chip">{job.stage}</span>
                <span><ProgressBar value={job.progress} /></span>
                <span className="muted">{new Date(job.updated_at).toLocaleTimeString()}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
