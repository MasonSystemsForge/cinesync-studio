import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "CineSync Studio",
  description: "AI podcast, avatar, voice, and video rendering workspace"
};

const navItems = [
  { href: "/dashboard", label: "Studio" },
  { href: "/dashboard#jobs", label: "Jobs" },
  { href: "/dashboard#pipeline", label: "Pipeline" },
  { href: "/upload", label: "Editor" },
  { href: "/dashboard#pricing", label: "Pricing" },
  { href: "/dashboard#settings", label: "Settings" }
];

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <main className="app-frame">
          <aside className="sidebar" aria-label="Main navigation">
            <Link href="/dashboard" className="brand-lockup">
              <span className="brand-mark">CS</span>
              <span>
                <strong>CineSync Studio</strong>
                <small>AI podcast, avatar, voice, and video rendering workspace</small>
              </span>
            </Link>

            <nav className="side-nav">
              {navItems.map((item, index) => (
                <Link className={`side-nav-item ${index === 0 ? "active" : ""}`} href={item.href} key={item.label}>
                  <span className="nav-dot" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="sidebar-card">
              <span className="eyebrow">Workspace</span>
              <strong>Production Lite</strong>
              <p>Mission control for synced video, avatar, voice, and subtitle production.</p>
              <Link href="/upload" className="button button-full button-small">Create Render</Link>
            </div>
          </aside>

          <section className="workspace">
            <header className="studio-topbar">
              <div>
                <span className="eyebrow">Mission control</span>
                <h1>Global Launch Video</h1>
              </div>
              <div className="topbar-actions">
                <div className="credits-pill">
                  <span>Credits</span>
                  <strong>8,420</strong>
                </div>
                <div className="credits-pill muted-pill">
                  <span>Balance</span>
                  <strong>$184.20</strong>
                </div>
                <button className="profile-button" type="button" aria-label="Open profile menu">AC</button>
              </div>
            </header>
            {children}
          </section>
        </main>
      </body>
    </html>
  );
}
