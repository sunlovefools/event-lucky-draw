import React from "react";

import { generateStationQrAction, loginVendorAction } from "@/app/vendor/actions";
import type { VendorDashboardResult } from "@/lib/vendor";

export function VendorPortal({ dashboard, error }: { dashboard: VendorDashboardResult; error?: string }) {
  if (!dashboard.authorized) {
    return (
      <main className="shell">
        <section className="hero" aria-labelledby="vendor-login-title">
          <p className="eyebrow">Vendor</p>
          <h1 id="vendor-login-title">Vendor login</h1>
          <p className="lead">Sign in to generate station stamp QRs.</p>
          {error ? <p role="alert" className="health-error">{error}</p> : null}
          <form action={loginVendorAction} className="control-form">
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

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="vendor-station-title">
        <p className="eyebrow">Vendor station</p>
        <h1 id="vendor-station-title">{dashboard.station.name}</h1>
        <p className="lead">Signed in as {dashboard.vendor.username}</p>
        {error ? <p role="alert" className="health-error">{error}</p> : null}
      </section>

      <section className="health-card" aria-labelledby="station-qr-title">
        <h2 id="station-qr-title">Station stamp QR</h2>
        {dashboard.participationOpen ? (
          <form action={generateStationQrAction} className="control-form">
            <button type="submit">Generate new QR</button>
          </form>
        ) : (
          <p className="health-error">Participation is closed. QR generation is disabled.</p>
        )}

        {dashboard.currentQr ? (
          <div className="qr-panel">
            <p>{dashboard.currentQr.url}</p>
            <p>Expires at {dashboard.currentQr.expiresAt}</p>
          </div>
        ) : (
          <p>No active QR. Generate one when a delegate is ready to scan.</p>
        )}
      </section>
    </main>
  );
}
