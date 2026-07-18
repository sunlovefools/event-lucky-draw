import React from "react";

import { getHealthStatus, type HealthStatus } from "@/lib/health";

export async function Home({ healthPromise = getHealthStatus() }: { healthPromise?: Promise<HealthStatus> }) {
  const health = await healthPromise;

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="home-title">
        <p className="eyebrow">Event station quest</p>
        <h1 id="home-title">Event Station Quest Lucky Draw</h1>
        <p className="lead">Hosted app scaffold is online.</p>
      </section>

      <section className="health-card" aria-label="Application health">
        <h2>Stack health</h2>
        <dl>
          <div>
            <dt>App</dt>
            <dd>{health.app}</dd>
          </div>
          <div>
            <dt>Database</dt>
            <dd>Database: {health.database}</dd>
          </div>
          <div>
            <dt>Checked</dt>
            <dd>{health.checkedAt}</dd>
          </div>
        </dl>
        {health.error ? <p role="status" className="health-error">{health.error}</p> : null}
      </section>
    </main>
  );
}
