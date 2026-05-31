"use client";

import { useEffect, useState } from "react";

import { DashboardStudioSummary, fetchJson } from "@/lib/api";

const fallback: DashboardStudioSummary = {
  total_projects: 0,
  total_jobs: 0,
  active_jobs: 0,
  latest_cost_usd: 0,
  avg_render_time_seconds: null,
  success_rate: 1,
  credits_remaining: 10000,
  credit_balance_usd: 250,
  budget_used_percent: 0
};

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function StudioTopbar() {
  const [summary, setSummary] = useState<DashboardStudioSummary>(fallback);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const nextSummary = await fetchJson<DashboardStudioSummary>("/dashboard/studio", { cache: "no-store" });
        if (!cancelled) setSummary(nextSummary);
      } catch {
        // Keep fallback values if the backend is not running in local UI development.
      }
    }

    loadSummary();
    const interval = window.setInterval(loadSummary, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <header className="studio-topbar">
      <div>
        <span className="eyebrow">Mission control</span>
        <h1>Global Launch Video</h1>
      </div>
      <div className="topbar-actions">
        <div className="credits-pill">
          <span>Credits</span>
          <strong>{Math.round(summary.credits_remaining).toLocaleString()}</strong>
        </div>
        <div className="credits-pill muted-pill">
          <span>Balance</span>
          <strong>{formatCurrency(summary.credit_balance_usd)}</strong>
        </div>
        <button className="profile-button" type="button" aria-label="Open profile menu">AC</button>
      </div>
    </header>
  );
}
