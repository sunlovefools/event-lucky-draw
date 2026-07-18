import { createHash, randomUUID } from "node:crypto";

import { createSupabaseBrowserClient } from "@/lib/supabase";

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
    };

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export function hashAdminPassword(password: string, salt: string) {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

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

  const candidateHash = hashAdminPassword(password, admin.passwordSalt);
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

  const [participation, stations, vendorAccounts, participants] = await Promise.all([
    store.readParticipationState(),
    store.listStations(),
    store.listVendorAccounts(),
    store.listParticipants(),
  ]);

  return {
    authorized: true,
    admin: { id: session.adminId, username: session.username },
    participation,
    stations,
    vendorAccounts,
    participants,
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
  newSalt = randomUUID,
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
      passwordHash: hashAdminPassword(password, passwordSalt),
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

type DelegateParticipantRow = {
  id: string;
  full_name: string;
  registration_number: string;
  draw_status: string;
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
