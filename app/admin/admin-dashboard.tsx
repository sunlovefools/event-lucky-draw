import React from "react";
import Link from "next/link";

import {
  loginAdminAction,
  resetDrawRoundAction,
  deleteDrawRoundAction,
  setDelegateDrawStatusAction,
  setParticipationAction,
  updateDelegateNameAction,
} from "@/app/admin/actions";
import { friendlyError } from "@/lib/messages";
import type { AdminDashboardResult } from "@/lib/admin/dashboard";
import type { DelegateDrawStatus } from "@/lib/admin/participants";
import type { HealthStatus } from "@/lib/health";


const DRAW_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  eligible: { label: "Force eligible", cls: "badge-success" },
  excluded: { label: "Excluded", cls: "badge-danger" },
  auto: { label: "Auto", cls: "badge-neutral" },
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function AdminDashboard({ dashboard, error, health }: { dashboard: AdminDashboardResult; error?: string; health?: HealthStatus }) {
  if (!dashboard.authorized) {
    const errorMessage = friendlyError(error);
    return (
      <main className="shell" id="main">
        <section className="hero" aria-labelledby="admin-login-title">
          <p className="eyebrow">Admin</p>
          <h1 id="admin-login-title">Admin login</h1>
          <p className="lead">Sign in to control the event.</p>
          {errorMessage ? <p className="alert alert-danger" role="alert">{errorMessage}</p> : null}
          <form action={loginAdminAction} className="form" style={{ marginTop: "1.25rem" }}>
            <div className="field">
              <label className="field-label" htmlFor="a-username">Username</label>
              <input id="a-username" name="username" className="input" autoComplete="username" required autoFocus />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="a-password">Password</label>
              <input id="a-password" name="password" type="password" className="input" autoComplete="current-password" required />
            </div>
            <button type="submit" className="btn btn-primary btn-block">Log in</button>
          </form>
        </section>
      </main>
    );
  }

  const { participation, participants, stationSummaries, scanAuditLogs, drawRounds = [] } = dashboard;
  const errorMessage = friendlyError(error);
  const nextOpenValue = participation.open ? "false" : "true";
  const buttonLabel = participation.open ? "Close participation" : "Open participation";
  const totalWinners = drawRounds.reduce((count, round) => count + round.winners.length, 0);

  return (
    <main className="shell shell-wide" id="main">
      <section className="hero" aria-labelledby="admin-dashboard-title">
        <div className="row-between">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 id="admin-dashboard-title">Admin dashboard</h1>
            <p className="lead">Signed in as {dashboard.admin.username}</p>
          </div>
          <span className={`badge ${participation.open ? "badge-success" : "badge-danger"}`}>
            <span className="dot" />
            {participation.open ? "Participation open" : "Participation closed"}
          </span>
        </div>
        {errorMessage ? <p className="alert alert-danger" role="alert" style={{ marginTop: "1rem" }}>{errorMessage}</p> : null}
      </section>

      <section className="card" id="status" aria-label="Application health">
        <div className="section-head">
          <h2>System status</h2>
          <span className={`badge ${health?.ok && health?.database === "reachable" ? "badge-success" : "badge-warn"}`}>
            <span className="dot" />
            {health?.ok && health?.database === "reachable" ? "All systems go" : "Check status"}
          </span>
        </div>
        <dl className="health">
          <div>
            <dt>App</dt>
            <dd>{health?.app}</dd>
          </div>
          <div>
            <dt>Database</dt>
            <dd>{health?.database}</dd>
          </div>
          <div>
            <dt>Last checked</dt>
            <dd>{health?.checkedAt}</dd>
          </div>
        </dl>
        {health?.error ? <p className="alert alert-danger" style={{ marginTop: "1rem" }}>{health.error}</p> : null}
      </section>

      <nav className="section-nav" aria-label="Dashboard sections">
        <a href="#participation">Participation</a>
        <a href="#status">Status</a>
        <a href="#draw">Draw</a>
        <a href="#winners">Winners</a>
        <a href="#exports">Exports</a>
        <a href="#summary">Summary</a>
        <a href="#audit">Audit</a>
        <a href="#participants">Participants</a>
      </nav>

      {/* Participation */}
      <section className="card" id="participation" aria-labelledby="participation-title">
        <div className="section-head">
          <h2 id="participation-title">Participation control</h2>
          <span className={`badge ${participation.open ? "badge-success" : "badge-danger"}`}>{participation.open ? "Open" : "Closed"}</span>
        </div>
        <p className="muted">Last changed by {participation.updatedByUsername ?? "unknown admin"} at {formatTime(participation.updatedAt)}</p>
        <form action={setParticipationAction} style={{ marginTop: "1rem" }}>
          <input type="hidden" name="open" value={nextOpenValue} />
          <button type="submit" className={participation.open ? "btn btn-danger" : "btn btn-accent"}>{buttonLabel}</button>
        </form>
      </section>

      {/* Exhibition stations */}
      <section className="card" id="vendors" aria-labelledby="vendors-title">
        <div className="section-head">
          <h2 id="vendors-title">Exhibition stations</h2>
          <span className="badge badge-neutral">{dashboard.stations.length} station(s)</span>
        </div>
        <p className="muted">
          Each exhibition station has a direct station link for stamping delegates. No password is required.
        </p>
        {dashboard.stations.length === 0 ? (
          <p className="empty">No exhibition stations yet.</p>
        ) : (
          <ul className="list">
            {dashboard.stations.map((station) => (
              <li key={station.id} className="list-item">
                <div className="row-between">
                  <span className="list-item-title">{station.name}</span>
                  <span className={`badge ${station.active ? "badge-success" : "badge-neutral"}`}>{station.active ? "Active" : "Inactive"}</span>
                </div>
                <a className="muted" href={`/station/${encodeURIComponent(station.name)}`} target="_blank" rel="noreferrer">Open station link</a>
              </li>
            ))}
          </ul>
        )}
        <a href="/admin/stations" className="btn btn-primary btn-sm" style={{ marginTop: "1rem" }}>
          Manage exhibition stations
        </a>
      </section>

      {/* Lucky draw */}
      <section className="card" id="draw" aria-labelledby="lucky-draw-title">
        <div className="section-head">
          <h2 id="lucky-draw-title">Lucky draw</h2>
        </div>
        <p className="muted">Open the draw screen to pick a winner. Reset clears winner history so everyone becomes eligible again.</p>
        <div className="row" style={{ gap: "0.5rem", marginTop: "1rem" }}>
          <a href="/display" className="btn btn-accent" target="_blank" rel="noreferrer">Open draw screen</a>
          <form action={resetDrawRoundAction}>
            <button type="submit" className="btn btn-primary">Reset winners</button>
          </form>
        </div>
      </section>

      {/* Winner history (by round) */}
      <section className="card" id="winners" aria-labelledby="winner-history-title">
        <div className="section-head">
          <h2 id="winner-history-title">Winner history</h2>
          <span className="badge badge-neutral">{totalWinners}</span>
        </div>
        {totalWinners === 0 ? <p className="empty">No winners yet.</p> : (
          <ul className="list">
            {drawRounds.flatMap((draw) => draw.winners).map((winner) => (
              <li key={winner.id} className="list-item">
                <span className="list-item-title">{winner.fullName}</span>
                <span className="muted nowrap">#{winner.registrationNumber} · {formatTime(winner.wonAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Exports */}
      <section className="card" id="exports" aria-labelledby="exports-title">
        <div className="section-head">
          <h2 id="exports-title">Exports</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <a href="/admin/exports/participants" className="btn btn-ghost btn-block">Participants / progress</a>
          <a href="/admin/exports/station-completions" className="btn btn-ghost btn-block">Station completions</a>
          <a href="/admin/exports/survey-responses" className="btn btn-ghost btn-block">Survey responses</a>
          <a href="/admin/exports/winner-history" className="btn btn-ghost btn-block">Winner history</a>
          <a href="/admin/exports/scan-audit" className="btn btn-ghost btn-block">Scan audit logs</a>
        </div>
      </section>

      {/* Station summary */}
      <section className="card" id="summary" aria-labelledby="station-summary-title">
        <div className="section-head">
          <h2 id="station-summary-title">Station summary</h2>
        </div>
        {stationSummaries.length === 0 ? <p className="empty">No station completions yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Status</th>
                  <th>Completions</th>
                </tr>
              </thead>
              <tbody>
                {stationSummaries.map((summary) => (
                  <tr key={summary.stationId}>
                    <td>{summary.stationName}</td>
                    <td><span className={`badge ${summary.active ? "badge-success" : "badge-neutral"}`}>{summary.active ? "Active" : "Disabled"}</span></td>
                    <td>{summary.completions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Scan audit */}
      <section className="card" id="audit" aria-labelledby="scan-audit-title">
        <div className="section-head">
          <h2 id="scan-audit-title">Scan audit log</h2>
          <span className="badge badge-neutral">{scanAuditLogs.length}</span>
        </div>
        {scanAuditLogs.length === 0 ? <p className="empty">No scan attempts yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Delegate</th>
                  <th>Station</th>
                  <th>Scanned</th>
                  <th>Result</th>
                  <th>Consumed</th>
                </tr>
              </thead>
              <tbody>
                {scanAuditLogs.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.delegateFullName ?? "Unknown"}</td>
                    <td>{entry.stationName ?? "Unknown"}</td>
                    <td className="nowrap">{formatTime(entry.scannedAt)}</td>
                    <td><span className={`badge ${entry.result === "success" ? "badge-success" : entry.result === "duplicate" ? "badge-warn" : "badge-danger"}`}>{entry.result}</span></td>
                    <td>{entry.consumed ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Participants */}
      <section className="card" id="participants" aria-labelledby="participants-title">
        <div className="section-head">
          <h2 id="participants-title">Participants</h2>
          <span className="badge badge-neutral">{participants.length}</span>
        </div>
        {participants.length === 0 ? <p className="empty">No participants yet.</p> : (
          <ul className="list">
            {participants.map((participant) => {
              const badge = DRAW_STATUS_BADGE[participant.drawStatus as DelegateDrawStatus] ?? DRAW_STATUS_BADGE.auto;
              return (
                <li key={participant.id} className="list-item">
                  <div className="row-between">
                    <div>
                      <span className="list-item-title">{participant.fullName}</span>
                      <div className="muted">#{participant.registrationNumber} · {participant.stampsCollected}/{participant.totalActiveStations} stamps · {participant.surveySubmitted ? "survey done" : "no survey"}</div>
                    </div>
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="row" style={{ gap: "0.5rem" }}>
                    <form action={setDelegateDrawStatusAction}>
                      <input type="hidden" name="delegateId" value={participant.id} />
                      <input type="hidden" name="drawStatus" value="eligible" />
                      <button type="submit" className="btn btn-ghost btn-sm">Mark eligible</button>
                    </form>
                    <form action={setDelegateDrawStatusAction}>
                      <input type="hidden" name="delegateId" value={participant.id} />
                      <input type="hidden" name="drawStatus" value="excluded" />
                      <button type="submit" className="btn btn-ghost btn-sm">Exclude</button>
                    </form>
                    <details className="disclosure" style={{ flex: "1 1 200px" }}>
                      <summary>Rename</summary>
                      <div className="disclosure-body">
                        <form action={updateDelegateNameAction} className="form">
                          <input type="hidden" name="delegateId" value={participant.id} />
                          <div className="field">
                            <label className="field-label" htmlFor={`rename-${participant.id}`}>Full name</label>
                            <input id={`rename-${participant.id}`} name="fullName" className="input" defaultValue={participant.fullName} required />
                          </div>
                          <button type="submit" className="btn btn-ghost btn-sm">Save name</button>
                        </form>
                      </div>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
