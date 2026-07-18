import { createSupabaseBrowserClient } from "@/lib/supabase";
import { winnerHistoryFromRow, type AdminWinnerHistoryEntry } from "@/lib/shared/winner-history";

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

type WinnerHistoryRow = {
  id: string;
  delegate_id: string;
  draw_label: string;
  won_at: string;
  delegates?: { full_name: string; registration_number: string } | Array<{ full_name: string; registration_number: string }> | null;
};

export class SupabasePublicDrawStore implements PublicDrawStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  async findLatestWinner(): Promise<AdminWinnerHistoryEntry | null> {
    const { data, error } = await this.supabase
      .from("winner_history")
      .select("id, delegate_id, draw_label, won_at, delegates(full_name, registration_number)")
      .order("won_at", { ascending: false })
      .limit(1)
      .maybeSingle<WinnerHistoryRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? winnerHistoryFromRow(data) : null;
  }
}
