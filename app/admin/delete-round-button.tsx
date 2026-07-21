"use client";

import React from "react";

import { deleteDrawRoundAction } from "@/app/admin/actions";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";

export function DeleteRoundButton({ roundId, roundNumber }: { roundId: string; roundNumber: number }) {
  return (
    <form action={deleteDrawRoundAction}>
      <input type="hidden" name="roundId" value={roundId} />
      <PendingSubmitButton
        className="btn btn-ghost btn-sm"
        pendingLabel="Deleting…"
        onClick={(event) => {
          if (!window.confirm(`Delete Round ${roundNumber}? This removes its winners from the history and exports.`)) {
            event.preventDefault();
          }
        }}
      >
        Delete round
      </PendingSubmitButton>
    </form>
  );
}
