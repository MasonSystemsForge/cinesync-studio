import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "CineSync Studio",
  description: "Enterprise AI video localization and generation workspace"
};

const navSections = [
  {
    title: "Create",
    items: [
      { href: "/dashboard", label: "Command center", meta: "Live" },
      { href: "/upload", label: "New generation", meta: "Queue" },
      { href: "/dashboard", label: "Prompt library", meta: "34" }
    ]
  },
  {
    title: "Operate",
    items: [
      { href: "/dashboard", label: "Render queue", meta: "Celery" },
      { href: "/dashboard", label: "Assets", meta: "Media" },
      { href: "/dashboard", label: "Review room", meta: "QA" }
    ]
  }
];

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <main className="app-frame">
          <aside className="sidebar" aria-label="Studio navigation">
            <Link href="/dashboard" className="brand-lockup">
              <span className="brand-mark">CS</span>
              <span>
                <strong>CineSync Studio</strong>
                <small>Enterprise video generation</small>
              </span>
            </Link>

            <div className="workspace-switcher">
              <span className="workspace-avatar">AC</span>
              <span>
                <strong>Acme Media Ops</strong>
                <small>Production workspace</small>
              </span>
            </div>

            <nav className="side-nav">
              {navSections.map((section) => (
                <div className="side-section" key={section.title}>
                  <p>{section.title}</p>
                  {section.items.map((item) => (
                    <Link href={item.href} className="side-nav-item" key={`${section.title}-${item.label}`}>
                      <span>{item.label}</span>
                      <small>{item.meta}</small>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>

            <div className="sidebar-card">
              <span className="eyebrow">Capacity</span>
              <div className="quota-ring">
                <strong>82%</strong>
                <span>render budget</span>
              </div>
              <p>Mock providers are wired for local development. Replace with production STT, translation, voice, and render vendors.</p>
              <Link href="/upload" className="button button-small button-full">
                New generation
              </Link>
            </div>
          </aside>

          <section className="workspace">
            <header className="studio-topbar">
              <div className="crumbs">
                <span>Workspace</span>
                <strong>/</strong>
                <span>CineSync</span>
                <strong>/</strong>
                <span>Generate</span>
              </div>
              <div className="topbar-actions">
                <label className="prompt-search">
                  <span>Global prompt</span>
                  <input placeholder="Search jobs, briefs, assets, transcripts, or render artifacts" />
                </label>
                <div className="status-pill">
                  <span className="status-dot" />
                  API ready
                </div>
                <Link href="/upload" className="button">
                  Create
                </Link>
              </div>
            </header>
            {children}
          </section>
        </main>
      </body>
    </html>
  );
}
