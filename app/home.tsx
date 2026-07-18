import React from "react";

import { identifyDelegateAction } from "@/app/delegate/actions";
import type { DelegateHomeResult } from "@/lib/delegate";
import { getHealthStatus, type HealthStatus } from "@/lib/health";

export async function Home({
  healthPromise = getHealthStatus(),
  delegateHomePromise = Promise.resolve({ identified: false }),
  error,
}: {
  healthPromise?: Promise<HealthStatus>;
  delegateHomePromise?: Promise<DelegateHomeResult>;
  error?: string;
}) {
  const [health, delegateHome] = await Promise.all([healthPromise, delegateHomePromise]);

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="home-title">
        <p className="eyebrow">Event station quest</p>
        <h1 id="home-title">Event Station Quest Lucky Draw</h1>
        <p className="lead">Hosted app scaffold is online.</p>
      </section>

      <section className="health-card" aria-labelledby="delegate-title">
        {delegateHome.identified ? (
          <>
            <h2 id="delegate-title">Welcome back, {delegateHome.delegate.fullName}</h2>
            <p>Registration number: {delegateHome.delegate.registrationNumber}</p>
            <p className="lead">Your progress will resume on this device.</p>
            <section aria-labelledby="station-progress-title">
              <h3 id="station-progress-title">Station progress</h3>
              <p>
                {delegateHome.progress.completedCount} of {delegateHome.progress.totalRequired} required stations complete
              </p>
              <p>{delegateHome.progress.remainingCount === 1 ? "1 stamp remaining" : `${delegateHome.progress.remainingCount} stamps remaining`}</p>
              {delegateHome.progress.readyForFinalSurvey ? (
                <p className="status-open">All required station stamps are complete.</p>
              ) : null}
              <ul className="station-progress-list">
                {delegateHome.progress.stations.map((station) => (
                  <li key={station.id}>{station.name} — {station.completed ? "completed" : "not completed"}</li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <>
            <h2 id="delegate-title">Join the lucky draw</h2>
            <p className="lead">Scan your badge QR or manually enter your registration number.</p>
            {error ? <p role="alert" className="health-error">{error}</p> : null}
            <form action={identifyDelegateAction} className="control-form">
              <label>
                Badge QR payload or registration number
                <input name="badgePayload" autoComplete="off" required />
              </label>
              <label>
                Full name
                <input name="fullName" autoComplete="name" />
              </label>
              <button type="submit">Continue</button>
            </form>
          </>
        )}
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
