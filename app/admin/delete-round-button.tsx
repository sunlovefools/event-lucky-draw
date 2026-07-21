"use client";

import React from "react";

import { deleteDrawRoundAction } from "@/app/admin/actions";

export function DeleteRoundButton({ roundId, roundNumber }: { roundId: string; roundNumber: number }) {
  return (
    <form action={deleteDrawRoundAction}>
      <input type="hidden" name="roundId" value={roundId} />
      <button
        type="submit"
        className="btn btn-ghost btn-sm"
        onClick={(event) => {
          if (!window.confirm(`Delete Round ${roundNumber}? This removes its winners from the history and exports.`)) {
            event.preventDefault();
          }
        }}
      >
        Delete round
      </button>
    </form>
  );
}
