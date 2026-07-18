import React from "react";

import type { StampCollectionResult } from "@/lib/stamp";

export function StampResult({ result }: { result: StampCollectionResult }) {
  if (!result.ok) {
    return (
      <main className="shell">
        <section className="hero" aria-labelledby="stamp-error-title">
          <p className="eyebrow">Station stamp</p>
          <h1 id="stamp-error-title">Stamp not collected</h1>
          <p role="alert" className="health-error">{result.error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="stamp-success-title">
        <p className="eyebrow">Station stamp</p>
        <h1 id="stamp-success-title">Stamp collected</h1>
        <p className="lead">{result.message}</p>
      </section>
    </main>
  );
}
