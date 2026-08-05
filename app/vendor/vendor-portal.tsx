"use client";

import React, { useCallback, useEffect, useState } from "react";

import { GuidedTutorial, type TutorialStep } from "@/app/components/guided-tutorial";
import { RefreshButton } from "@/app/components/refresh-button";
import { VendorScanner } from "@/app/vendor/vendor-scanner";
import { friendlyError } from "@/lib/messages";
import type { StationDashboardResult, StationScanHistoryEntry } from "@/lib/vendor/portal";
import { STATION_SCAN_HISTORY_LIMIT } from "@/lib/vendor/config";

const VENDOR_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to your vendor Stamp Page",
    message: "Scan a delegate's conference badge QR code here to award your station stamp after the delegate has completed your station activity or survey.",
    target: "[data-tutorial='vendor-welcome']",
  },
  {
    title: "Check Before Scanning",
    message: "Please ensure that the delegate has completed your activity and that any required consent or information has been recorded before you scan their QR code.",
  },
  {
    title: "Scan or Enter the Delegate Code",
    message: "Scan the QR code on the delegate's conference badge. Their delegate code appears beneath the QR code in the format “DLGTxxxx”; choose Type code if you need to enter it manually.",
    target: "[data-tutorial='vendor-scan']",
  },
  {
    title: "Scan Successful",
    message: "A successful-scan message confirms that the stamp was awarded. Ask the delegate to press Refresh Progress on their page to refresh their stamps.",
    target: "[data-tutorial='vendor-success-demo']",
    effect: "vendor-success-demo",
  },
  {
    title: "Review Recent Scan Records",
    message: "Use Recent station scans to review the delegates successfully scanned at this station and when each scan was recorded.",
    target: "[data-tutorial='vendor-history']",
  },
  {
    title: "Ready for the Next Delegate",
    message: "The scan has been recorded. You are ready for the next delegate.",
  },
];

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
      <section className="hero" aria-labelledby="vendor-station-title" data-tutorial="vendor-welcome">
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
            <GuidedTutorial id="vendor-page" steps={VENDOR_TUTORIAL_STEPS} version={2} />
          </div>
        </div>
        <p className="lead">Use this station link to stamp delegates.</p>
        {errorMessage ? <p className="alert alert-danger" role="alert" style={{ marginTop: "1rem" }}>{errorMessage}</p> : null}
      </section>

      <section className="card" aria-labelledby="stamp-delegate-title" data-tutorial="vendor-scan">
        <div className="section-head">
          <h2 id="stamp-delegate-title">Stamp a delegate</h2>
          <span className="badge badge-info">Scan badge</span>
        </div>
        <p className="hint" style={{ marginTop: "0", marginBottom: "1rem" }}>
          Scan the delegate&apos;s badge QR, or enter the delegate code printed beneath it in the format <strong>DLGTxxxx</strong>. The stamp will be added to their passport instantly.
        </p>
        <div className="vendor-success-demo" data-tutorial="vendor-success-demo" aria-hidden="true">
          <span className="vendor-success-demo__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
          <div>
            <strong>Scan successful</strong>
            <p>Stamp awarded. Ask the delegate to press Refresh Progress to see their new stamp.</p>
          </div>
        </div>
        <VendorScanner participationOpen={participationOpen} stationName={station.name} onHistoryEntry={addHistoryEntry} />
      </section>

      <section className="card" aria-labelledby="scan-history-title" data-tutorial="vendor-history">
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
