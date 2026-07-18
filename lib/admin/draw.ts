import { createSupabaseBrowserClient } from "@/lib/supabase";
import { winnerHistoryFromRow, type AdminWinnerHistoryEntry } from "@/lib/shared/winner-history";
import { requireAdminSession, type AdminSessionStore, SupabaseAdminAuthStore } from "@/lib/auth/admin-auth";
import { type DelegateDrawStatus, type AdminParticipant } from "@/lib/admin/participants";

export type LuckyDrawCandidate = {
  id: string;
  fullName: string;
  registrationNumber: string;
  drawStatus: DelegateDrawStatus;
};

export type DrawStore = AdminSessionStore & {
  listWinnerHistory(): Promise<AdminWinnerHistoryEntry[]>;
  listLuckyDrawCandidates(): Promise<LuckyDrawCandidate[]>;
  recordLuckyDrawWinner(delegateId: string, drawLabel: string, wonAt: string): Promise<AdminWinnerHistoryEntry>;
};

export function getLuckyDrawPool(participants: AdminParticipant[]) {
  return participants.filter((participant) => ["eligible", "manual_include"].includes(participant.drawStatus));
}

export async function drawLuckyWinner({
  store,
  sessionId,
  drawLabel,
  now = () => new Date(),
  random = Math.random,
}: {
  store: DrawStore;
  sessionId?: string | null;
  drawLabel: string;
  now?: () => Date;
  random?: () => number;
}): Promise<{ ok: true; winner: AdminWinnerHistoryEntry } | { ok: false; error: string }> {
  const drawnAt = now().toISOString();
  const session = await requireAdminSession({ store, sessionId, nowIso: drawnAt });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const normalizedDrawLabel = drawLabel.trim().replace(/\s+/g, " ");
  if (!normalizedDrawLabel) {
    return { ok: false, error: "Draw label is required." };
  }

  const candidates = (await store.listLuckyDrawCandidates()).filter((candidate) =>
    ["eligible", "manual_include"].includes(candidate.drawStatus),
  );
  if (candidates.length === 0) {
    return { ok: false, error: "No eligible delegates are available for this draw." };
  }

  const winnerIndex = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  const winner = candidates[winnerIndex];
  return { ok: true, winner: await store.recordLuckyDrawWinner(winner.id, normalizedDrawLabel, drawnAt) };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type DelegateParticipantRow = {
  id: string;
  full_name: string;
  registration_number: string;
  draw_status: string;
};

type WinnerHistoryRow = {
  id: string;
  delegate_id: string;
  draw_label: string;
  won_at: string;
  delegates?: { full_name: string; registration_number: string } | Array<{ full_name: string; registration_number: string }> | null;
};

function luckyDrawCandidateFromRow(row: DelegateParticipantRow): LuckyDrawCandidate {
  return {
    id: row.id,
    fullName: row.full_name,
    registrationNumber: row.registration_number,
    drawStatus: row.draw_status,
  };
}

export class SupabaseDrawStore implements DrawStore {
  private readonly auth = new SupabaseAdminAuthStore();

  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  findValidSession(sessionId: string, nowIso: string) {
    return this.auth.findValidSession(sessionId, nowIso);
  }

  async listWinnerHistory(): Promise<AdminWinnerHistoryEntry[]> {
    const { data, error } = await this.supabase
      .from("winner_history")
      .select("id, delegate_id, draw_label, won_at, delegates(full_name, registration_number)")
      .order("won_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(winnerHistoryFromRow);
  }

  async listLuckyDrawCandidates(): Promise<LuckyDrawCandidate[]> {
    const { data: delegates, error: delegateError } = await this.supabase
      .from("delegates")
      .select("id, full_name, registration_number, draw_status")
      .in("draw_status", ["eligible", "manual_include"])
      .order("full_name");

    if (delegateError) {
      throw new Error(delegateError.message);
    }

    const { data: winners, error: winnerError } = await this.supabase.from("winner_history").select("delegate_id");

    if (winnerError) {
      throw new Error(winnerError.message);
    }

    const previousWinnerIds = new Set((winners ?? []).map((winner: { delegate_id: string }) => winner.delegate_id));
    return (delegates ?? [])
      .filter((delegate: DelegateParticipantRow) => !previousWinnerIds.has(delegate.id))
      .map(luckyDrawCandidateFromRow);
  }

  async recordLuckyDrawWinner(delegateId: string, drawLabel: string, wonAt: string): Promise<AdminWinnerHistoryEntry> {
    const { data, error } = await this.supabase
      .from("winner_history")
      .insert({ delegate_id: delegateId, draw_label: drawLabel, won_at: wonAt })
      .select("id, delegate_id, draw_label, won_at, delegates(full_name, registration_number)")
      .single<WinnerHistoryRow>();

    if (error) {
      throw new Error(error.message);
    }

    const { error: updateError } = await this.supabase.from("delegates").update({ draw_status: "winner" }).eq("id", delegateId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return winnerHistoryFromRow(data);
  }
}
