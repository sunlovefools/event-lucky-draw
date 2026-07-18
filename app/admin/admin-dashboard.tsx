import React from "react";

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
import type { AdminDashboardResult } from "@/lib/admin/dashboard";
import type { Station } from "@/lib/shared/station";

function StationSelect({ stations, label, name, defaultValue }: { stations: Station[]; label: string; name: string; defaultValue?: string }) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={defaultValue ?? ""} required>
        <option value="" disabled>
          Choose a station
        </option>
        {stations.map((station) => (
          <option key={station.id} value={station.id}>
            {station.name} ({station.active ? "active" : "disabled"})
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminDashboard({ dashboard, error }: { dashboard: AdminDashboardResult; error?: string }) {
  if (!dashboard.authorized) {
    return (
      <main className="shell">
        <section className="hero" aria-labelledby="admin-login-title">
          <p className="eyebrow">Admin</p>
          <h1 id="admin-login-title">Admin login</h1>
          <p className="lead">Sign in to control event participation.</p>
          {error ? <p role="alert" className="health-error">{error}</p> : null}
          <form action={loginAdminAction} className="control-form">
            <label>
              Username
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit">Log in</button>
          </form>
        </section>
      </main>
    );
  }

  const { participation, stations, vendorAccounts, participants, stationSummaries, scanAuditLogs, winnerHistory = [] } = dashboard;
  const nextOpenValue = participation.open ? "false" : "true";
  const buttonLabel = participation.open ? "Close participation" : "Open participation";
  const changedBy = participation.updatedByUsername ?? "unknown admin";

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="admin-dashboard-title">
        <p className="eyebrow">Admin</p>
        <h1 id="admin-dashboard-title">Admin dashboard</h1>
        <p className="lead">Signed in as {dashboard.admin.username}</p>
        {error ? <p role="alert" className="health-error">{error}</p> : null}
      </section>

      <section className="health-card" aria-labelledby="participation-title">
        <h2 id="participation-title">Participation control</h2>
        <p className={participation.open ? "status-open" : "health-error"}>
          Participation is {participation.open ? "open" : "closed"}
        </p>
        <p>Last changed by {changedBy} at {participation.updatedAt}</p>
        <form action={setParticipationAction} className="control-form">
          <input type="hidden" name="open" value={nextOpenValue} />
          <button type="submit">{buttonLabel}</button>
        </form>
      </section>

      <section className="health-card" aria-labelledby="stations-title">
        <h2 id="stations-title">Stations</h2>
        <form action={createStationAction} className="control-form">
          <label>
            New station name
            <input name="name" required />
          </label>
          <label>
            New station status
            <select name="active" defaultValue="true">
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <button type="submit">Create station</button>
        </form>

        {stations.length === 0 ? <p>No stations yet.</p> : null}
        <div className="item-list">
          {stations.map((station) => (
            <article key={station.id} className="list-item">
              <p>{station.name} — {station.active ? "active" : "disabled"}</p>
              <form action={editStationAction} className="control-form">
                <input type="hidden" name="stationId" value={station.id} />
                <label>
                  Station name for {station.name}
                  <input name="name" defaultValue={station.name} required />
                </label>
                <label>
                  Station status for {station.name}
                  <select name="active" defaultValue={station.active ? "true" : "false"}>
                    <option value="true">Active</option>
                    <option value="false">Disabled</option>
                  </select>
                </label>
                <button type="submit">Save station</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="health-card" aria-labelledby="vendors-title">
        <h2 id="vendors-title">Vendor accounts</h2>
        <form action={createVendorAction} className="control-form">
          <label>
            New vendor username
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            New vendor password
            <input name="password" type="password" autoComplete="new-password" required />
          </label>
          <StationSelect stations={stations} label="New vendor station" name="stationId" />
          <label>
            New vendor status
            <select name="active" defaultValue="true">
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <button type="submit">Create vendor</button>
        </form>

        {vendorAccounts.length === 0 ? <p>No vendor accounts yet.</p> : null}
        <div className="item-list">
          {vendorAccounts.map((vendor) => (
            <article key={vendor.id} className="list-item">
              <p>{vendor.username} — {vendor.stationName} — {vendor.active ? "active" : "disabled"}</p>
              <form action={editVendorAction} className="control-form">
                <input type="hidden" name="vendorId" value={vendor.id} />
                <label>
                  Vendor username for {vendor.username}
                  <input name="username" defaultValue={vendor.username} autoComplete="username" required />
                </label>
                <StationSelect stations={stations} label={`Vendor station for ${vendor.username}`} name="stationId" defaultValue={vendor.stationId} />
                <label>
                  Vendor status for {vendor.username}
                  <select name="active" defaultValue={vendor.active ? "true" : "false"}>
                    <option value="true">Active</option>
                    <option value="false">Disabled</option>
                  </select>
                </label>
                <button type="submit">Save vendor</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="health-card" aria-labelledby="lucky-draw-title">
        <h2 id="lucky-draw-title">Lucky draw</h2>
        <form action={drawLuckyWinnerAction} className="control-form">
          <label>
            Draw label
            <input name="drawLabel" placeholder="Grand Prize" required />
          </label>
          <button type="submit">Draw winner</button>
        </form>
      </section>

      <section className="health-card" aria-labelledby="winner-history-title">
        <h2 id="winner-history-title">Winner history</h2>
        {winnerHistory.length === 0 ? <p>No winners drawn yet.</p> : null}
        <div className="item-list">
          {winnerHistory.map((winner) => (
            <article key={winner.id} className="list-item">
              <p>{winner.drawLabel} — {winner.fullName} — {winner.registrationNumber} — {winner.wonAt}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="health-card" aria-labelledby="exports-title">
        <h2 id="exports-title">Exports</h2>
        <div className="item-list">
          <a href="/admin/exports/participants">Export participants/progress</a>
          <a href="/admin/exports/station-completions">Export station completions</a>
          <a href="/admin/exports/survey-responses">Export survey responses</a>
          <a href="/admin/exports/winner-history">Export winner history</a>
          <a href="/admin/exports/scan-audit">Export scan audit logs</a>
        </div>
      </section>

      <section className="health-card" aria-labelledby="station-summary-title">
        <h2 id="station-summary-title">Station summary</h2>
        {stationSummaries.length === 0 ? <p>No station completions yet.</p> : null}
        <div className="item-list">
          {stationSummaries.map((summary) => (
            <article key={summary.stationId} className="list-item">
              <p>{summary.stationName} — {summary.active ? "active" : "disabled"} — {summary.completions} completions</p>
            </article>
          ))}
        </div>
      </section>

      <section className="health-card" aria-labelledby="scan-audit-title">
        <h2 id="scan-audit-title">Scan audit log</h2>
        {scanAuditLogs.length === 0 ? <p>No scan attempts yet.</p> : null}
        <div className="item-list">
          {scanAuditLogs.map((entry) => (
            <article key={entry.id} className="list-item">
              <p>
                {entry.delegateFullName ?? "Unknown delegate"} — {entry.stationName ?? "Unknown station"} — {entry.scannedAt} — token {entry.qrToken} — {entry.result} — {entry.consumed ? "consumed" : "not consumed"}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="health-card" aria-labelledby="participants-title">
        <h2 id="participants-title">Participants</h2>
        {participants.length === 0 ? <p>No participants yet.</p> : null}
        <div className="item-list">
          {participants.map((participant) => (
            <article key={participant.id} className="list-item">
              <p>
                {participant.fullName} — {participant.registrationNumber} — {participant.stampsCollected}/{participant.totalActiveStations} stamps — {participant.surveySubmitted ? "survey submitted" : "survey not submitted"} — {participant.drawStatus}
              </p>
              <form action={updateDelegateNameAction} className="control-form">
                <input type="hidden" name="delegateId" value={participant.id} />
                <label>
                  Full name for {participant.fullName}
                  <input name="fullName" defaultValue={participant.fullName} required />
                </label>
                <button type="submit">Save delegate</button>
              </form>
              <form action={setDelegateDrawStatusAction} className="control-form">
                <input type="hidden" name="delegateId" value={participant.id} />
                <input type="hidden" name="drawStatus" value="manual_include" />
                <button type="submit">Manually include</button>
              </form>
              <form action={setDelegateDrawStatusAction} className="control-form">
                <input type="hidden" name="delegateId" value={participant.id} />
                <input type="hidden" name="drawStatus" value="disqualified" />
                <button type="submit">Disqualify</button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
