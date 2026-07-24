"use client";

import React, { useCallback, useEffect, useState } from "react";

import { RefreshButton } from "@/app/components/refresh-button";
import { VendorScanner } from "@/app/vendor/vendor-scanner";
import { friendlyError } from "@/lib/messages";
import type { StationDashboardResult, StationScanHistoryEntry } from "@/lib/vendor/portal";
import { STATION_SCAN_HISTORY_LIMIT } from "@/lib/vendor/config";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function ActiveVendorPortal({
  dashboard,
  error,
}: {
  dashboard: Extract<StationDashboardResult, { found: true }>;
  error?: string;
}) {
  const { station, participationOpen, scanHistory } = dashboard;
  const [visibleHistory, setVisibleHistory] = useState(scanHistory);
  const errorMessage = friendlyError(error);

  useEffect(() => setVisibleHistory(scanHistory), [scanHistory]);

  const addHistoryEntry = useCallback((entry: StationScanHistoryEntry) => {
    setVisibleHistory((current) => [entry, ...current.filter((scan) => scan.id !== entry.id)].slice(0, STATION_SCAN_HISTORY_LIMIT));
  }, []);

  return (
    <main className="shell" id="main">
      <section className="hero" aria-labelledby="vendor-station-title">
        <div className="row-between">
          <div>
            <p className="eyebrow">Exhibition station</p>
            <h1 id="vendor-station-title">{station.name}</h1>
          </div>
          <div className="head-actions">
            <span className={`badge ${participationOpen ? "badge-success" : "badge-danger"}`}>
              <span className="dot" />
              {participationOpen ? "Participation open" : "Participation closed"}
            </span>
          </div>
        </div>
        <p className="lead">Use this station link to stamp delegates.</p>
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
        <VendorScanner participationOpen={participationOpen} stationName={station.name} onHistoryEntry={addHistoryEntry} />
      </section>

      <section className="card" aria-labelledby="scan-history-title">
        <div className="section-head">
          <h2 id="scan-history-title">Recent station scans</h2>
          <div className="head-actions">
            <span className="badge badge-neutral">Latest {visibleHistory.length} scans</span>
            <RefreshButton label="Refresh list" />
          </div>
        </div>
        {visibleHistory.length === 0 ? (
          <p className="empty">No scans yet.</p>
        ) : (
          <ul className="list">
            {visibleHistory.map((scan) => (
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

export function VendorPortal({ dashboard, error }: { dashboard: StationDashboardResult; error?: string }) {
  if (!dashboard.found) {
    return (
      <main className="shell" id="main">
        <section className="hero" aria-labelledby="station-not-found-title">
          <p className="eyebrow">Exhibition station</p>
          <h1 id="station-not-found-title">Station not found</h1>
          <p className="lead">Check the station link or ask an event organizer for help.</p>
        </section>
      </main>
    );
  }

  return <ActiveVendorPortal dashboard={dashboard} error={error} />;
}
