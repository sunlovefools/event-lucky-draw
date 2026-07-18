import { createSupabaseBrowserClient } from "@/lib/supabase";
import { normalizeUsername } from "@/lib/shared/normalize";
import { requireAdminSession, type AdminSessionStore, SupabaseAdminAuthStore } from "@/lib/auth/admin-auth";

export type DelegateDrawStatus = "not_eligible" | "eligible" | "manual_include" | "disqualified" | "winner" | string;

export type AdminParticipant = {
  id: string;
  fullName: string;
  registrationNumber: string;
  stampsCollected: number;
  totalActiveStations: number;
  surveySubmitted: boolean;
  drawStatus: DelegateDrawStatus;
};

export type ParticipantsStore = AdminSessionStore & {
  listParticipants(): Promise<AdminParticipant[]>;
  updateDelegateName(delegateId: string, fullName: string): Promise<AdminParticipant>;
  updateDelegateDrawStatus(delegateId: string, drawStatus: DelegateDrawStatus): Promise<AdminParticipant>;
};

export async function updateDelegateName({
  store,
  sessionId,
  delegateId,
  fullName,
  now = () => new Date(),
}: {
  store: ParticipantsStore;
  sessionId?: string | null;
  delegateId: string;
  fullName: string;
  now?: () => Date;
}): Promise<{ ok: true; participant: AdminParticipant } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const normalizedDelegateId = delegateId.trim();
  const normalizedFullName = fullName.trim().replace(/\s+/g, " ");
  if (!normalizedDelegateId || !normalizedFullName) {
    return { ok: false, error: "Delegate name is required." };
  }

  return { ok: true, participant: await store.updateDelegateName(normalizedDelegateId, normalizedFullName) };
}

export async function setDelegateDrawStatus({
  store,
  sessionId,
  delegateId,
  drawStatus,
  now = () => new Date(),
}: {
  store: ParticipantsStore;
  sessionId?: string | null;
  delegateId: string;
  drawStatus: DelegateDrawStatus;
  now?: () => Date;
}): Promise<{ ok: true; participant: AdminParticipant } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const normalizedDelegateId = delegateId.trim();
  if (!normalizedDelegateId) {
    return { ok: false, error: "Delegate is required." };
  }

  return { ok: true, participant: await store.updateDelegateDrawStatus(normalizedDelegateId, drawStatus) };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type ParticipantRpcRow = {
  id: string;
  full_name: string;
  registration_number: string;
  stamps_collected: number;
  total_active_stations: number;
  survey_submitted: boolean;
  draw_status: string;
};

type DelegateParticipantRow = {
  id: string;
  full_name: string;
  registration_number: string;
  draw_status: string;
};

function participantFromRpcRow(row: ParticipantRpcRow): AdminParticipant {
  return {
    id: row.id,
    fullName: row.full_name,
    registrationNumber: row.registration_number,
    stampsCollected: row.stamps_collected,
    totalActiveStations: row.total_active_stations,
    surveySubmitted: row.survey_submitted,
    drawStatus: row.draw_status,
  };
}

function participantFromDelegateRow(row: DelegateParticipantRow): AdminParticipant {
  return {
    id: row.id,
    fullName: row.full_name,
    registrationNumber: row.registration_number,
    stampsCollected: 0,
    totalActiveStations: 0,
    surveySubmitted: false,
    drawStatus: row.draw_status,
  };
}

export class SupabaseParticipantsStore implements ParticipantsStore {
  private readonly auth = new SupabaseAdminAuthStore();

  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  findValidSession(sessionId: string, nowIso: string) {
    return this.auth.findValidSession(sessionId, nowIso);
  }

  async listParticipants(): Promise<AdminParticipant[]> {
    const { data, error } = await this.supabase.rpc("admin_participant_progress");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(participantFromRpcRow);
  }

  async updateDelegateName(delegateId: string, fullName: string): Promise<AdminParticipant> {
    const { data, error } = await this.supabase
      .from("delegates")
      .update({ full_name: fullName })
      .eq("id", delegateId)
      .select("id, full_name, registration_number, draw_status")
      .single<DelegateParticipantRow>();

    if (error) {
      throw new Error(error.message);
    }

    return participantFromDelegateRow(data);
  }

  async updateDelegateDrawStatus(delegateId: string, drawStatus: DelegateDrawStatus): Promise<AdminParticipant> {
    const { data, error } = await this.supabase
      .from("delegates")
      .update({ draw_status: drawStatus })
      .eq("id", delegateId)
      .select("id, full_name, registration_number, draw_status")
      .single<DelegateParticipantRow>();

    if (error) {
      throw new Error(error.message);
    }

    return participantFromDelegateRow(data);
  }
}
