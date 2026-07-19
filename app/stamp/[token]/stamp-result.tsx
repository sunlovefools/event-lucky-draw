import React from "react";
import Link from "next/link";

import { friendlyError } from "@/lib/messages";
import type { StampCollectionResult } from "@/lib/stamp";

function StampIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 21V9a7 7 0 0 1 14 0v12" />
      <path d="M3 21h18" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

export function StampResult({ result }: { result: StampCollectionResult }) {
  if (!result.ok) {
    const message = friendlyError(result.error) ?? result.error;
    return (
      <main className="shell center" id="main">
        <section className="hero reveal" aria-labelledby="stamp-error-title">
          <span className="badge badge-danger" style={{ marginBottom: "1rem" }}>Station stamp</span>
          <div style={{ color: "var(--color-danger)", display: "grid", placeItems: "center", margin: "0.5rem 0" }}>
            <ErrorIcon />
          </div>
          <h1 id="stamp-error-title">Stamp not collected</h1>
          <p className="lead" style={{ margin: "0.75rem auto 0" }}>{message}</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: "1.5rem" }}>
            Back to start
          </Link>
        </section>
      </main>
    );
  }

  const title = result.duplicate ? "Already collected" : "Stamp collected!";
  const tone = result.duplicate ? "var(--color-warning)" : "var(--color-accent)";

  return (
    <main className="shell center" id="main">
      <section className="hero reveal" aria-labelledby="stamp-success-title">
        <span className={`badge ${result.duplicate ? "badge-warn" : "badge-success"}`} style={{ marginBottom: "1rem" }}>
          {result.station.name}
        </span>
        <div style={{ color: tone, display: "grid", placeItems: "center", margin: "0.5rem 0" }}>
          <StampIcon />
        </div>
        <h1 id="stamp-success-title">{title}</h1>
        <p className="lead" style={{ margin: "0.75rem auto 0" }}>{result.message}</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: "1.5rem" }}>
          View my progress
        </Link>
      </section>
    </main>
  );
}
