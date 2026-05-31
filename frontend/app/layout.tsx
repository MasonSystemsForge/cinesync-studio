import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "CineSync Studio",
  description: "AI-assisted video localization workflow scaffold"
};

const navItems = [
  { href: "/dashboard", label: "Home", meta: "Create" },
  { href: "/upload", label: "New project", meta: "Upload" },
  { href: "/dashboard", label: "Templates", meta: "Mock" },
  { href: "/dashboard", label: "Assets", meta: "Library" }
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
                <strong>CineSync</strong>
                <small>Studio</small>
              </span>
            </Link>

            <nav className="side-nav">
              {navItems.map((item) => (
                <Link href={item.href} className="side-nav-item" key={`${item.label}-${item.meta}`}>
                  <span>{item.label}</span>
                  <small>{item.meta}</small>
                </Link>
              ))}
            </nav>

            <div className="sidebar-card">
              <span className="eyebrow">Pipeline credits</span>
              <strong>Mock provider mode</strong>
              <p>Swap the scaffold providers with production AI, dubbing, and render services when ready.</p>
              <Link href="/upload" className="button button-small">
                Start upload
              </Link>
            </div>
          </aside>

          <section className="workspace">
            <header className="studio-topbar">
              <div>
                <span className="eyebrow">AI video localization</span>
                <h1>CineSync creator workspace</h1>
              </div>
              <div className="topbar-actions">
                <label className="prompt-search">
                  <span>Prompt</span>
                  <input placeholder="Describe a localized trailer, subtitle pass, or dubbing style" />
                </label>
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
