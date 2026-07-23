import { createSupabaseBrowserClient } from "@/lib/supabase";
import { normalizeFullName, normalizeRegistrationNumber, normalizeTitle } from "@/lib/shared/normalize";
import { requireAdminSession, type AdminSessionStore, SupabaseAdminAuthStore } from "@/lib/auth/admin-auth";
import * as XLSX from "xlsx";

const MAX_PARTICIPANT_IMPORT_BYTES = 5 * 1024 * 1024;

export type DelegateDrawStatus = "auto" | "eligible" | "excluded" | string;

export type AdminParticipant = {
  id: string;
  title?: string;
  fullName: string;
  registrationNumber: string;
  stampsCollected: number;
  totalActiveStations: number;
  surveySubmitted: boolean;
  drawStatus: DelegateDrawStatus;
};

export type ParticipantAccountInput = {
  registrationNumber: string;
  title: string;
  fullName: string;
};

export type ParticipantImportResult = {
  created: number;
  updated: number;
  skipped: number;
};

export type ParticipantsStore = AdminSessionStore & {
  listParticipants(): Promise<AdminParticipant[]>;
  createOrUpdateParticipant(participant: ParticipantAccountInput): Promise<AdminParticipant>;
  upsertParticipants(participants: ParticipantAccountInput[]): Promise<Omit<ParticipantImportResult, "skipped">>;
  updateDelegateName(delegateId: string, fullName: string): Promise<AdminParticipant>;
  updateDelegateDrawStatus(delegateId: string, drawStatus: DelegateDrawStatus): Promise<AdminParticipant>;
};

function normalizeParticipantInput(input: {
  registrationNumber: string;
  title?: string | null;
  fullName: string;
}): ParticipantAccountInput | null {
  const registrationNumber = normalizeRegistrationNumber(input.registrationNumber);
  const fullName = normalizeFullName(input.fullName);
  if (!registrationNumber || !fullName) {
    return null;
  }

  return {
    registrationNumber,
    fullName,
    title: normalizeTitle(input.title ?? ""),
  };
}

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/\s+/g, "");
}

function stringCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function parseParticipantsWorkbook(buffer: ArrayBuffer | Buffer): {
  participants: ParticipantAccountInput[];
  skipped: number;
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { participants: [], skipped: 0 };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
  });
  const participants = new Map<string, ParticipantAccountInput>();
  let skipped = 0;

  for (const row of rows) {
    const byHeader = new Map<string, unknown>();
    for (const [key, value] of Object.entries(row)) {
      byHeader.set(normalizeHeader(key), value);
    }

    const participant = normalizeParticipantInput({
      registrationNumber: stringCell(byHeader.get("delegateid")),
      title: stringCell(byHeader.get("title")),
      fullName: stringCell(byHeader.get("name")),
    });

    if (!participant) {
      skipped += 1;
      continue;
    }

    if (participants.has(participant.registrationNumber)) {
      skipped += 1;
    }
    participants.set(participant.registrationNumber, participant);
  }

  return { participants: [...participants.values()], skipped };
}

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

export async function createParticipantAccount({
  store,
  sessionId,
  registrationNumber,
  title,
  fullName,
  now = () => new Date(),
}: {
  store: ParticipantsStore;
  sessionId?: string | null;
  registrationNumber: string;
  title?: string | null;
  fullName: string;
  now?: () => Date;
}): Promise<{ ok: true; participant: AdminParticipant } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const participant = normalizeParticipantInput({ registrationNumber, title, fullName });
  if (!participant) {
    return { ok: false, error: "Participant ID and name are required." };
  }

  return { ok: true, participant: await store.createOrUpdateParticipant(participant) };
}

export async function importParticipantAccounts({
  store,
  sessionId,
  file,
  now = () => new Date(),
}: {
  store: ParticipantsStore;
  sessionId?: string | null;
  file: File | null;
  now?: () => Date;
}): Promise<{ ok: true; result: ParticipantImportResult } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  if (!file || file.size === 0) {
    return { ok: false, error: "Spreadsheet file is required." };
  }

  if (file.size > MAX_PARTICIPANT_IMPORT_BYTES) {
    return { ok: false, error: "Spreadsheet file is too large." };
  }

  const parsed = parseParticipantsWorkbook(await file.arrayBuffer());
  if (parsed.participants.length === 0) {
    return { ok: false, error: "Spreadsheet did not contain any valid participants." };
  }

  const result = await store.upsertParticipants(parsed.participants);
  return {
    ok: true,
    result: {
      ...result,
      skipped: parsed.skipped,
    },
  };
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
  title?: string | null;
  full_name: string;
  registration_number: string;
  stamps_collected: number;
  total_active_stations: number;
  survey_submitted: boolean;
  draw_status: string;
};

type DelegateParticipantRow = {
  id: string;
  title?: string | null;
  full_name: string;
  registration_number: string;
  draw_status: string;
};

function participantFromRpcRow(row: ParticipantRpcRow): AdminParticipant {
  return {
    id: row.id,
    title: row.title ?? "",
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
    title: row.title ?? "",
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

  async createOrUpdateParticipant(participant: ParticipantAccountInput): Promise<AdminParticipant> {
    const { data, error } = await this.supabase
      .from("delegates")
      .upsert(
        {
          registration_number: participant.registrationNumber,
          title: participant.title,
          full_name: participant.fullName,
        },
        { onConflict: "registration_number" },
      )
      .select("id, title, full_name, registration_number, draw_status")
      .single<DelegateParticipantRow>();

    if (error) {
      throw new Error(error.message);
    }

    return participantFromDelegateRow(data);
  }

  async upsertParticipants(participants: ParticipantAccountInput[]): Promise<Omit<ParticipantImportResult, "skipped">> {
    if (participants.length === 0) {
      return { created: 0, updated: 0 };
    }

    const registrationNumbers = participants.map((participant) => participant.registrationNumber);
    const { data: existingRows, error: existingError } = await this.supabase
      .from("delegates")
      .select("registration_number")
      .in("registration_number", registrationNumbers);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existing = new Set((existingRows ?? []).map((row: { registration_number: string }) => row.registration_number));
    const { error } = await this.supabase.from("delegates").upsert(
      participants.map((participant) => ({
        registration_number: participant.registrationNumber,
        title: participant.title,
        full_name: participant.fullName,
      })),
      { onConflict: "registration_number" },
    );

    if (error) {
      throw new Error(error.message);
    }

    const updated = participants.filter((participant) => existing.has(participant.registrationNumber)).length;
    return {
      created: participants.length - updated,
      updated,
    };
  }

  async updateDelegateName(delegateId: string, fullName: string): Promise<AdminParticipant> {
    const { data, error } = await this.supabase
      .from("delegates")
      .update({ full_name: fullName })
      .eq("id", delegateId)
      .select("id, title, full_name, registration_number, draw_status")
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
      .select("id, title, full_name, registration_number, draw_status")
      .single<DelegateParticipantRow>();

    if (error) {
      throw new Error(error.message);
    }

    return participantFromDelegateRow(data);
  }
}
