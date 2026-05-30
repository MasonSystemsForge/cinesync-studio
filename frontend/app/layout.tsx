import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "CineSync Studio",
  description: "AI-assisted video localization workflow scaffold"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <main className="shell">
          <header className="topbar">
            <Link href="/dashboard" className="brand">
              CineSync Studio
            </Link>
            <nav className="nav" aria-label="Primary navigation">
              <Link href="/dashboard" className="secondary">
                Dashboard
              </Link>
              <Link href="/upload">Upload</Link>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
