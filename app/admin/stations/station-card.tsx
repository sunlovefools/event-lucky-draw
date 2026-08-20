"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { editStationAction } from "@/app/admin/actions";
import { IconCheck, IconCopy, IconPencil, IconStore } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";

type StationCardProps = {
  station: { id: string; name: string; active: boolean; displayOrder?: number };
  index: number;
  redirectTo: string;
};

export function StationCard({ station, index, redirectTo }: StationCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(station.name);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const nameInput = useRef<HTMLInputElement>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stationHref = `/station/${encodeURIComponent(station.name)}`;
  const nameChanged = draftName.trim() !== station.name && draftName.trim().length > 0;

  useEffect(() => {
    if (editingName) nameInput.current?.focus();
  }, [editingName]);

  useEffect(() => {
    setDraftName(station.name);
  }, [station.name]);

  useEffect(() => () => {
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
  }, []);

  async function copyStationLink() {
    try {
      await navigator.clipboard.writeText(new URL(stationHref, window.location.origin).toString());
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => setCopyState("idle"), 2400);
  }

  return (
    <article className="station-card">
      <div className="station-card__number" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </div>
      <form action={editStationAction} className="station-card__form">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="stationId" value={station.id} />
        <input type="hidden" name="active" value={String(station.active)} />

        <div className="station-card__topline">
          <div className="station-card__identity">
            <span className="station-card__icon" aria-hidden="true">
              <IconStore size={19} />
            </span>
            <div>
              <div className="station-card__title-row">
                {editingName ? (
                  <input
                    ref={nameInput}
                    id={`station-${station.id}`}
                    name="name"
                    className="input station-card__title-input"
                    value={draftName}
                    required
                    aria-label="Exhibition station name"
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => {
                      if (!draftName.trim()) setDraftName(station.name);
                      setEditingName(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setDraftName(station.name);
                        setEditingName(false);
                      }
                    }}
                  />
                ) : (
                  <>
                    <strong className="station-card__name">{draftName}</strong>
                    <input type="hidden" name="name" value={draftName} />
                  </>
                )}
                <button
                  type="button"
                  className="icon-btn station-card__edit-name"
                  onClick={() => setEditingName(true)}
                  aria-label={`Edit ${station.name} name`}
                  title="Edit station name"
                >
                  <IconPencil size={15} />
                </button>
              </div>
              <span className="station-card__subtitle">Exhibition station</span>
            </div>
          </div>
          <div className="station-card__badges">
            <span className={`badge ${station.active ? "badge-success" : "badge-neutral"}`}>
              <span className="station-status-dot" aria-hidden="true" />
              {station.active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="station-card__controls">
          <div className="station-card__actions">
            <PendingSubmitButton
              className="btn btn-primary station-card__save"
              pendingLabel="Saving…"
              disabled={!nameChanged}
            >
              Save changes
            </PendingSubmitButton>
            <Link
              href={stationHref}
              className="btn btn-accent station-card__open"
              target="_blank"
              rel="noreferrer"
            >
              Open station page
            </Link>
            <button
              type="button"
              className={`station-card__copy ${copyState === "copied" ? "is-copied" : ""} ${copyState === "error" ? "is-error" : ""}`}
              onClick={copyStationLink}
              aria-label={`Copy link for ${station.name}`}
              aria-live="polite"
              title="Copy station link"
            >
              <span className="station-card__copy-icon" aria-hidden="true">
                {copyState === "copied" ? <IconCheck size={15} strokeWidth={2.5} /> : <IconCopy size={15} />}
              </span>
              {copyState === "copied" ? "Copied!" : copyState === "error" ? "Try again" : "Copy link"}
            </button>
          </div>
        </div>
      </form>
    </article>
  );
}
