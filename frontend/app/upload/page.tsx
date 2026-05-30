"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE_URL } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <section className="hero">
      <div>
        <p className="eyebrow">New sync job</p>
        <h1>Upload source media.</h1>
        <p>
          Queue a localization workflow backed by FastAPI, PostgreSQL, Redis/Celery, mock AI providers,
          and FFmpeg-aware rendering.
        </p>
      </div>

      <form className="panel upload-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="file">Media file</label>
          <input id="file" name="file" type="file" accept="video/*,audio/*" required />
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

        {error ? <div className="error">{error}</div> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Uploading..." : "Upload and process"}
        </button>
      </form>
    </section>
  );
}
