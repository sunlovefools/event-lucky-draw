"use client";

import React, { useRef, useState } from "react";

import { deleteAllDelegatesAction } from "@/app/admin/actions";
import { DELETE_ALL_DELEGATES_CONFIRMATION } from "@/lib/shared/delegate-deletion";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";
import { IconAlert, IconX } from "@/app/admin/icons";

export function DeleteAllDelegatesButton({ delegateCount, redirectTo = "/admin/participants" }: { delegateCount: number; redirectTo?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const canDelete = confirmationPhrase === DELETE_ALL_DELEGATES_CONFIRMATION;

  function closeDialog() {
    dialogRef.current?.close();
    setConfirmationPhrase("");
  }

  return (
    <>
      <button type="button" className="btn btn-danger participant-action-button participant-action-button--danger" onClick={() => dialogRef.current?.showModal()}>
        Delete All Delegates
      </button>

      <dialog ref={dialogRef} className="danger-dialog" aria-labelledby="delete-all-delegates-title">
        <div className="danger-dialog__header">
          <span className="danger-dialog__icon" aria-hidden="true"><IconAlert size={22} /></span>
          <div>
            <p className="eyebrow">Irreversible action</p>
            <h2 id="delete-all-delegates-title">Delete all delegates?</h2>
          </div>
          <button type="button" className="icon-btn" onClick={closeDialog} aria-label="Close dialog">
            <IconX size={18} />
          </button>
        </div>

        <p>
          This permanently deletes all {delegateCount} delegate record{delegateCount === 1 ? "" : "s"}, including their sessions, stamps, survey responses, and winner history. Scan audit entries will be retained without delegate details.
        </p>
        <p>
          Type <strong>{DELETE_ALL_DELEGATES_CONFIRMATION}</strong> to enable deletion.
        </p>

        <form action={deleteAllDelegatesAction} className="danger-dialog__form">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="field">
            <label className="field-label" htmlFor="delete-all-delegates-confirmation">Confirmation phrase</label>
            <input
              id="delete-all-delegates-confirmation"
              name="confirmationPhrase"
              className="input"
              value={confirmationPhrase}
              onChange={(event) => setConfirmationPhrase(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </div>
          <div className="danger-dialog__actions">
            <button type="button" className="btn btn-ghost" onClick={closeDialog}>Cancel</button>
            <PendingSubmitButton className="btn btn-danger" disabled={!canDelete} pendingLabel="Deleting delegates…">
              Delete All Delegates
            </PendingSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
