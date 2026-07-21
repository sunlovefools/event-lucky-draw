import React from "react";

import { RefreshButton } from "@/app/components/refresh-button";
import { logoutVendorAction } from "@/app/vendor/actions";
import { VendorScanner } from "@/app/vendor/vendor-scanner";
import { friendlyError } from "@/lib/messages";
import { VendorLoginForm } from "@/app/vendor/vendor-login-form";
import type { VendorDashboardResult } from "@/lib/vendor/portal";

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
          <p className="lead">Sign in to stamp delegates at your station.</p>
          {errorMessage ? <p className="alert alert-danger" role="alert">{errorMessage}</p> : null}
          <VendorLoginForm />
        </section>
      </main>
    );
  }

  const { station, participationOpen, scanHistory } = dashboard;
  const errorMessage = friendlyError(error);

  return (
    <main className="shell" id="main">
      <section className="hero" aria-labelledby="vendor-station-title">
        <div className="row-between">
          <div>
            <p className="eyebrow">Vendor station</p>
            <h1 id="vendor-station-title">{station.name}</h1>
          </div>
          <div className="head-actions">
            <span className={`badge ${participationOpen ? "badge-success" : "badge-danger"}`}>
              <span className="dot" />
              {participationOpen ? "Participation open" : "Participation closed"}
            </span>
            <form action={logoutVendorAction}>
              <button type="submit" className="btn btn-danger">
                Log out
              </button>
            </form>
          </div>
        </div>
        <p className="lead">Signed in as {dashboard.vendor.username}.</p>
        {errorMessage ? <p className="alert alert-danger" role="alert" style={{ marginTop: "1rem" }}>{errorMessage}</p> : null}
      </section>

      <section className="card" aria-labelledby="stamp-delegate-title">
        <div className="section-head">
          <h2 id="stamp-delegate-title">Stamp a delegate</h2>
          <span className="badge badge-info">Scan badge</span>
        </div>
        <p className="hint" style={{ marginTop: "0", marginBottom: "1rem" }}>
          Scan the delegate&apos;s badge QR (the same one they use to register). The stamp will then be added to their passport instantly.
        </p>
        <VendorScanner participationOpen={participationOpen} />
      </section>

      <section className="card" aria-labelledby="scan-history-title">
        <div className="section-head">
          <h2 id="scan-history-title">Station scan history</h2>
          <div className="head-actions">
            <span className="badge badge-neutral">{scanHistory.length} scans</span>
            <RefreshButton label="Refresh list" />
          </div>
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
    </main>
  );
}
