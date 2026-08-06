"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { resetDrawRoundAction } from "@/app/admin/actions";
import { IconAlert, IconRefresh, IconX } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";

export function ResetWinnersControls() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  function refreshWinners() {
    startRefresh(() => router.refresh());
  }

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={refreshWinners}
        disabled={isRefreshing}
        aria-busy={isRefreshing}
      >
        {isRefreshing ? <span className="btn-spinner" aria-hidden="true" /> : <IconRefresh size={16} />}
        {isRefreshing ? "Refreshing…" : "Refresh"}
      </button>
      <button type="button" className="btn btn-danger-outline btn-sm" onClick={openDialog}>
        <IconRefresh size={16} />
        Reset winners
      </button>

      <dialog ref={dialogRef} className="danger-dialog" aria-labelledby="reset-winners-title">
        <div className="danger-dialog__header">
          <span className="danger-dialog__icon" aria-hidden="true"><IconAlert size={22} /></span>
          <div>
            <p className="eyebrow">Lucky draw</p>
            <h2 id="reset-winners-title">Reset winner history?</h2>
          </div>
          <button type="button" className="icon-btn" onClick={closeDialog} aria-label="Close dialog">
            <IconX size={18} />
          </button>
        </div>

        <p>
          This removes all recorded winners and returns them to the eligible draw pool. This action cannot be undone.
        </p>

        <form action={resetDrawRoundAction} className="danger-dialog__form">
          <input type="hidden" name="redirectTo" value="/admin" />
          <div className="danger-dialog__actions">
            <button type="button" className="btn btn-ghost" onClick={closeDialog}>Cancel</button>
            <PendingSubmitButton className="btn btn-danger" pendingLabel="Resetting winners…">
              Reset winners
            </PendingSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
