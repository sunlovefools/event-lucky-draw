import { randomUUID } from "node:crypto";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import { hashPassword, newSalt as generateSalt } from "@/lib/password";

export type AdminAccount = {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
};

export type AdminSession = {
  id: string;
  adminId: string;
  expiresAt: string;
};

export type ValidAdminSession = {
  id: string;
  adminId: string;
  username: string;
};

export type ParticipationState = {
  open: boolean;
  updatedAt: string;
  updatedByUsername: string | null;
};

export type Station = {
  id: string;
  name: string;
  active: boolean;
};

export type VendorAccount = {
  id: string;
  username: string;
  stationId: string;
  stationName: string;
  active: boolean;
};

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

export type AdminStationSummary = {
  stationId: string;
  stationName: string;
  active: boolean;
  completions: number;
};

export type AdminScanAuditLog = {
  id: string;
  delegateId: string | null;
  delegateFullName: string | null;
  stationId: string | null;
  stationName: string | null;
  scannedAt: string;
  qrTokenId: string | null;
  qrToken: string;
  result: string;
  consumed: boolean;
};

export type LuckyDrawCandidate = {
  id: string;
  fullName: string;
  registrationNumber: string;
  drawStatus: DelegateDrawStatus;
};

export type AdminWinnerHistoryEntry = {
  id: string;
  delegateId: string;
  fullName: string;
  registrationNumber: string;
  drawLabel: string;
  wonAt: string;
};

type StationInput = {
  name: string;
  active: boolean;
};

type VendorAccountInput = {
  username: string;
  stationId: string;
  passwordHash: string;
  passwordSalt: string;
  active: boolean;
};

type VendorAccountUpdate = {
  username: string;
  stationId: string;
  active: boolean;
};

export type AdminStore = {
  findActiveAdminByUsername(username: string): Promise<AdminAccount | null>;
  createAdminSession(adminId: string, expiresAt: string): Promise<AdminSession>;
  findValidSession(sessionId: string, nowIso: string): Promise<ValidAdminSession | null>;
  readParticipationState(): Promise<ParticipationState>;
  updateParticipationState(open: boolean, adminId: string, updatedAt: string): Promise<ParticipationState>;
  listStations(): Promise<Station[]>;
  listVendorAccounts(): Promise<VendorAccount[]>;
  listStationSummaries(): Promise<AdminStationSummary[]>;
  listScanAuditLogs(): Promise<AdminScanAuditLog[]>;
  listWinnerHistory(): Promise<AdminWinnerHistoryEntry[]>;
  listLuckyDrawCandidates(): Promise<LuckyDrawCandidate[]>;
  recordLuckyDrawWinner(delegateId: string, drawLabel: string, wonAt: string): Promise<AdminWinnerHistoryEntry>;
  createStation(station: StationInput): Promise<Station>;
  updateStation(stationId: string, station: StationInput): Promise<Station>;
  createVendorAccount(vendor: VendorAccountInput): Promise<VendorAccount>;
  updateVendorAccount(vendorId: string, vendor: VendorAccountUpdate): Promise<VendorAccount>;
  listParticipants(): Promise<AdminParticipant[]>;
  updateDelegateName(delegateId: string, fullName: string): Promise<AdminParticipant>;
  updateDelegateDrawStatus(delegateId: string, drawStatus: DelegateDrawStatus): Promise<AdminParticipant>;
};

export type AdminDashboardResult =
  | { authorized: false }
  | {
      authorized: true;
      admin: { id: string; username: string };
      participation: ParticipationState;
      stations: Station[];
      vendorAccounts: VendorAccount[];
      participants: AdminParticipant[];
      stationSummaries: AdminStationSummary[];
      scanAuditLogs: AdminScanAuditLog[];
      winnerHistory: AdminWinnerHistoryEntry[];
    };

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

async function requireAdminSession({
  store,
  sessionId,
  nowIso,
}: {
  store: AdminStore;
  sessionId?: string | null;
  nowIso: string;
}): Promise<ValidAdminSession | null> {
  if (!sessionId) {
    return null;
  }

  return store.findValidSession(sessionId, nowIso);
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function normalizeStationId(stationId: string) {
  return stationId.trim();
}

function validateStationName(name: string) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return { ok: false as const, error: "Station name is required." };
  }

  return { ok: true as const, name: normalizedName };
}

function validateVendorFields(username: string, stationId: string) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    return { ok: false as const, error: "Vendor username is required." };
  }

  const normalizedStationId = normalizeStationId(stationId);
  if (!normalizedStationId) {
    return { ok: false as const, error: "Vendor account must be assigned to exactly one station." };
  }

  return { ok: true as const, username: normalizedUsername, stationId: normalizedStationId };
}

export async function authenticateAdmin({
  store,
  username,
  password,
  now = () => new Date(),
}: {
  store: AdminStore;
  username: string;
  password: string;
  now?: () => Date;
}): Promise<{ ok: true; session: AdminSession } | { ok: false; error: string }> {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password) {
    return { ok: false, error: "Invalid username or password." };
  }

  const admin = await store.findActiveAdminByUsername(normalizedUsername);
  if (!admin) {
    return { ok: false, error: "Invalid username or password." };
  }

  const candidateHash = hashPassword(password, admin.passwordSalt);
  if (candidateHash !== admin.passwordHash) {
    return { ok: false, error: "Invalid username or password." };
  }

  const expiresAt = new Date(now().getTime() + SESSION_DURATION_MS).toISOString();
  return { ok: true, session: await store.createAdminSession(admin.id, expiresAt) };
}

export async function getAdminDashboard({
  store,
  sessionId,
  now = () => new Date(),
}: {
  store: AdminStore;
  sessionId?: string | null;
  now?: () => Date;
}): Promise<AdminDashboardResult> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { authorized: false };
  }

  const [participation, stations, vendorAccounts, participants, stationSummaries, scanAuditLogs, winnerHistory] = await Promise.all([
    store.readParticipationState(),
    store.listStations(),
    store.listVendorAccounts(),
    store.listParticipants(),
    store.listStationSummaries(),
    store.listScanAuditLogs(),
    store.listWinnerHistory(),
  ]);

  return {
    authorized: true,
    admin: { id: session.adminId, username: session.username },
    participation,
    stations,
    vendorAccounts,
    participants,
    stationSummaries,
    scanAuditLogs,
    winnerHistory,
  };
}

export async function setParticipationState({
  store,
  sessionId,
  open,
  now = () => new Date(),
}: {
  store: AdminStore;
  sessionId?: string | null;
  open: boolean;
  now?: () => Date;
}): Promise<{ ok: true; participation: ParticipationState } | { ok: false; error: string }> {
  const updatedAt = now().toISOString();
  const session = await requireAdminSession({ store, sessionId, nowIso: updatedAt });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  return {
    ok: true,
    participation: await store.updateParticipationState(open, session.adminId, updatedAt),
  };
}

export async function createStation({
  store,
  sessionId,
  name,
  active,
  now = () => new Date(),
}: {
  store: AdminStore;
  sessionId?: string | null;
  name: string;
  active: boolean;
  now?: () => Date;
}): Promise<{ ok: true; station: Station } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const validName = validateStationName(name);
  if (!validName.ok) {
    return { ok: false, error: validName.error };
  }

  return { ok: true, station: await store.createStation({ name: validName.name, active }) };
}

export async function editStation({
  store,
  sessionId,
  stationId,
  name,
  active,
  now = () => new Date(),
}: {
  store: AdminStore;
  sessionId?: string | null;
  stationId: string;
  name: string;
  active: boolean;
  now?: () => Date;
}): Promise<{ ok: true; station: Station } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const normalizedStationId = normalizeStationId(stationId);
  if (!normalizedStationId) {
    return { ok: false, error: "Station is required." };
  }

  const validName = validateStationName(name);
  if (!validName.ok) {
    return { ok: false, error: validName.error };
  }

  return {
    ok: true,
    station: await store.updateStation(normalizedStationId, { name: validName.name, active }),
  };
}

export async function createVendorAccount({
  store,
  sessionId,
  username,
  password,
  stationId,
  active,
  now = () => new Date(),
  newSalt = generateSalt,
}: {
  store: AdminStore;
  sessionId?: string | null;
  username: string;
  password: string;
  stationId: string;
  active: boolean;
  now?: () => Date;
  newSalt?: () => string;
}): Promise<{ ok: true; vendorAccount: VendorAccount } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const validFields = validateVendorFields(username, stationId);
  if (!validFields.ok) {
    return { ok: false, error: validFields.error };
  }

  if (!password) {
    return { ok: false, error: "Vendor password is required." };
  }

  const passwordSalt = newSalt();
  return {
    ok: true,
    vendorAccount: await store.createVendorAccount({
      username: validFields.username,
      stationId: validFields.stationId,
      passwordHash: hashPassword(password, passwordSalt),
      passwordSalt,
      active,
    }),
  };
}

export async function editVendorAccount({
  store,
  sessionId,
  vendorId,
  username,
  stationId,
  active,
  now = () => new Date(),
}: {
  store: AdminStore;
  sessionId?: string | null;
  vendorId: string;
  username: string;
  stationId: string;
  active: boolean;
  now?: () => Date;
}): Promise<{ ok: true; vendorAccount: VendorAccount } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const normalizedVendorId = vendorId.trim();
  if (!normalizedVendorId) {
    return { ok: false, error: "Vendor account is required." };
  }

  const validFields = validateVendorFields(username, stationId);
  if (!validFields.ok) {
    return { ok: false, error: validFields.error };
  }

  return {
    ok: true,
    vendorAccount: await store.updateVendorAccount(normalizedVendorId, {
      username: validFields.username,
      stationId: validFields.stationId,
      active,
    }),
  };
}

export async function updateDelegateName({
  store,
  sessionId,
  delegateId,
  fullName,
  now = () => new Date(),
}: {
  store: AdminStore;
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
  store: AdminStore;
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

export async function drawLuckyWinner({
  store,
  sessionId,
  drawLabel,
  now = () => new Date(),
  random = Math.random,
}: {
  store: AdminStore;
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

export function getLuckyDrawPool(participants: AdminParticipant[]) {
  return participants.filter((participant) => ["eligible", "manual_include"].includes(participant.drawStatus));
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type AdminAccountRow = {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
};

type SessionWithAdminRow = {
  id: string;
  admin_id: string;
  admin_accounts?: { username: string } | { username: string }[] | null;
};

type EventSettingsRow = {
  participation_open: boolean;
  updated_at: string;
  admin_accounts?: { username: string } | { username: string }[] | null;
};

type StationRow = {
  id: string;
  name: string;
  active: boolean;
};

type VendorAccountRow = {
  id: string;
  username: string;
  station_id: string;
  active: boolean;
  stations?: { name: string } | { name: string }[] | null;
};

type ParticipantRpcRow = {
  id: string;
  full_name: string;
  registration_number: string;
  stamps_collected: number;
  total_active_stations: number;
  survey_submitted: boolean;
  draw_status: string;
};

type StationSummaryRpcRow = {
  station_id: string;
  station_name: string;
  active: boolean;
  completions: number;
};

type ScanAuditLogRpcRow = {
  id: string;
  delegate_id: string | null;
  delegate_full_name: string | null;
  station_id: string | null;
  station_name: string | null;
  scanned_at: string;
  qr_token_id: string | null;
  qr_token: string;
  result: string;
  consumed: boolean;
};

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

function stationFromRow(row: StationRow): Station {
  return { id: row.id, name: row.name, active: row.active };
}

function vendorAccountFromRow(row: VendorAccountRow): VendorAccount {
  const station = Array.isArray(row.stations) ? row.stations[0] : row.stations;
  return {
    id: row.id,
    username: row.username,
    stationId: row.station_id,
    stationName: station?.name ?? "Unassigned station",
    active: row.active,
  };
}

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

function stationSummaryFromRpcRow(row: StationSummaryRpcRow): AdminStationSummary {
  return {
    stationId: row.station_id,
    stationName: row.station_name,
    active: row.active,
    completions: row.completions,
  };
}

function scanAuditLogFromRpcRow(row: ScanAuditLogRpcRow): AdminScanAuditLog {
  return {
    id: row.id,
    delegateId: row.delegate_id,
    delegateFullName: row.delegate_full_name,
    stationId: row.station_id,
    stationName: row.station_name,
    scannedAt: row.scanned_at,
    qrTokenId: row.qr_token_id,
    qrToken: row.qr_token,
    result: row.result,
    consumed: row.consumed,
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

function winnerHistoryFromRow(row: WinnerHistoryRow): AdminWinnerHistoryEntry {
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

function luckyDrawCandidateFromRow(row: DelegateParticipantRow): LuckyDrawCandidate {
  return {
    id: row.id,
    fullName: row.full_name,
    registrationNumber: row.registration_number,
    drawStatus: row.draw_status,
  };
}

export class SupabaseAdminStore implements AdminStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  async findActiveAdminByUsername(username: string): Promise<AdminAccount | null> {
    const { data, error } = await this.supabase
      .from("admin_accounts")
      .select("id, username, password_hash, password_salt")
      .eq("username", username)
      .eq("active", true)
      .maybeSingle<AdminAccountRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data
      ? {
          id: data.id,
          username: data.username,
          passwordHash: data.password_hash,
          passwordSalt: data.password_salt,
        }
      : null;
  }

  async createAdminSession(adminId: string, expiresAt: string): Promise<AdminSession> {
    const id = randomUUID();
    const { data, error } = await this.supabase
      .from("admin_sessions")
      .insert({ id, admin_id: adminId, expires_at: expiresAt })
      .select("id, admin_id, expires_at")
      .single<{ id: string; admin_id: string; expires_at: string }>();

    if (error) {
      throw new Error(error.message);
    }

    return { id: data.id, adminId: data.admin_id, expiresAt: data.expires_at };
  }

  async findValidSession(sessionId: string, nowIso: string): Promise<ValidAdminSession | null> {
    const { data, error } = await this.supabase
      .from("admin_sessions")
      .select("id, admin_id, admin_accounts!inner(username)")
      .eq("id", sessionId)
      .gt("expires_at", nowIso)
      .maybeSingle<SessionWithAdminRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    const adminAccount = Array.isArray(data.admin_accounts) ? data.admin_accounts[0] : data.admin_accounts;
    return { id: data.id, adminId: data.admin_id, username: adminAccount?.username ?? "admin" };
  }

  async readParticipationState(): Promise<ParticipationState> {
    const { data, error } = await this.supabase
      .from("event_settings")
      .select("participation_open, updated_at, admin_accounts(username)")
      .eq("id", 1)
      .single<EventSettingsRow>();

    if (error) {
      throw new Error(error.message);
    }

    const adminAccount = Array.isArray(data.admin_accounts) ? data.admin_accounts[0] : data.admin_accounts;
    return {
      open: data.participation_open,
      updatedAt: data.updated_at,
      updatedByUsername: adminAccount?.username ?? null,
    };
  }

  async updateParticipationState(open: boolean, adminId: string, updatedAt: string): Promise<ParticipationState> {
    const { data, error } = await this.supabase
      .from("event_settings")
      .update({ participation_open: open, updated_by_admin_id: adminId, updated_at: updatedAt })
      .eq("id", 1)
      .select("participation_open, updated_at, admin_accounts(username)")
      .single<EventSettingsRow>();

    if (error) {
      throw new Error(error.message);
    }

    const adminAccount = Array.isArray(data.admin_accounts) ? data.admin_accounts[0] : data.admin_accounts;
    return {
      open: data.participation_open,
      updatedAt: data.updated_at,
      updatedByUsername: adminAccount?.username ?? null,
    };
  }

  async listStations(): Promise<Station[]> {
    const { data, error } = await this.supabase.from("stations").select("id, name, active").order("name");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(stationFromRow);
  }

  async listVendorAccounts(): Promise<VendorAccount[]> {
    const { data, error } = await this.supabase
      .from("vendor_accounts")
      .select("id, username, station_id, active, stations(name)")
      .order("username");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(vendorAccountFromRow);
  }

  async createStation(station: StationInput): Promise<Station> {
    const { data, error } = await this.supabase
      .from("stations")
      .insert({ name: station.name, active: station.active })
      .select("id, name, active")
      .single<StationRow>();

    if (error) {
      throw new Error(error.message);
    }

    return stationFromRow(data);
  }

  async updateStation(stationId: string, station: StationInput): Promise<Station> {
    const { data, error } = await this.supabase
      .from("stations")
      .update({ name: station.name, active: station.active })
      .eq("id", stationId)
      .select("id, name, active")
      .single<StationRow>();

    if (error) {
      throw new Error(error.message);
    }

    return stationFromRow(data);
  }

  async createVendorAccount(vendor: VendorAccountInput): Promise<VendorAccount> {
    const { data, error } = await this.supabase
      .from("vendor_accounts")
      .insert({
        username: vendor.username,
        station_id: vendor.stationId,
        password_hash: vendor.passwordHash,
        password_salt: vendor.passwordSalt,
        active: vendor.active,
      })
      .select("id, username, station_id, active, stations(name)")
      .single<VendorAccountRow>();

    if (error) {
      throw new Error(error.message);
    }

    return vendorAccountFromRow(data);
  }

  async updateVendorAccount(vendorId: string, vendor: VendorAccountUpdate): Promise<VendorAccount> {
    const { data, error } = await this.supabase
      .from("vendor_accounts")
      .update({ username: vendor.username, station_id: vendor.stationId, active: vendor.active })
      .eq("id", vendorId)
      .select("id, username, station_id, active, stations(name)")
      .single<VendorAccountRow>();

    if (error) {
      throw new Error(error.message);
    }

    return vendorAccountFromRow(data);
  }

  async listParticipants(): Promise<AdminParticipant[]> {
    const { data, error } = await this.supabase.rpc("admin_participant_progress");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(participantFromRpcRow);
  }

  async listStationSummaries(): Promise<AdminStationSummary[]> {
    const { data, error } = await this.supabase.rpc("admin_station_summaries");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(stationSummaryFromRpcRow);
  }

  async listScanAuditLogs(): Promise<AdminScanAuditLog[]> {
    const { data, error } = await this.supabase.rpc("admin_scan_audit_logs");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(scanAuditLogFromRpcRow);
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
