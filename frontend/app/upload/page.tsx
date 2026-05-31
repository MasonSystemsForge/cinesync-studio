"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE_URL, formatBytes } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
      <div className="hero-card">
        <div>
          <span className="eyebrow">New creation</span>
          <h2 className="hero-title">Upload footage and brief the localization pipeline.</h2>
          <p className="hero-copy">
            This studio flow mirrors modern AI creation apps: start with source media, choose language direction,
            add creative notes, then track the generated job in real time.
          </p>
        </div>
        <div className="preview-tile large">
          <span className="preview-label">Drop media to generate</span>
        </div>
      </div>

      <form className="upload-layout" onSubmit={handleSubmit}>
        <div className="dropzone">
          <div className="dropzone-inner">
            <span className="eyebrow">Source asset</span>
            <h2>Drag-ready upload canvas</h2>
            <p>Select a video or audio file. Docker mounts uploads into the backend worker for mock processing.</p>
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
            <span className="eyebrow">Project settings</span>
            <h2>Localization brief</h2>
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
              placeholder="Example: cinematic subtitles, energetic launch tone, preserve product names"
            />
          </div>

          <div className="chip-row">
            <span className="chip">Transcribe</span>
            <span className="chip">Translate</span>
            <span className="chip">Render metadata</span>
          </div>

          {error ? <div className="error">{error}</div> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating job..." : "Generate localization"}
          </button>
        </div>
      </form>
    </section>
  );
}
