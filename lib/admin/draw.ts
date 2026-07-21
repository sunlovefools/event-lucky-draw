import { createSupabaseBrowserClient } from "@/lib/supabase";
import { winnerHistoryFromRow, type AdminWinnerHistoryEntry, type WinnerHistoryRow } from "@/lib/shared/winner-history";
import { requireAdminSession, type AdminSessionStore, SupabaseAdminAuthStore } from "@/lib/auth/admin-auth";
import { type DelegateDrawStatus, type AdminParticipant } from "@/lib/admin/participants";

export type DrawRound = {
  id: string;
  roundNumber: number;
  openedAt: string;
  closedAt: string | null;
};

export type DrawRoundView = DrawRound & {
  isCurrent: boolean;
  winners: AdminWinnerHistoryEntry[];
};

export type LuckyDrawCandidate = {
  id: string;
  fullName: string;
  registrationNumber: string;
  drawStatus: DelegateDrawStatus;
  stampsCollected: number;
  totalActiveStations: number;
  surveySubmitted: boolean;
};

export type DrawStore = AdminSessionStore & {
  getCurrentDrawRound(): Promise<DrawRound | null>;
  listLuckyDrawCandidates(roundId: string): Promise<LuckyDrawCandidate[]>;
  tryRecordLuckyDrawWinner(
    delegateId: string,
    roundId: string,
    wonAt: string,
  ): Promise<{ ok: true; winner: AdminWinnerHistoryEntry } | { ok: false; error: "duplicate" | "error" }>;
  listDrawRounds(): Promise<DrawRoundView[]>;
  closeCurrentRoundAndOpenNext(nowIso: string): Promise<DrawRound>;
  deleteDrawRound(roundId: string): Promise<void>;
};

const MAX_DRAW_ATTEMPTS = 10;

// Base eligibility: all active station stamps collected AND the final survey
// submitted. An admin may override with `eligible` (force include) or
// `excluded` (force exclude). The "already drawn this round" rule is applied
// separately, by the candidate query.
export function isBaseEligible(input: {
  drawStatus?: string | null;
  stampsCollected: number;
  totalActiveStations: number;
  surveySubmitted: boolean;
}): boolean {
  const status = input.drawStatus ?? "auto";
  if (status === "eligible") return true;
  if (status === "excluded") return false;

  const hasAllStamps = input.totalActiveStations > 0 && input.stampsCollected >= input.totalActiveStations;
  return hasAllStamps && input.surveySubmitted;
}

export function getLuckyDrawPool(participants: AdminParticipant[]): AdminParticipant[] {
  return participants.filter((participant) =>
    isBaseEligible({
      drawStatus: participant.drawStatus,
      stampsCollected: participant.stampsCollected,
      totalActiveStations: participant.totalActiveStations,
      surveySubmitted: participant.surveySubmitted,
    }),
  );
}

export async function drawLuckyWinner({
  store,
  sessionId,
  now = () => new Date(),
  random = Math.random,
}: {
  store: DrawStore;
  sessionId?: string | null;
  now?: () => Date;
  random?: () => number;
}): Promise<{ ok: true; winner: AdminWinnerHistoryEntry } | { ok: false; error: string }> {
  const drawnAt = now().toISOString();
  const session = await requireAdminSession({ store, sessionId, nowIso: drawnAt });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const round = await store.getCurrentDrawRound();
  if (!round) {
    return { ok: false, error: "No active draw round. Reset to start a new round." };
  }

  const candidates = await store.listLuckyDrawCandidates(round.id);
  if (candidates.length === 0) {
    return { ok: false, error: "No eligible delegates remaining — reset to start a new round." };
  }

  const pickFrom = (pool: LuckyDrawCandidate[]) =>
    pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];

  let chosen = pickFrom(candidates);
  for (let attempt = 0; attempt < MAX_DRAW_ATTEMPTS; attempt++) {
    const recorded = await store.tryRecordLuckyDrawWinner(chosen.id, round.id, drawnAt);
    if (recorded.ok) {
      return { ok: true, winner: recorded.winner };
    }

    // A concurrent draw claimed this delegate first; reselect from the
    // remaining, still-eligible pool and try again.
    if (recorded.error === "duplicate") {
      const remaining = (await store.listLuckyDrawCandidates(round.id)).filter((c) => c.id !== chosen.id);
      if (remaining.length === 0) {
        return { ok: false, error: "No eligible delegates remaining — reset to start a new round." };
      }
      chosen = pickFrom(remaining);
      continue;
    }

    return { ok: false, error: "Could not record the winner." };
  }

  return { ok: false, error: "Could not complete the draw." };
}

export async function resetDrawRound({
  store,
  sessionId,
  now = () => new Date(),
}: {
  store: DrawStore;
  sessionId?: string | null;
  now?: () => Date;
}): Promise<{ ok: true; round: DrawRound } | { ok: false; error: string }> {
  const nowIso = now().toISOString();
  const session = await requireAdminSession({ store, sessionId, nowIso });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const round = await store.closeCurrentRoundAndOpenNext(nowIso);
  return { ok: true, round };
}

export async function deleteDrawRound({
  store,
  sessionId,
  roundId,
  now = () => new Date(),
}: {
  store: DrawStore;
  sessionId?: string | null;
  roundId: string;
  now?: () => Date;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const nowIso = now().toISOString();
  const session = await requireAdminSession({ store, sessionId, nowIso });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  if (!roundId) {
    return { ok: false, error: "Round is required." };
  }

  await store.deleteDrawRound(roundId);
  return { ok: true };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type DrawRoundRow = {
  id: string;
  round_number: number;
  opened_at: string;
  closed_at: string | null;
};

type CandidateRpcRow = {
  id: string;
  full_name: string;
  registration_number: string;
  draw_status: string;
  stamps_collected: number;
  total_active_stations: number;
  survey_submitted: boolean;
};

function roundFromRow(row: DrawRoundRow): DrawRound {
  return {
    id: row.id,
    roundNumber: row.round_number,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

function candidateFromRpcRow(row: CandidateRpcRow): LuckyDrawCandidate {
  return {
    id: row.id,
    fullName: row.full_name,
    registrationNumber: row.registration_number,
    drawStatus: row.draw_status,
    stampsCollected: Number(row.stamps_collected),
    totalActiveStations: Number(row.total_active_stations),
    surveySubmitted: Boolean(row.survey_submitted),
  };
}

export class SupabaseDrawStore implements DrawStore {
  private readonly auth = new SupabaseAdminAuthStore();

  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  findValidSession(sessionId: string, nowIso: string) {
    return this.auth.findValidSession(sessionId, nowIso);
  }

  async getCurrentDrawRound(): Promise<DrawRound | null> {
    const { data, error } = await this.supabase
      .from("draw_rounds")
      .select("id, round_number, opened_at, closed_at")
      .is("closed_at", null)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle<DrawRoundRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? roundFromRow(data) : null;
  }

  async listLuckyDrawCandidates(roundId: string): Promise<LuckyDrawCandidate[]> {
    const { data: delegates, error: delegateError } = await this.supabase.rpc("admin_participant_progress");
    if (delegateError) {
      throw new Error(delegateError.message);
    }

    const { data: winners, error: winnerError } = await this.supabase
      .from("winner_history")
      .select("delegate_id")
      .eq("round_id", roundId);

    if (winnerError) {
      throw new Error(winnerError.message);
    }

    const drawnIds = new Set((winners ?? []).map((winner: { delegate_id: string }) => winner.delegate_id));
    return (delegates ?? [])
      .filter((delegate: CandidateRpcRow) => isBaseEligible({
                drawStatus: delegate.draw_status,
                stampsCollected: Number(delegate.stamps_collected),
                totalActiveStations: Number(delegate.total_active_stations),
                surveySubmitted: Boolean(delegate.survey_submitted),
              }) && !drawnIds.has(delegate.id))
      .map(candidateFromRpcRow);
  }

  async tryRecordLuckyDrawWinner(
    delegateId: string,
    roundId: string,
    wonAt: string,
  ): Promise<{ ok: true; winner: AdminWinnerHistoryEntry } | { ok: false; error: "duplicate" | "error" }> {
    const { data, error } = await this.supabase
      .from("winner_history")
      .insert({ delegate_id: delegateId, round_id: roundId, won_at: wonAt })
      .select("id, delegate_id, round_id, won_at, delegates(full_name, registration_number), draw_rounds(round_number)")
      .single<WinnerHistoryRow>();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "duplicate" };
      }
      return { ok: false, error: "error" };
    }

    return { ok: true, winner: winnerHistoryFromRow(data) };
  }

  async listDrawRounds(): Promise<DrawRoundView[]> {
    const { data: rounds, error: roundsError } = await this.supabase
      .from("draw_rounds")
      .select("id, round_number, opened_at, closed_at")
      .order("round_number", { ascending: false });

    if (roundsError) {
      throw new Error(roundsError.message);
    }

    const { data: winners, error: winnersError } = await this.supabase
      .from("winner_history")
      .select("id, delegate_id, round_id, won_at, delegates(full_name, registration_number), draw_rounds(round_number)")
      .order("won_at", { ascending: true });

    if (winnersError) {
      throw new Error(winnersError.message);
    }

    const byRound = new Map<string, AdminWinnerHistoryEntry[]>();
    for (const row of winners ?? []) {
      const entry = winnerHistoryFromRow(row);
      const list = byRound.get(entry.roundId) ?? [];
      list.push(entry);
      byRound.set(entry.roundId, list);
    }

    return (rounds ?? []).map((row) => ({
      ...roundFromRow(row),
      isCurrent: row.closed_at === null,
      winners: byRound.get(row.id) ?? [],
    }));
  }

  async closeCurrentRoundAndOpenNext(nowIso: string): Promise<DrawRound> {
    await this.supabase.from("draw_rounds").update({ closed_at: nowIso }).is("closed_at", null);

    const { data: maxRow, error: maxError } = await this.supabase
      .from("draw_rounds")
      .select("round_number")
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle<{ round_number: number }>();

    if (maxError) {
      throw new Error(maxError.message);
    }

    const nextNumber = (maxRow?.round_number ?? 0) + 1;

    const { data, error } = await this.supabase
      .from("draw_rounds")
      .insert({ round_number: nextNumber, opened_at: nowIso })
      .select("id, round_number, opened_at, closed_at")
      .single<DrawRoundRow>();

    if (error) {
      throw new Error(error.message);
    }

    return roundFromRow(data);
  }

  async deleteDrawRound(roundId: string): Promise<void> {
    // Remove the round's winners, then the round itself. The current
    // (open) round is protected by the `closed_at is not null` guard.
    await this.supabase.from("winner_history").delete().eq("round_id", roundId);
    await this.supabase.from("draw_rounds").delete().eq("id", roundId).not("closed_at", "is", null);
  }
}
