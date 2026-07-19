import React from "react";
import Link from "next/link";

import {
  createStationAction,
  createVendorAction,
  drawLuckyWinnerAction,
  editStationAction,
  editVendorAction,
  loginAdminAction,
  setDelegateDrawStatusAction,
  setParticipationAction,
  updateDelegateNameAction,
} from "@/app/admin/actions";
import { friendlyError } from "@/lib/messages";
import type { AdminDashboardResult } from "@/lib/admin/dashboard";
import type { Station } from "@/lib/shared/station";
import type { DelegateDrawStatus } from "@/lib/admin/participants";

function StationSelect({ stations, label, name, defaultValue }: { stations: Station[]; label: string; name: string; defaultValue?: string }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={`${name}-${defaultValue ?? "new"}`}>{label}</label>
      <select id={`${name}-${defaultValue ?? "new"}`} name={name} className="select" defaultValue={defaultValue ?? ""} required>
        <option value="" disabled>
          Choose a station
        </option>
        {stations.map((station) => (
          <option key={station.id} value={station.id}>
            {station.name} ({station.active ? "active" : "disabled"})
          </option>
        ))}
      </select>
    </div>
  );
}

const DRAW_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  eligible: { label: "Eligible", cls: "badge-success" },
  manual_include: { label: "Manual include", cls: "badge-info" },
  winner: { label: "Winner", cls: "badge-accent" },
  disqualified: { label: "Disqualified", cls: "badge-danger" },
  not_eligible: { label: "Not eligible", cls: "badge-neutral" },
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function AdminDashboard({ dashboard, error }: { dashboard: AdminDashboardResult; error?: string }) {
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

  const { participation, stations, vendorAccounts, participants, stationSummaries, scanAuditLogs, winnerHistory = [] } = dashboard;
  const errorMessage = friendlyError(error);
  const nextOpenValue = participation.open ? "false" : "true";
  const buttonLabel = participation.open ? "Close participation" : "Open participation";

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

      <nav className="section-nav" aria-label="Dashboard sections">
        <a href="#participation">Participation</a>
        <a href="#stations">Stations</a>
        <a href="#vendors">Vendors</a>
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

      {/* Stations */}
      <section className="card" id="stations" aria-labelledby="stations-title">
        <div className="section-head">
          <h2 id="stations-title">Stations</h2>
          <span className="badge badge-neutral">{stations.length}</span>
        </div>
        <form action={createStationAction} className="form">
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <div className="field">
              <label className="field-label" htmlFor="new-station-name">New station name</label>
              <input id="new-station-name" name="name" className="input" required placeholder="e.g. Booth A" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="new-station-active">Status</label>
              <select id="new-station-active" name="active" className="select" defaultValue="true">
                <option value="true">Active</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Create station</button>
        </form>

        {stations.length === 0 ? <p className="empty">No stations yet.</p> : (
          <ul className="list" style={{ marginTop: "1rem" }}>
            {stations.map((station) => (
              <li key={station.id} className="list-item">
                <div className="row-between">
                  <span className="list-item-title">{station.name}</span>
                  <span className={`badge ${station.active ? "badge-success" : "badge-neutral"}`}>{station.active ? "Active" : "Disabled"}</span>
                </div>
                <details className="disclosure">
                  <summary>Edit station</summary>
                  <div className="disclosure-body">
                    <form action={editStationAction} className="form">
                      <input type="hidden" name="stationId" value={station.id} />
                      <div className="field">
                        <label className="field-label" htmlFor={`edit-name-${station.id}`}>Station name</label>
                        <input id={`edit-name-${station.id}`} name="name" className="input" defaultValue={station.name} required />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor={`edit-active-${station.id}`}>Status</label>
                        <select id={`edit-active-${station.id}`} name="active" className="select" defaultValue={station.active ? "true" : "false"}>
                          <option value="true">Active</option>
                          <option value="false">Disabled</option>
                        </select>
                      </div>
                      <button type="submit" className="btn btn-ghost btn-sm">Save station</button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Vendors */}
      <section className="card" id="vendors" aria-labelledby="vendors-title">
        <div className="section-head">
          <h2 id="vendors-title">Vendor accounts</h2>
          <span className="badge badge-neutral">{vendorAccounts.length}</span>
        </div>
        <form action={createVendorAction} className="form">
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <div className="field">
              <label className="field-label" htmlFor="new-vendor-username">New vendor username</label>
              <input id="new-vendor-username" name="username" className="input" autoComplete="username" required />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="new-vendor-password">New vendor password</label>
              <input id="new-vendor-password" name="password" type="password" className="input" autoComplete="new-password" required />
            </div>
            <StationSelect stations={stations} label="New vendor station" name="stationId" />
            <div className="field">
              <label className="field-label" htmlFor="new-vendor-active">Status</label>
              <select id="new-vendor-active" name="active" className="select" defaultValue="true">
                <option value="true">Active</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Create vendor</button>
        </form>

        {vendorAccounts.length === 0 ? <p className="empty">No vendor accounts yet.</p> : (
          <ul className="list" style={{ marginTop: "1rem" }}>
            {vendorAccounts.map((vendor) => (
              <li key={vendor.id} className="list-item">
                <div className="row-between">
                  <span className="list-item-title">{vendor.username}</span>
                  <span className="row" style={{ gap: "0.5rem" }}>
                    <span className="badge badge-info">{vendor.stationName}</span>
                    <span className={`badge ${vendor.active ? "badge-success" : "badge-neutral"}`}>{vendor.active ? "Active" : "Disabled"}</span>
                  </span>
                </div>
                <details className="disclosure">
                  <summary>Edit vendor</summary>
                  <div className="disclosure-body">
                    <form action={editVendorAction} className="form">
                      <input type="hidden" name="vendorId" value={vendor.id} />
                      <div className="field">
                        <label className="field-label" htmlFor={`edit-vendor-user-${vendor.id}`}>Username</label>
                        <input id={`edit-vendor-user-${vendor.id}`} name="username" className="input" defaultValue={vendor.username} autoComplete="username" required />
                      </div>
                      <StationSelect stations={stations} label="Station" name="stationId" defaultValue={vendor.stationId} />
                      <div className="field">
                        <label className="field-label" htmlFor={`edit-vendor-active-${vendor.id}`}>Status</label>
                        <select id={`edit-vendor-active-${vendor.id}`} name="active" className="select" defaultValue={vendor.active ? "true" : "false"}>
                          <option value="true">Active</option>
                          <option value="false">Disabled</option>
                        </select>
                      </div>
                      <button type="submit" className="btn btn-ghost btn-sm">Save vendor</button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Lucky draw */}
      <section className="card" id="draw" aria-labelledby="lucky-draw-title">
        <div className="section-head">
          <h2 id="lucky-draw-title">Lucky draw</h2>
        </div>
        <form action={drawLuckyWinnerAction} className="form">
          <div className="field">
            <label className="field-label" htmlFor="drawLabel">Draw label</label>
            <input id="drawLabel" name="drawLabel" className="input" placeholder="Grand Prize" required />
          </div>
          <button type="submit" className="btn btn-accent">Draw winner</button>
        </form>
        <p className="hint" style={{ marginTop: "0.75rem" }}>
          The result appears on the <Link href="/draw">public display</Link>.
        </p>
      </section>

      {/* Winner history */}
      <section className="card" id="winners" aria-labelledby="winner-history-title">
        <div className="section-head">
          <h2 id="winner-history-title">Winner history</h2>
          <span className="badge badge-neutral">{winnerHistory.length}</span>
        </div>
        {winnerHistory.length === 0 ? <p className="empty">No winners drawn yet.</p> : (
          <ul className="list">
            {winnerHistory.map((winner) => (
              <li key={winner.id} className="list-item">
                <div className="row-between">
                  <span className="list-item-title">{winner.fullName}</span>
                  <span className="badge badge-accent">{winner.drawLabel}</span>
                </div>
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
              const badge = DRAW_STATUS_BADGE[participant.drawStatus as DelegateDrawStatus] ?? DRAW_STATUS_BADGE.not_eligible;
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
                      <input type="hidden" name="drawStatus" value="manual_include" />
                      <button type="submit" className="btn btn-ghost btn-sm">Manually include</button>
                    </form>
                    <form action={setDelegateDrawStatusAction}>
                      <input type="hidden" name="delegateId" value={participant.id} />
                      <input type="hidden" name="drawStatus" value="disqualified" />
                      <button type="submit" className="btn btn-ghost btn-sm">Disqualify</button>
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
