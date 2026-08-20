"use client";

import { useRef } from "react";

import { createStationAction } from "@/app/admin/actions";
import { IconPlus, IconStore, IconX } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";

export function CreateStationModal({ redirectTo }: { redirectTo: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeDialog = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" className="btn btn-primary station-add-button" onClick={() => dialogRef.current?.showModal()}>
        <IconPlus size={17} />
        Add Station
      </button>

      <dialog ref={dialogRef} className="station-create-dialog" aria-labelledby="create-station-title">
        <div className="station-create-dialog__header">
          <span className="station-create-dialog__icon" aria-hidden="true"><IconStore size={22} /></span>
          <div>
            <p className="eyebrow">New exhibition station</p>
            <h2 id="create-station-title">Add Station</h2>
          </div>
          <button type="button" className="icon-btn" onClick={closeDialog} aria-label="Close dialog"><IconX size={18} /></button>
        </div>

        <p className="station-create-dialog__intro">Create a booth or activity point for participants to visit.</p>

        <form action={createStationAction} className="station-create-dialog__form">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="field">
            <label className="field-label" htmlFor="station-name">Exhibition Station Name</label>
            <input id="station-name" name="name" className="input" placeholder="e.g. Main stage, Booth A or Registration" autoComplete="off" required autoFocus />
            <p className="hint">Use a name that participants and station staff can recognise immediately.</p>
          </div>

          <p className="hint">The new station will be placed after the existing stations. You can change its vendor position after creating it.</p>

          <label className="station-toggle">
            <input type="checkbox" name="active" value="true" defaultChecked />
            <span className="station-toggle__track" aria-hidden="true"><span /></span>
            <span>
              <strong>Active Immediately</strong>
              <small>Participants can collect a stamp at this station.</small>
            </span>
          </label>

          <div className="station-create-dialog__actions">
            <button type="button" className="btn btn-ghost" onClick={closeDialog}>Cancel</button>
            <PendingSubmitButton className="btn btn-primary" pendingLabel="Creating…">
              <IconPlus size={17} />
              Create Station
            </PendingSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
