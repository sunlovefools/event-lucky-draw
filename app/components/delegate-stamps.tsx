"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ProgressStation } from "@/lib/delegate";

type DelegateStampsProps = {
  delegateId: string;
  stations: ProgressStation[];
};

function CheckIcon() {
  return (
    <svg className="stamp-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="stamp-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 0 1-15.3 6.4" />
      <path d="M3 12A9 9 0 0 1 18.3 5.6" />
      <path d="M18 2v4h-4" />
      <path d="M6 22v-4h4" />
    </svg>
  );
}

function storageKey(delegateId: string) {
  return `delegate-stamps:${delegateId}`;
}

function readCompletedStampIds(key: string) {
  try {
    const raw = window.sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === "string")) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

export function DelegateStamps({ delegateId, stations }: DelegateStampsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newStampIds, setNewStampIds] = useState<Set<string>>(new Set());
  const key = storageKey(delegateId);
  const refreshKey = `${key}:refresh`;
  const completedIds = useMemo(() => stations.filter((station) => station.completed).map((station) => station.id), [stations]);
  const completedSignature = completedIds.join("|");

  useEffect(() => {
    const previousCompletedIds = readCompletedStampIds(key);
    const refreshRequested = window.sessionStorage.getItem(refreshKey) === "1";
    const newlyCompletedIds = refreshRequested ? completedIds.filter((id) => !previousCompletedIds.has(id)) : [];

    setNewStampIds(new Set(newlyCompletedIds));
    window.sessionStorage.setItem(key, JSON.stringify(completedIds));
    window.sessionStorage.removeItem(refreshKey);

    if (newlyCompletedIds.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => setNewStampIds(new Set()), 900);
    return () => window.clearTimeout(timeout);
  }, [completedIds, completedSignature, key, refreshKey]);

  function refreshStamps() {
    window.sessionStorage.setItem(refreshKey, "1");
    startTransition(() => router.refresh());
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <div className="row-between" style={{ marginBottom: "0.75rem" }}>
        <h3>Stamps</h3>
        <button type="button" className="btn btn-sm btn-ghost" disabled={pending} onClick={refreshStamps}>
          <RefreshIcon />
          {pending ? "Refreshing…" : "Refresh Stamps"}
        </button>
      </div>

      <div className="stamp-grid" aria-live="polite">
        {stations.map((station) => {
          const isNewStamp = newStampIds.has(station.id);

          return (
            <div key={station.id} className={`stamp ${station.completed ? "stamp-done" : ""} ${station.locked ? "stamp-locked" : ""} ${isNewStamp ? "stamp-new" : ""}`}>
              {station.completed ? (
                <CheckIcon />
              ) : station.locked ? (
                <LockIcon />
              ) : (
                <span
                  className="stamp-check"
                  style={{ background: "transparent", border: "2px dashed var(--color-border-strong)", color: "var(--color-muted)" }}
                  aria-hidden="true"
                />
              )}
              <span className="stamp-name">{station.name}</span>
              {station.locked && station.lockReason ? <span className="stamp-lock-reason">{station.lockReason}</span> : null}
              {isNewStamp ? <span className="stamp-burst" aria-hidden="true">STAMP!</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
