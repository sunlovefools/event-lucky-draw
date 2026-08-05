"use client";

import { useEffect, useRef, useState } from "react";

import { saveDrawSettingsAction } from "@/app/admin/actions";
import { IconPlay, IconSettings, IconX } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";
import type { DrawSettings } from "@/lib/admin/draw-settings";
import { createShuffledNameDeck } from "@/lib/shared/name-deck";

function seconds(milliseconds: number) {
  return milliseconds / 1000;
}

export function DrawSettingsModal({
  settings,
  candidateNames,
  redirectTo,
}: {
  settings: DrawSettings;
  candidateNames: string[];
  redirectTo: "/admin" | "/admin/winners";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDeck = useRef<ReturnType<typeof createShuffledNameDeck> | null>(null);
  const [spinDuration, setSpinDuration] = useState(String(seconds(settings.spinDurationMs)));
  const [nameDuration, setNameDuration] = useState(String(seconds(settings.nameDisplayDurationMs)));
  const [previewName, setPreviewName] = useState(candidateNames[0] ?? "No eligible candidates");
  const [previewing, setPreviewing] = useState(false);

  function stopPreview() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    setPreviewing(false);
  }

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function closeDialog() {
    stopPreview();
    setSpinDuration(String(seconds(settings.spinDurationMs)));
    setNameDuration(String(seconds(settings.nameDisplayDurationMs)));
    setPreviewName(candidateNames[0] ?? "No eligible candidates");
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function startPreview() {
    if (candidateNames.length === 0 || previewing) return;
    stopPreview();
    setPreviewing(true);
    previewDeck.current = createShuffledNameDeck(candidateNames, previewName);
    setPreviewName(previewDeck.current());

    const intervalMs = Math.max(50, Number(nameDuration) * 1000);
    const totalMs = Math.max(1000, Number(spinDuration) * 1000);
    intervalRef.current = setInterval(() => {
      setPreviewName((current) => previewDeck.current?.() ?? current);
    }, intervalMs);
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      timeoutRef.current = null;
      setPreviewing(false);
    }, totalMs);
  }

  return (
    <>
      <button type="button" className="icon-btn draw-settings-trigger" onClick={openDialog}>
        <IconSettings size={17} />
        Settings
      </button>

      <dialog ref={dialogRef} className="draw-settings-dialog" aria-labelledby="draw-settings-title" onClose={stopPreview}>
        <div className="draw-settings-dialog__header">
          <span className="draw-settings-dialog__icon" aria-hidden="true"><IconSettings size={22} /></span>
          <div>
            <p className="eyebrow">Lucky draw</p>
            <h2 id="draw-settings-title">Animation settings</h2>
          </div>
          <button type="button" className="icon-btn" onClick={closeDialog} aria-label="Close draw settings"><IconX size={18} /></button>
        </div>

        <p className="draw-settings-dialog__intro">
          Control how long the draw spins and how quickly candidate names change before the winner is announced.
        </p>

        <form action={saveDrawSettingsAction} className="draw-settings-form">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="draw-settings-fields">
            <label className="field">
              <span className="field-label">Total spinning time</span>
              <span className="draw-settings-number">
                <input
                  className="input"
                  type="number"
                  name="spinDurationSeconds"
                  min="1"
                  max="60"
                  step="1"
                  value={spinDuration}
                  onChange={(event) => setSpinDuration(event.currentTarget.value)}
                  required
                />
                <span>seconds</span>
              </span>
              <span className="hint">The winner appears after this amount of time.</span>
            </label>

            <label className="field">
              <span className="field-label">Time each name stays visible</span>
              <span className="draw-settings-number">
                <input
                  className="input"
                  type="number"
                  name="nameDisplayDurationSeconds"
                  min="0.05"
                  max="2"
                  step="0.05"
                  value={nameDuration}
                  onChange={(event) => setNameDuration(event.currentTarget.value)}
                  required
                />
                <span>seconds</span>
              </span>
              <span className="hint">Lower values make the names change faster.</span>
            </label>
          </div>

          <section className="draw-settings-preview" aria-labelledby="draw-preview-title">
            <div className="draw-settings-preview__heading">
              <div>
                <h3 id="draw-preview-title">Animation preview</h3>
                <p>{candidateNames.length} eligible candidate{candidateNames.length === 1 ? "" : "s"} in the current draw pool</p>
              </div>
              <button type="button" className="btn btn-accent btn-sm" onClick={startPreview} disabled={previewing || candidateNames.length === 0}>
                <IconPlay size={16} />
                {previewing ? "Previewing…" : "Preview animation"}
              </button>
            </div>
            <div className={`draw-settings-slot${previewing ? " is-spinning" : ""}`} aria-live={previewing ? "off" : "polite"}>
              <span>{previewName}</span>
            </div>
            <p className="draw-settings-preview__status">
              {candidateNames.length === 0
                ? "No eligible candidates are currently available for the preview."
                : previewing
                  ? `Previewing ${spinDuration || 0} seconds at ${nameDuration || 0} seconds per name.`
                  : "This preview does not select or record a winner."}
            </p>
          </section>

          <div className="draw-settings-dialog__actions">
            <button type="button" className="btn btn-ghost" onClick={closeDialog}>Cancel</button>
            <PendingSubmitButton className="btn btn-primary" pendingLabel="Saving…">
              Save settings
            </PendingSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
