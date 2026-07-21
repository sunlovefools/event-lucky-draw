import { createSupabaseBrowserClient } from "@/lib/supabase";
import { winnerHistoryFromRow, type AdminWinnerHistoryEntry, type WinnerHistoryRow } from "@/lib/shared/winner-history";

export type PublicDrawState =
  | { status: "waiting"; winner: null }
  | { status: "winner"; winner: AdminWinnerHistoryEntry };

export type PublicDrawStore = {
  findLatestWinner(): Promise<AdminWinnerHistoryEntry | null>;
};

export async function getPublicDrawState({ store }: { store: PublicDrawStore }): Promise<PublicDrawState> {
  const winner = await store.findLatestWinner();
  return winner ? { status: "winner", winner } : { status: "waiting", winner: null };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

export class SupabasePublicDrawStore implements PublicDrawStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  async findLatestWinner(): Promise<AdminWinnerHistoryEntry | null> {
    const { data: round, error: roundError } = await this.supabase
      .from("draw_rounds")
      .select("id")
      .is("closed_at", null)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (roundError) {
      throw new Error(roundError.message);
    }

    if (!round) {
      return null;
    }

    const { data, error } = await this.supabase
      .from("winner_history")
      .select("id, delegate_id, round_id, won_at, delegates(full_name, registration_number), draw_rounds(round_number)")
      .eq("round_id", round.id)
      .order("won_at", { ascending: false })
      .limit(1)
      .maybeSingle<WinnerHistoryRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? winnerHistoryFromRow(data) : null;
  }
}
