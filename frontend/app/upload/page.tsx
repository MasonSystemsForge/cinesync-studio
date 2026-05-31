"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE_URL, formatBytes } from "@/lib/api";

const settings = [
  ["Output", "1080p MP4"],
  ["Aspect", "16:9 + safe crop"],
  ["Caption style", "Cinematic lower third"],
  ["Review", "Human approval"]
];

export default function UploadPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileMetadata = useMemo(() => {
    if (!selectedFile) return null;
    return [
      ["Name", selectedFile.name],
      ["Size", formatBytes(selectedFile.size)],
      ["Type", selectedFile.type || "Unknown"],
      ["Modified", new Date(selectedFile.lastModified).toLocaleDateString()]
    ];
  }, [selectedFile]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_BASE_URL}/uploads`, {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = (await response.json()) as { job: { id: string } };
      router.push(`/jobs/${payload.job.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Upload failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-stack">
      <div className="hero-console">
        <div className="command-card">
          <span className="eyebrow">New generation pipeline</span>
          <h2 className="hero-title">Ingest source media, brief the model, and queue a production render.</h2>
          <p className="hero-copy">
            Enterprise teams need more than a file picker. This flow captures source metadata, target locale,
            creative direction, output controls, and review gates before the Celery worker starts processing.
          </p>
          <div className="settings-grid">
            {settings.map(([label, value], index) => (
              <div className={`setting-card ${index === 0 ? "active" : ""}`} key={label}>
                <span className="muted">{label}</span>
                <h3>{value}</h3>
              </div>
            ))}
          </div>
        </div>
        <div className="preview-monitor">
          <div className="monitor-toolbar">
            <span className="eyebrow">Preflight preview</span>
            <span className="chip">No source uploaded</span>
          </div>
          <div className="monitor-stage">
            <div className="monitor-window">
              <span className="play-button">Ingest</span>
            </div>
            <div className="timeline-scrub">
              <span>Brief</span>
              <div className="scrub-line"><span /></div>
              <span>Queue</span>
            </div>
          </div>
        </div>
      </div>

      <form className="upload-layout" onSubmit={handleSubmit}>
        <div className="dropzone">
          <div className="dropzone-inner">
            <span className="drop-icon">+</span>
            <span className="eyebrow">Source media</span>
            <h2>Upload source video or audio</h2>
            <p>Use a production source file. The backend stores it under the shared upload volume and queues the worker.</p>
            <input id="file" name="file" type="file" accept="video/*,audio/*" onChange={handleFileChange} required />
            {selectedFile ? (
              <span className="file-pill">
                {selectedFile.name} - {formatBytes(selectedFile.size)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="panel form-grid">
          <div>
            <span className="eyebrow">Generation brief</span>
            <h2>Locale and creative controls</h2>
          </div>

          <div className="field">
            <label htmlFor="source_language">Source language</label>
            <select id="source_language" name="source_language" defaultValue="auto">
              <option value="auto">Auto detect</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="target_language">Target language</label>
            <select id="target_language" name="target_language" defaultValue="es">
              <option value="es">Spanish</option>
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="notes">Creative direction</label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Example: premium cinematic launch tone, concise subtitles, preserve product names, avoid slang"
            />
          </div>

          <div className="segmented" aria-label="Quality mode">
            <span className="active">Balanced</span>
            <span>Fast</span>
            <span>Review strict</span>
          </div>

          {fileMetadata ? (
            <div className="timeline">
              {fileMetadata.map(([label, value]) => (
                <div className="timeline-item" key={label}>
                  <strong>{label}</strong>
                  <span className="muted">{value}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="timeline">
            {[
              ["Brand glossary", "Required before publish"],
              ["Caption safe area", "Enabled"],
              ["Human review", "Owner approval"]
            ].map(([label, value]) => (
              <div className="review-row" key={label}>
                <strong>{label}</strong>
                <span className="chip">{value}</span>
              </div>
            ))}
          </div>

          {error ? <div className="error">{error}</div> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Queuing generation..." : "Queue enterprise render"}
          </button>
        </div>
      </form>
    </section>
  );
}
