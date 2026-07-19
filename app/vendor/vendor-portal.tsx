import React from "react";
import Link from "next/link";

import { AutoRefresh } from "@/app/components/auto-refresh";
import { QrDisplay } from "@/app/components/qr-display";
import { friendlyError } from "@/lib/messages";
import { loginVendorAction, generateStationQrAction } from "@/app/vendor/actions";
import type { VendorDashboardResult } from "@/lib/vendor/portal";
import type { StationQrStatus } from "@/lib/vendor/portal";

const QR_STATUS: Record<StationQrStatus, { label: string; cls: string }> = {
  active: { label: "Active — ready to scan", cls: "badge-success" },
  consumed: { label: "Scanned", cls: "badge-neutral" },
  expired: { label: "Expired", cls: "badge-warn" },
  invalidated: { label: "Replaced", cls: "badge-warn" },
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

export function VendorPortal({ dashboard, error }: { dashboard: VendorDashboardResult; error?: string }) {
  if (!dashboard.authorized) {
    const errorMessage = friendlyError(error);
    return (
      <main className="shell" id="main">
        <section className="hero" aria-labelledby="vendor-login-title">
          <p className="eyebrow">Vendor</p>
          <h1 id="vendor-login-title">Vendor login</h1>
          <p className="lead">Sign in to generate your station stamp QR.</p>
          {errorMessage ? <p className="alert alert-danger" role="alert">{errorMessage}</p> : null}
          <form action={loginVendorAction} className="form" style={{ marginTop: "1.25rem" }}>
            <div className="field">
              <label className="field-label" htmlFor="v-username">Username</label>
              <input id="v-username" name="username" className="input" autoComplete="username" required autoFocus />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="v-password">Password</label>
              <input id="v-password" name="password" type="password" className="input" autoComplete="current-password" required />
            </div>
            <button type="submit" className="btn btn-primary btn-block">Log in</button>
          </form>
        </section>
      </main>
    );
  }

  const { station, participationOpen, currentQr, scanHistory } = dashboard;
  const errorMessage = friendlyError(error);

  return (
    <main className="shell" id="main">
      <AutoRefresh intervalMs={5000} />

      <section className="hero" aria-labelledby="vendor-station-title">
        <div className="row-between">
          <div>
            <p className="eyebrow">Vendor station</p>
            <h1 id="vendor-station-title">{station.name}</h1>
          </div>
          <span className={`badge ${participationOpen ? "badge-success" : "badge-danger"}`}>
            <span className="dot" />
            {participationOpen ? "Participation open" : "Participation closed"}
          </span>
        </div>
        <p className="lead">Signed in as {dashboard.vendor.username}.</p>
        <p className="muted">This page refreshes automatically.</p>
        {errorMessage ? <p className="alert alert-danger" role="alert" style={{ marginTop: "1rem" }}>{errorMessage}</p> : null}
      </section>

      <section className="card" aria-labelledby="station-qr-title">
        <div className="section-head">
          <h2 id="station-qr-title">Station stamp QR</h2>
          {currentQr ? <span className={`badge ${QR_STATUS[currentQr.status].cls}`}>{QR_STATUS[currentQr.status].label}</span> : null}
        </div>

        {participationOpen ? (
          <form action={generateStationQrAction}>
            <button type="submit" className="btn btn-accent">Generate new QR</button>
            <p className="hint" style={{ marginTop: "0.5rem" }}>
              Each new QR replaces the previous one. Show it to the delegate to scan.
            </p>
          </form>
        ) : (
          <p className="alert alert-danger">Participation is closed. QR generation is disabled.</p>
        )}

        {currentQr ? (
          <div className="stack" style={{ marginTop: "1.25rem" }}>
            <QrDisplay value={currentQr.url} label={`Station QR for ${station.name}`} />
            {currentQr.scannedByFullName ? (
              <p className="alert alert-info">Scanned by {currentQr.scannedByFullName}</p>
            ) : null}
            {currentQr.consumedAt ? (
              <p className="muted">Consumed at {formatTime(currentQr.consumedAt)}</p>
            ) : null}
            <p className="muted">Expires at {formatTime(currentQr.expiresAt)}</p>
          </div>
        ) : (
          <p className="empty">No active QR yet. Generate one when a delegate is ready to scan.</p>
        )}
      </section>

      <section className="card" aria-labelledby="scan-history-title">
        <div className="section-head">
          <h2 id="scan-history-title">Station scan history</h2>
          <span className="badge badge-neutral">{scanHistory.length} scans</span>
        </div>
        {scanHistory.length === 0 ? (
          <p className="empty">No scans yet.</p>
        ) : (
          <ul className="list">
            {scanHistory.map((scan) => (
              <li key={scan.id} className="list-item">
                <div className="row-between">
                  <span className="list-item-title">{scan.delegateFullName}</span>
                  <span className="muted nowrap">{formatTime(scan.collectedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="center muted">
        <Link href="/">Event home</Link>
      </p>
    </main>
  );
}
