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

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
