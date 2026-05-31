export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type JobStage = "upload" | "transcribing" | "translating" | "rendering" | "completed" | "failed";

export type MediaAsset = {
  id: string;
  original_filename: string;
  content_type: string | null;
  size_bytes: number;
  created_at: string;
};

export type SyncJob = {
  id: string;
  project_id: string | null;
  source_language: string;
  target_language: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  error_message: string | null;
  transcript_text: string | null;
  translated_text: string | null;
  render_path: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  media_asset: MediaAsset;
};


export type ProjectStatus = "draft" | "processing" | "review" | "approved" | "failed";
export type SceneStatus = "queued" | "draft" | "generating" | "approved";
export type ReviewStatus = "pending" | "approved" | "changes_requested";
export type ExportStatus = "pending" | "rendering" | "ready" | "failed";

export type ProjectScene = {
  id: string;
  title: string;
  sort_order: number;
  start_ms: number;
  end_ms: number;
  status: SceneStatus;
  prompt: string | null;
};

export type SubtitleSegment = {
  id: string;
  scene_id: string | null;
  sort_order: number;
  start_ms: number;
  end_ms: number;
  source_text: string;
  translated_text: string;
  status: ReviewStatus;
};

export type RenderVariant = {
  id: string;
  job_id: string | null;
  label: string;
  status: ExportStatus;
  render_path: string | null;
  render_metadata: Record<string, unknown> | null;
  created_at: string;
};

export type PromptRun = {
  id: string;
  prompt: string;
  mode: string;
  model_name: string;
  status: string;
  created_at: string;
};

export type ReviewDecision = {
  id: string;
  reviewer: string;
  status: ReviewStatus;
  notes: string | null;
  created_at: string;
};

export type ProjectExport = {
  id: string;
  format: string;
  status: ExportStatus;
  output_path: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  brief: string | null;
  source_language: string;
  target_language: string;
  status: ProjectStatus;
  aspect_ratio: string;
  resolution: string;
  caption_style: string;
  voice_profile: string;
  created_at: string;
  updated_at: string;
  media_asset: MediaAsset | null;
  jobs: SyncJob[];
  scenes: ProjectScene[];
  subtitles: SubtitleSegment[];
  render_variants: RenderVariant[];
  prompt_runs: PromptRun[];
  review_decisions: ReviewDecision[];
  exports: ProjectExport[];
};

export type UploadResponse = {
  job: SyncJob;
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    source_language: string;
    target_language: string;
    created_at: string;
    updated_at: string;
  };
};

export type DashboardSummary = {
  total_jobs: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function sendJson<T>(path: string, method: string, body: unknown): Promise<T> {
  return fetchJson<T>(path, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
