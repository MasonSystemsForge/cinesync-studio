"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import {
  JobStatus,
  Project,
  ProjectScene,
  ReviewStatus,
  SceneStatus,
  SubtitleSegment,
  SyncJob,
  API_BASE_URL,
  fetchJson,
  formatBytes,
  sendJson
} from "@/lib/api";

type ProjectEditorClientProps = {
  projectId: string;
};

type ProjectDraft = {
  name: string;
  brief: string;
  source_language: string;
  target_language: string;
  aspect_ratio: string;
  resolution: string;
  caption_style: string;
  voice_profile: string;
};

type SceneDraft = {
  title: string;
  status: SceneStatus;
  prompt: string;
};

type SubtitleDraft = {
  source_text: string;
  translated_text: string;
  status: ReviewStatus;
};

const sceneStatuses: SceneStatus[] = ["queued", "draft", "generating", "approved"];
const subtitleStatuses: ReviewStatus[] = ["pending", "approved", "changes_requested"];
const retryableStatuses: JobStatus[] = ["completed", "failed"];

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

function projectToDraft(project: Project): ProjectDraft {
  return {
    name: project.name,
    brief: project.brief ?? "",
    source_language: project.source_language,
    target_language: project.target_language,
    aspect_ratio: project.aspect_ratio,
    resolution: project.resolution,
    caption_style: project.caption_style,
    voice_profile: project.voice_profile
  };
}

function sceneDraftsFromProject(project: Project): Record<string, SceneDraft> {
  return Object.fromEntries(
    project.scenes.map((scene) => [
      scene.id,
      {
        title: scene.title,
        status: scene.status,
        prompt: scene.prompt ?? ""
      }
    ])
  );
}

function subtitleDraftsFromProject(project: Project): Record<string, SubtitleDraft> {
  return Object.fromEntries(
    project.subtitles.map((subtitle) => [
      subtitle.id,
      {
        source_text: subtitle.source_text,
        translated_text: subtitle.translated_text,
        status: subtitle.status
      }
    ])
  );
}

export function ProjectEditorClient({ projectId }: ProjectEditorClientProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null);
  const [sceneDrafts, setSceneDrafts] = useState<Record<string, SceneDraft>>({});
  const [subtitleDrafts, setSubtitleDrafts] = useState<Record<string, SubtitleDraft>>({});
  const [promptDraft, setPromptDraft] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrateDrafts = useCallback((nextProject: Project) => {
    setProjectDraft(projectToDraft(nextProject));
    setSceneDrafts(sceneDraftsFromProject(nextProject));
    setSubtitleDrafts(subtitleDraftsFromProject(nextProject));
    setPromptDraft(
      nextProject.prompt_runs[0]?.prompt ?? nextProject.brief ?? "Generate a localized, review-ready video variant."
    );
    setReviewNotes(nextProject.review_decisions[0]?.notes ?? "");
    setDraftProjectId(nextProject.id);
  }, []);

  const loadProject = useCallback(
    async (options?: { refreshDrafts?: boolean }) => {
      const nextProject = await fetchJson<Project>(`/projects/${projectId}`, { cache: "no-store" });
      setProject(nextProject);
      if (options?.refreshDrafts || draftProjectId !== nextProject.id) {
        hydrateDrafts(nextProject);
      }
      return nextProject;
    },
    [draftProjectId, hydrateDrafts, projectId]
  );

  useEffect(() => {
    let cancelled = false;

    async function pollProject() {
      try {
        const nextProject = await fetchJson<Project>(`/projects/${projectId}`, { cache: "no-store" });
        if (!cancelled) {
          setProject(nextProject);
          if (draftProjectId !== nextProject.id) {
            hydrateDrafts(nextProject);
          }
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load project");
        }
      }
    }

    pollProject();
    const interval = window.setInterval(pollProject, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [draftProjectId, hydrateDrafts, projectId]);

  async function runAction(label: string, key: string, action: () => Promise<void>) {
    setSavingKey(key);
    setNotice(null);
    setError(null);
    try {
      await action();
      setNotice(label);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveProjectSettings() {
    if (!projectDraft) return;
    await runAction("Project settings saved", "project", async () => {
      const nextProject = await sendJson<Project>(`/projects/${projectId}`, "PATCH", projectDraft);
      setProject(nextProject);
      hydrateDrafts(nextProject);
    });
  }

  async function saveScene(scene: ProjectScene) {
    const draft = sceneDrafts[scene.id];
    if (!draft) return;
    await runAction("Scene saved", `scene-${scene.id}`, async () => {
      await sendJson<ProjectScene>(`/projects/${projectId}/scenes/${scene.id}`, "PATCH", draft);
      await loadProject({ refreshDrafts: true });
    });
  }

  async function saveSubtitle(subtitle: SubtitleSegment) {
    const draft = subtitleDrafts[subtitle.id];
    if (!draft) return;
    await runAction("Subtitle saved", `subtitle-${subtitle.id}`, async () => {
      await sendJson<SubtitleSegment>(`/projects/${projectId}/subtitles/${subtitle.id}`, "PATCH", draft);
      await loadProject({ refreshDrafts: true });
    });
  }

  async function savePromptRun() {
    await runAction("Prompt run saved", "prompt", async () => {
      await sendJson(`/projects/${projectId}/prompt-runs`, "POST", {
        prompt: promptDraft,
        mode: "text_media",
        model_name: "CineSync v1 Enterprise"
      });
      await loadProject({ refreshDrafts: true });
    });
  }

  async function createRenderJob() {
    await runAction("Render job queued", "render", async () => {
      await sendJson<SyncJob>(`/projects/${projectId}/render-jobs`, "POST", {
        prompt: promptDraft,
        mode: "text_media",
        model_name: "CineSync v1 Enterprise"
      });
      await loadProject({ refreshDrafts: true });
    });
  }

  async function createReviewDecision(status: ReviewStatus) {
    await runAction("Review decision saved", `review-${status}`, async () => {
      await sendJson(`/projects/${projectId}/reviews`, "POST", {
        reviewer: "Owner",
        status,
        notes: reviewNotes
      });
      await loadProject({ refreshDrafts: true });
    });
  }

  async function retryJob(job: SyncJob) {
    await runAction("Render job retried", `retry-${job.id}`, async () => {
      await sendJson<SyncJob>(`/projects/${projectId}/jobs/${job.id}/retry`, "POST", {});
      await loadProject({ refreshDrafts: true });
    });
  }

  function updateProjectDraft<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    setProjectDraft((draft) => (draft ? { ...draft, [key]: value } : draft));
  }

  function updateSceneDraft(sceneId: string, key: keyof SceneDraft, value: string) {
    setSceneDrafts((drafts) => ({
      ...drafts,
      [sceneId]: {
        ...drafts[sceneId],
        [key]: value
      }
    }));
  }

  function updateSubtitleDraft(subtitleId: string, key: keyof SubtitleDraft, value: string) {
    setSubtitleDrafts((drafts) => ({
      ...drafts,
      [subtitleId]: {
        ...drafts[subtitleId],
        [key]: value
      }
    }));
  }

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

  if (!project || !projectDraft) {
    return (
      <section className="page-stack">
        <div className="panel"><p className="muted">Loading project editor...</p></div>
      </section>
    );
  }

  const activeJob = project.jobs.find((job) => job.status === "processing") ?? project.jobs[0];
  const mediaStreamUrl = project.media_asset ? `${API_BASE_URL}/media/${project.media_asset.id}/stream` : null;
  const mediaDownloadUrl = project.media_asset ? `${API_BASE_URL}/media/${project.media_asset.id}/download` : null;
  const isVideo = Boolean(project.media_asset?.content_type?.startsWith("video/"));
  const isAudio = Boolean(project.media_asset?.content_type?.startsWith("audio/"));
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

  const projectSaving = savingKey === "project";

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
            <span className="eyebrow">Review notes</span>
            <textarea
              className="inline-textarea compact-field"
              value={reviewNotes}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReviewNotes(event.target.value)}
              placeholder="Add approval notes or requested changes"
            />
            <div className="inline-actions">
              <button
                className="button-small button-secondary"
                type="button"
                disabled={savingKey === "review-changes_requested"}
                onClick={() => createReviewDecision("changes_requested")}
              >
                Request changes
              </button>
              <button
                className="button-small"
                type="button"
                disabled={savingKey === "review-approved"}
                onClick={() => createReviewDecision("approved")}
              >
                Approve
              </button>
            </div>
          </div>
        </aside>

        <main className="editor-stage-column">
          <div className="editor-toolbar panel">
            <div>
              <span className="eyebrow">Live project editor</span>
              <input
                className="title-input"
                value={projectDraft.name}
                onChange={(event) => updateProjectDraft("name", event.target.value)}
                aria-label="Project name"
              />
            </div>
            <div className="inline-actions">
              <span className="chip">{project.status}</span>
              <span className="chip">Updated {new Date(project.updated_at).toLocaleTimeString()}</span>
              <button type="button" className="button-secondary" disabled={projectSaving} onClick={saveProjectSettings}>
                {projectSaving ? "Saving..." : "Save settings"}
              </button>
              <button type="button" disabled={savingKey === "render"} onClick={createRenderJob}>
                {savingKey === "render" ? "Queuing..." : "Generate variant"}
              </button>
            </div>
          </div>

          {notice ? <div className="success-banner">{notice}</div> : null}
          {error ? <div className="error">{error}</div> : null}

          <div className="video-workbench">
            <div className="video-canvas-shell">
              <div className="video-canvas-toolbar">
                <span className="chip">{projectDraft.aspect_ratio} master</span>
                <span className="chip">{projectDraft.caption_style}</span>
                <span className="chip">{projectDraft.target_language.toUpperCase()}</span>
              </div>
              <div className="video-canvas media-canvas">
                <div className="safe-frame" />
                {mediaStreamUrl && isVideo ? (
                  <video className="media-preview" controls src={mediaStreamUrl} />
                ) : mediaStreamUrl && isAudio ? (
                  <div className="audio-preview-card">
                    <span className="eyebrow">Audio source</span>
                    <strong>{project.media_asset?.original_filename}</strong>
                    <audio controls src={mediaStreamUrl} />
                  </div>
                ) : (
                  <span className="play-button">Preview</span>
                )}
                <div className="video-subtitle-overlay">
                  {project.subtitles[0]?.translated_text ?? "Waiting for localized subtitle output..."}
                </div>
              </div>
              <div className="transport-bar">
                <span>00:00</span>
                <div className="scrub-line"><span /></div>
                <span>{formatMs(durationMs)}</span>
              </div>
              {mediaDownloadUrl ? (
                <div className="media-action-row">
                  <a className="button button-secondary button-small" href={mediaStreamUrl ?? mediaDownloadUrl} target="_blank" rel="noreferrer">Open source</a>
                  <a className="button button-secondary button-small" href={mediaDownloadUrl}>Download source</a>
                </div>
              ) : null}
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
                <textarea value={promptDraft} onChange={(event) => setPromptDraft(event.target.value)} />
                <div className="composer-footer">
                  <div className="chip-row">
                    <span className="chip">{projectDraft.resolution}</span>
                    <span className="chip">{projectDraft.voice_profile}</span>
                    <span className="chip">Human review</span>
                  </div>
                  <div className="inline-actions">
                    <button className="button-secondary" type="button" disabled={savingKey === "prompt"} onClick={savePromptRun}>
                      Save prompt
                    </button>
                    <button type="button" disabled={savingKey === "render"} onClick={createRenderJob}>
                      Run generation
                    </button>
                  </div>
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
                  <strong>{sceneDrafts[scene.id]?.title ?? scene.title}</strong>
                  <span>{formatMs(scene.start_ms)}</span>
                  <small>{sceneDrafts[scene.id]?.status ?? scene.status}</small>
                </div>
              ))}
            </div>

            <div className="editable-scene-grid">
              {project.scenes.map((scene) => {
                const draft = sceneDrafts[scene.id] ?? { title: scene.title, status: scene.status, prompt: scene.prompt ?? "" };
                const key = `scene-${scene.id}`;
                return (
                  <div className="editable-row" key={scene.id}>
                    <input value={draft.title} onChange={(event) => updateSceneDraft(scene.id, "title", event.target.value)} />
                    <select value={draft.status} onChange={(event) => updateSceneDraft(scene.id, "status", event.target.value)}>
                      {sceneStatuses.map((sceneStatus) => <option key={sceneStatus} value={sceneStatus}>{sceneStatus}</option>)}
                    </select>
                    <input value={draft.prompt} onChange={(event) => updateSceneDraft(scene.id, "prompt", event.target.value)} placeholder="Scene prompt" />
                    <button className="button-small button-secondary" type="button" disabled={savingKey === key} onClick={() => saveScene(scene)}>
                      {savingKey === key ? "Saving" : "Save"}
                    </button>
                  </div>
                );
              })}
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
            <div className="subtitle-grid editable-subtitle-grid">
              {project.subtitles.length === 0 ? (
                <div className="queue-empty">Subtitle rows will appear after the worker finishes translation.</div>
              ) : (
                project.subtitles.map((row) => {
                  const draft = subtitleDrafts[row.id] ?? {
                    source_text: row.source_text,
                    translated_text: row.translated_text,
                    status: row.status
                  };
                  const key = `subtitle-${row.id}`;
                  return (
                    <div className="subtitle-row editable-subtitle-row" key={row.id}>
                      <span className="timecode">{formatMs(row.start_ms)} - {formatMs(row.end_ms)}</span>
                      <textarea value={draft.source_text} onChange={(event) => updateSubtitleDraft(row.id, "source_text", event.target.value)} />
                      <textarea value={draft.translated_text} onChange={(event) => updateSubtitleDraft(row.id, "translated_text", event.target.value)} />
                      <select value={draft.status} onChange={(event) => updateSubtitleDraft(row.id, "status", event.target.value)}>
                        {subtitleStatuses.map((subtitleStatus) => (
                          <option key={subtitleStatus} value={subtitleStatus}>{subtitleStatus}</option>
                        ))}
                      </select>
                      <button className="button-small button-secondary" type="button" disabled={savingKey === key} onClick={() => saveSubtitle(row)}>
                        {savingKey === key ? "Saving" : "Save"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>

        <aside className="inspector-rail">
          <div className="inspector-card">
            <span className="eyebrow">Inspector</span>
            <h2>Output settings</h2>
            <div className="settings-form-grid">
              {[
                ["source_language", "Source language"],
                ["target_language", "Target language"],
                ["aspect_ratio", "Aspect"],
                ["resolution", "Resolution"],
                ["caption_style", "Caption style"],
                ["voice_profile", "Voice"]
              ].map(([field, label]) => (
                <label className="field compact-field" key={field}>
                  <span>{label}</span>
                  <input
                    value={projectDraft[field as keyof ProjectDraft]}
                    onChange={(event) => updateProjectDraft(field as keyof ProjectDraft, event.target.value)}
                  />
                </label>
              ))}
              <label className="field compact-field full-span">
                <span>Brief</span>
                <textarea value={projectDraft.brief} onChange={(event) => updateProjectDraft("brief", event.target.value)} />
              </label>
              <button className="button-secondary full-span" type="button" disabled={projectSaving} onClick={saveProjectSettings}>
                {projectSaving ? "Saving settings..." : "Save output settings"}
              </button>
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
                  <div className="variant-row variant-row-rich" key={variant.id}>
                    <span>{variant.label.split(" ").pop()}</span>
                    <strong>{variant.label}</strong>
                    <small>{variant.status}</small>
                    {variant.render_path ? <small>{variant.render_path.split("/").pop()}</small> : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="inspector-card">
            <span className="eyebrow">Exports</span>
            <h2>Downloads</h2>
            <div className="variant-list">
              {project.exports.length === 0 ? (
                <div className="queue-empty">No export records yet.</div>
              ) : (
                project.exports.map((projectExport) => (
                  <div className="variant-row variant-row-rich" key={projectExport.id}>
                    <span>{projectExport.format}</span>
                    <strong>{projectExport.status}</strong>
                    <small>{projectExport.output_path?.split("/").pop() ?? "Pending artifact"}</small>
                    {projectExport.output_path ? (
                      <a
                        className="table-action"
                        href={`${API_BASE_URL}/projects/${project.id}/exports/${projectExport.id}/download`}
                      >
                        Download
                      </a>
                    ) : null}
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
              [{new Date().toISOString()}] polling /projects/{project.id} every 3000ms
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
            <button type="button" disabled={savingKey === "render"} onClick={createRenderJob}>Queue render</button>
            <Link href="/dashboard" className="button button-secondary">Dashboard</Link>
          </div>
        </div>

        <div className="render-queue-table">
          <div className="queue-row queue-head queue-row-actions">
            <span>Asset</span>
            <span>Status</span>
            <span>Stage</span>
            <span>Progress</span>
            <span>Updated</span>
            <span>Action</span>
          </div>
          {project.jobs.map((job) => {
            const key = `retry-${job.id}`;
            return (
              <div className="queue-row queue-row-actions" key={job.id}>
                <Link href={`/jobs/${job.id}`}>
                  <strong>{job.media_asset.original_filename}</strong>
                  <small>{formatBytes(job.media_asset.size_bytes)}</small>
                </Link>
                <StatusBadge status={job.status} />
                <span className="chip">{job.stage}</span>
                <span><ProgressBar value={job.progress} /></span>
                <span className="muted">{new Date(job.updated_at).toLocaleTimeString()}</span>
                <button
                  className="button-small button-secondary"
                  type="button"
                  disabled={!retryableStatuses.includes(job.status) || savingKey === key}
                  onClick={() => retryJob(job)}
                >
                  {savingKey === key ? "Retrying" : "Retry"}
                </button>
              </div>
            );
          })}
        </div>

        {activeJob ? <p className="muted">Active worker stage: {activeJob.stage}</p> : null}
      </div>
    </section>
  );
}
