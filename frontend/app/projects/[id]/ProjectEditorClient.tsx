"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { Project, fetchJson, formatBytes } from "@/lib/api";

type ProjectEditorClientProps = {
  projectId: string;
};

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clipWidth(startMs: number, endMs: number, durationMs: number): string {
  if (durationMs <= 0) return "18%";
  return `${Math.max(10, ((endMs - startMs) / durationMs) * 100)}%`;
}

export function ProjectEditorClient({ projectId }: ProjectEditorClientProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      try {
        const nextProject = await fetchJson<Project>(`/projects/${projectId}`, { cache: "no-store" });
        if (!cancelled) {
          setProject(nextProject);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load project");
        }
      }
    }

    loadProject();
    const interval = window.setInterval(loadProject, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [projectId]);

  const durationMs = useMemo(() => {
    if (!project?.scenes.length) return 45000;
    return Math.max(...project.scenes.map((scene) => scene.end_ms), 45000);
  }, [project]);

  if (error && !project) {
    return (
      <section className="page-stack">
        <div className="panel"><div className="error">{error}</div></div>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="page-stack">
        <div className="panel"><p className="muted">Loading project editor...</p></div>
      </section>
    );
  }

  const activeJob = project.jobs.find((job) => job.status === "processing") ?? project.jobs[0];
  const firstPrompt = project.prompt_runs[0]?.prompt ?? project.brief ?? "Generate a localized, review-ready video variant.";
  const sourceAssets = [
    project.media_asset
      ? {
          name: project.media_asset.original_filename,
          type: project.media_asset.content_type ?? "Source media",
          duration: formatBytes(project.media_asset.size_bytes),
          ratio: project.aspect_ratio
        }
      : { name: "No source asset", type: "Upload required", duration: "0 B", ratio: project.aspect_ratio },
    { name: "project_prompt.txt", type: "Prompt", duration: `${project.prompt_runs.length} runs`, ratio: "Locked" },
    { name: "review_policy.json", type: "Governance", duration: `${project.review_decisions.length} gates`, ratio: "QA" }
  ];

  return (
    <section className="page-stack editor-page">
      <div className="editor-shell">
        <aside className="asset-rail">
          <div className="panel-header compact">
            <div>
              <span className="eyebrow">Source bin</span>
              <h2>{project.name}</h2>
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
            <span className="eyebrow">Project state</span>
            <div className="mini-stat-grid">
              <div className="mini-stat"><strong>{project.jobs.length}</strong><span>Jobs</span></div>
              <div className="mini-stat"><strong>{project.scenes.length}</strong><span>Scenes</span></div>
              <div className="mini-stat"><strong>{project.subtitles.length}</strong><span>Subtitles</span></div>
              <div className="mini-stat"><strong>{project.render_variants.length}</strong><span>Variants</span></div>
            </div>
          </div>

          <div className="rail-section">
            <span className="eyebrow">Review gates</span>
            {project.review_decisions.map((decision) => (
              <div className="review-row" key={decision.id}>
                <strong>{decision.reviewer}</strong>
                <span className="chip">{decision.status}</span>
              </div>
            ))}
          </div>
        </aside>

        <main className="editor-stage-column">
          <div className="editor-toolbar panel">
            <div>
              <span className="eyebrow">Live project editor</span>
              <h1>{project.name}</h1>
            </div>
            <div className="inline-actions">
              <span className="chip">{project.status}</span>
              <span className="chip">Updated {new Date(project.updated_at).toLocaleTimeString()}</span>
              <Link href="/upload" className="button">Generate variant</Link>
            </div>
          </div>

          {error ? <div className="error">Refresh failed: {error}</div> : null}

          <div className="video-workbench">
            <div className="video-canvas-shell">
              <div className="video-canvas-toolbar">
                <span className="chip">{project.aspect_ratio} master</span>
                <span className="chip">{project.caption_style}</span>
                <span className="chip">{project.target_language.toUpperCase()}</span>
              </div>
              <div className="video-canvas">
                <div className="safe-frame" />
                <div className="video-subtitle-overlay">
                  {project.subtitles[0]?.translated_text ?? "Waiting for localized subtitle output..."}
                </div>
                <span className="play-button">Play</span>
              </div>
              <div className="transport-bar">
                <span>00:00</span>
                <div className="scrub-line"><span /></div>
                <span>{formatMs(durationMs)}</span>
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
                <textarea value={firstPrompt} readOnly />
                <div className="composer-footer">
                  <div className="chip-row">
                    <span className="chip">{project.resolution}</span>
                    <span className="chip">{project.voice_profile}</span>
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
              <span className="chip">{project.scenes.length} scenes - {project.subtitles.length} subtitle rows</span>
            </div>

            <div className="scene-track">
              {project.scenes.map((scene) => (
                <div className="scene-clip" key={scene.id} style={{ width: clipWidth(scene.start_ms, scene.end_ms, durationMs) }}>
                  <strong>{scene.title}</strong>
                  <span>{formatMs(scene.start_ms)}</span>
                  <small>{scene.status}</small>
                </div>
              ))}
            </div>

            <div className="track-lane video-lane">
              <span className="track-label">Video</span>
              <div className="track-block long">{project.media_asset?.original_filename ?? "source pending"}</div>
            </div>
            <div className="track-lane caption-lane">
              <span className="track-label">Captions</span>
              {project.subtitles.length === 0 ? (
                <div className="track-block caption" style={{ width: "35%" }}>waiting for worker</div>
              ) : (
                project.subtitles.map((subtitle) => (
                  <div className="track-block caption" key={subtitle.id} style={{ width: clipWidth(subtitle.start_ms, subtitle.end_ms, durationMs) }}>
                    Subtitle {subtitle.sort_order + 1}
                  </div>
                ))
              )}
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
              {project.subtitles.length === 0 ? (
                <div className="queue-empty">Subtitle rows will appear after the worker finishes translation.</div>
              ) : (
                project.subtitles.map((row) => (
                  <div className="subtitle-row" key={row.id}>
                    <span className="timecode">{formatMs(row.start_ms)} - {formatMs(row.end_ms)}</span>
                    <p>{row.source_text}</p>
                    <strong>{row.translated_text}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>

        <aside className="inspector-rail">
          <div className="inspector-card">
            <span className="eyebrow">Inspector</span>
            <h2>Output settings</h2>
            <div className="timeline">
              {[
                ["Model", project.prompt_runs[0]?.model_name ?? "CineSync v1 Enterprise"],
                ["Locale", `${project.source_language} to ${project.target_language}`],
                ["Aspect", project.aspect_ratio],
                ["Caption style", project.caption_style],
                ["Voice", project.voice_profile],
                ["Review policy", project.review_decisions[0]?.status ?? "pending"]
              ].map(([label, value]) => (
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
              {project.render_variants.length === 0 ? (
                <div className="queue-empty">No variants yet.</div>
              ) : (
                project.render_variants.map((variant) => (
                  <div className="variant-row" key={variant.id}>
                    <span>{variant.label.split(" ").pop()}</span>
                    <strong>{variant.label}</strong>
                    <small>{variant.status}</small>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="inspector-card">
            <span className="eyebrow">Provider log</span>
            <div className="log-console compact-log">
              [{new Date(project.created_at).toISOString()}] project created\n
              [{new Date(project.updated_at).toISOString()}] project status: {project.status}\n
              [{new Date().toISOString()}] polling /projects/{project.id} every 2500ms
            </div>
          </div>
        </aside>
      </div>

      <div className="panel render-queue-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Operations</span>
            <h2>Project render queue</h2>
          </div>
          <div className="inline-actions">
            <span className="chip">{project.jobs.length} jobs</span>
            <Link href="/dashboard" className="button button-secondary">Dashboard</Link>
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
          {project.jobs.map((job) => (
            <Link href={`/jobs/${job.id}`} className="queue-row" key={job.id}>
              <span>
                <strong>{job.media_asset.original_filename}</strong>
                <small>{formatBytes(job.media_asset.size_bytes)}</small>
              </span>
              <StatusBadge status={job.status} />
              <span className="chip">{job.stage}</span>
              <span><ProgressBar value={job.progress} /></span>
              <span className="muted">{new Date(job.updated_at).toLocaleTimeString()}</span>
            </Link>
          ))}
        </div>

        {activeJob ? <p className="muted">Active worker stage: {activeJob.stage}</p> : null}
      </div>
    </section>
  );
}
