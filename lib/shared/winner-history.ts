// Single source of truth for the winner-history entry and its row mapping.
// Winners are cumulative and tagged by draw round; there is no prize label.

export type AdminWinnerHistoryEntry = {
  id: string;
  delegateId: string;
  title?: string;
  fullName: string;
  registrationNumber: string;
  roundId: string;
  roundNumber: number;
  wonAt: string;
};

export type WinnerHistoryRow = {
  id: string;
  delegate_id: string;
  round_id: string;
  won_at: string;
  delegates?: { title?: string | null; full_name: string; registration_number: string } | Array<{ title?: string | null; full_name: string; registration_number: string }> | null;
  draw_rounds?: { round_number: number } | Array<{ round_number: number }> | null;
};

export function winnerHistoryFromRow(row: WinnerHistoryRow): AdminWinnerHistoryEntry {
  const delegate = Array.isArray(row.delegates) ? row.delegates[0] : row.delegates;
  const round = Array.isArray(row.draw_rounds) ? row.draw_rounds[0] : row.draw_rounds;
  return {
    id: row.id,
    delegateId: row.delegate_id,
    title: delegate?.title ?? "",
    fullName: delegate?.full_name ?? "Unknown delegate",
    registrationNumber: delegate?.registration_number ?? "",
    roundId: row.round_id,
    roundNumber: round?.round_number ?? 0,
    wonAt: row.won_at,
  };
}
