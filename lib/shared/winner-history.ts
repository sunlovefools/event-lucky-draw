// Single source of truth for the winner-history entry and its row mapping.
// Previously copied verbatim in lib/admin.ts and lib/public-draw.ts.

export type AdminWinnerHistoryEntry = {
  id: string;
  delegateId: string;
  fullName: string;
  registrationNumber: string;
  drawLabel: string;
  wonAt: string;
};

type WinnerHistoryRow = {
  id: string;
  delegate_id: string;
  draw_label: string;
  won_at: string;
  delegates?: { full_name: string; registration_number: string } | Array<{ full_name: string; registration_number: string }> | null;
};

export function winnerHistoryFromRow(row: WinnerHistoryRow): AdminWinnerHistoryEntry {
  const delegate = Array.isArray(row.delegates) ? row.delegates[0] : row.delegates;
  return {
    id: row.id,
    delegateId: row.delegate_id,
    fullName: delegate?.full_name ?? "Unknown delegate",
    registrationNumber: delegate?.registration_number ?? "",
    drawLabel: row.draw_label,
    wonAt: row.won_at,
  };
}
