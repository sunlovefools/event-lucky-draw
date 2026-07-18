import { createHash, randomUUID } from "node:crypto";

import { createSupabaseBrowserClient } from "@/lib/supabase";

export type VendorStation = {
  id: string;
  name: string;
  active: boolean;
};

export type VendorAccount = {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  station: VendorStation;
};

export type VendorSession = {
  id: string;
  vendorId: string;
  expiresAt: string;
};

export type ValidVendorSession = {
  id: string;
  vendor: {
    id: string;
    username: string;
    station: VendorStation;
  };
};

export type StationQrStatus = "active" | "consumed" | "expired" | "invalidated";

export type StationQr = {
  id: string;
  token: string;
  stationId: string;
  url: string;
  expiresAt: string;
  invalidatedAt: string | null;
  consumedAt: string | null;
  status: StationQrStatus;
  scannedByFullName?: string;
};

export type StationScanHistoryEntry = {
  id: string;
  delegateFullName: string;
  stationId: string;
  stationName: string;
  collectedAt: string;
};

export type VendorStore = {
  findActiveVendorByUsername(username: string): Promise<VendorAccount | null>;
  createVendorSession(vendorId: string, expiresAt: string): Promise<VendorSession>;
  findValidVendorSession(sessionId: string, nowIso: string): Promise<ValidVendorSession | null>;
  readParticipationOpen(): Promise<boolean>;
  findCurrentQrForStation(stationId: string, nowIso: string): Promise<StationQr | null>;
  listStationScanHistory(stationId: string): Promise<StationScanHistoryEntry[]>;
  invalidateCurrentQrForStation(stationId: string, invalidatedAt: string): Promise<void>;
  createStationQr(qr: { stationId: string; token: string; expiresAt: string }): Promise<StationQr>;
};

export type VendorDashboardResult =
  | { authorized: false }
  | {
      authorized: true;
      vendor: { id: string; username: string };
      station: VendorStation;
      participationOpen: boolean;
      currentQr: StationQr | null;
      scanHistory: StationScanHistoryEntry[];
    };

const VENDOR_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const STATION_QR_DURATION_MS = 2 * 60 * 1000;

export function hashVendorPassword(password: string, salt: string) {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

async function requireVendorSession({
  store,
  sessionId,
  nowIso,
}: {
  store: VendorStore;
  sessionId?: string | null;
  nowIso: string;
}) {
  if (!sessionId) {
    return null;
  }

  return store.findValidVendorSession(sessionId, nowIso);
}

export async function authenticateVendor({
  store,
  username,
  password,
  now = () => new Date(),
}: {
  store: VendorStore;
  username: string;
  password: string;
  now?: () => Date;
}): Promise<{ ok: true; session: VendorSession } | { ok: false; error: string }> {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !password) {
    return { ok: false, error: "Invalid username or password." };
  }

  const vendor = await store.findActiveVendorByUsername(normalizedUsername);
  if (!vendor) {
    return { ok: false, error: "Invalid username or password." };
  }

  const candidateHash = hashVendorPassword(password, vendor.passwordSalt);
  if (candidateHash !== vendor.passwordHash) {
    return { ok: false, error: "Invalid username or password." };
  }

  const expiresAt = new Date(now().getTime() + VENDOR_SESSION_DURATION_MS).toISOString();
  return { ok: true, session: await store.createVendorSession(vendor.id, expiresAt) };
}

export async function getVendorDashboard({
  store,
  sessionId,
  now = () => new Date(),
}: {
  store: VendorStore;
  sessionId?: string | null;
  now?: () => Date;
}): Promise<VendorDashboardResult> {
  const nowIso = now().toISOString();
  const session = await requireVendorSession({ store, sessionId, nowIso });
  if (!session) {
    return { authorized: false };
  }

  const [participationOpen, currentQr, scanHistory] = await Promise.all([
    store.readParticipationOpen(),
    store.findCurrentQrForStation(session.vendor.station.id, nowIso),
    store.listStationScanHistory(session.vendor.station.id),
  ]);

  return {
    authorized: true,
    vendor: { id: session.vendor.id, username: session.vendor.username },
    station: session.vendor.station,
    participationOpen,
    currentQr,
    scanHistory,
  };
}

export async function generateStationQr({
  store,
  sessionId,
  now = () => new Date(),
  newToken = randomUUID,
}: {
  store: VendorStore;
  sessionId?: string | null;
  now?: () => Date;
  newToken?: () => string;
}): Promise<{ ok: true; qr: StationQr } | { ok: false; error: string }> {
  const generatedAt = now();
  const generatedAtIso = generatedAt.toISOString();
  const session = await requireVendorSession({ store, sessionId, nowIso: generatedAtIso });
  if (!session) {
    return { ok: false, error: "Vendor login required." };
  }

  const participationOpen = await store.readParticipationOpen();
  if (!participationOpen) {
    return { ok: false, error: "Participation is closed." };
  }

  await store.invalidateCurrentQrForStation(session.vendor.station.id, generatedAtIso);
  const expiresAt = new Date(generatedAt.getTime() + STATION_QR_DURATION_MS).toISOString();

  return {
    ok: true,
    qr: await store.createStationQr({ stationId: session.vendor.station.id, token: newToken(), expiresAt }),
  };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type VendorAccountRow = {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  stations?: { id: string; name: string; active: boolean } | { id: string; name: string; active: boolean }[] | null;
};

type VendorSessionRow = {
  id: string;
  vendor_accounts?: {
    id: string;
    username: string;
    stations?: { id: string; name: string; active: boolean } | { id: string; name: string; active: boolean }[] | null;
  } | Array<{
    id: string;
    username: string;
    stations?: { id: string; name: string; active: boolean } | { id: string; name: string; active: boolean }[] | null;
  }> | null;
};

type EventSettingsRow = {
  participation_open: boolean;
};

type StationQrRow = {
  id: string;
  token: string;
  station_id: string;
  expires_at: string;
  invalidated_at: string | null;
  consumed_at: string | null;
  delegate_station_stamps?: { delegates?: { full_name: string } | { full_name: string }[] | null } | Array<{ delegates?: { full_name: string } | { full_name: string }[] | null }> | null;
};

type StationScanHistoryRow = {
  id: string;
  station_id: string;
  collected_at: string;
  delegates?: { full_name: string } | { full_name: string }[] | null;
  stations?: { name: string } | { name: string }[] | null;
};

function stationFromJoin(station: { id: string; name: string; active: boolean } | { id: string; name: string; active: boolean }[] | null | undefined) {
  const row = Array.isArray(station) ? station[0] : station;
  if (!row) {
    throw new Error("Vendor account is missing an assigned station.");
  }

  return { id: row.id, name: row.name, active: row.active };
}

function stationQrStatus(row: StationQrRow, nowIso?: string): StationQrStatus {
  if (row.consumed_at) {
    return "consumed";
  }

  if (row.invalidated_at) {
    return "invalidated";
  }

  if (nowIso && row.expires_at <= nowIso) {
    return "expired";
  }

  return "active";
}

function scannedByFullNameFromRow(row: StationQrRow) {
  const stamp = Array.isArray(row.delegate_station_stamps) ? row.delegate_station_stamps[0] : row.delegate_station_stamps;
  const delegate = Array.isArray(stamp?.delegates) ? stamp?.delegates[0] : stamp?.delegates;
  return delegate?.full_name;
}

function stationQrFromRow(row: StationQrRow, nowIso?: string): StationQr {
  const scannedByFullName = scannedByFullNameFromRow(row);
  return {
    id: row.id,
    token: row.token,
    stationId: row.station_id,
    url: `/stamp/${row.token}`,
    expiresAt: row.expires_at,
    invalidatedAt: row.invalidated_at,
    consumedAt: row.consumed_at,
    status: stationQrStatus(row, nowIso),
    ...(scannedByFullName ? { scannedByFullName } : {}),
  };
}

function scanHistoryFromRow(row: StationScanHistoryRow): StationScanHistoryEntry {
  const delegate = Array.isArray(row.delegates) ? row.delegates[0] : row.delegates;
  const station = Array.isArray(row.stations) ? row.stations[0] : row.stations;
  return {
    id: row.id,
    delegateFullName: delegate?.full_name ?? "Unknown delegate",
    stationId: row.station_id,
    stationName: station?.name ?? "Unknown station",
    collectedAt: row.collected_at,
  };
}

export class SupabaseVendorStore implements VendorStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  async findActiveVendorByUsername(username: string): Promise<VendorAccount | null> {
    const { data, error } = await this.supabase
      .from("vendor_accounts")
      .select("id, username, password_hash, password_salt, stations!inner(id, name, active)")
      .eq("username", username)
      .eq("active", true)
      .maybeSingle<VendorAccountRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      username: data.username,
      passwordHash: data.password_hash,
      passwordSalt: data.password_salt,
      station: stationFromJoin(data.stations),
    };
  }

  async createVendorSession(vendorId: string, expiresAt: string): Promise<VendorSession> {
    const id = randomUUID();
    const { data, error } = await this.supabase
      .from("vendor_sessions")
      .insert({ id, vendor_id: vendorId, expires_at: expiresAt })
      .select("id, vendor_id, expires_at")
      .single<{ id: string; vendor_id: string; expires_at: string }>();

    if (error) {
      throw new Error(error.message);
    }

    return { id: data.id, vendorId: data.vendor_id, expiresAt: data.expires_at };
  }

  async findValidVendorSession(sessionId: string, nowIso: string): Promise<ValidVendorSession | null> {
    const { data, error } = await this.supabase
      .from("vendor_sessions")
      .select("id, vendor_accounts!inner(id, username, stations!inner(id, name, active))")
      .eq("id", sessionId)
      .gt("expires_at", nowIso)
      .maybeSingle<VendorSessionRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    const vendor = Array.isArray(data.vendor_accounts) ? data.vendor_accounts[0] : data.vendor_accounts;
    if (!vendor) {
      return null;
    }

    return {
      id: data.id,
      vendor: {
        id: vendor.id,
        username: vendor.username,
        station: stationFromJoin(vendor.stations),
      },
    };
  }

  async readParticipationOpen(): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("event_settings")
      .select("participation_open")
      .eq("id", 1)
      .single<EventSettingsRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data.participation_open;
  }

  async findCurrentQrForStation(stationId: string, nowIso: string): Promise<StationQr | null> {
    const { data, error } = await this.supabase
      .from("station_qr_tokens")
      .select("id, token, station_id, expires_at, invalidated_at, consumed_at, delegate_station_stamps(delegates(full_name))")
      .eq("station_id", stationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<StationQrRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? stationQrFromRow(data, nowIso) : null;
  }

  async listStationScanHistory(stationId: string): Promise<StationScanHistoryEntry[]> {
    const { data, error } = await this.supabase
      .from("delegate_station_stamps")
      .select("id, station_id, collected_at, delegates(full_name), stations(name)")
      .eq("station_id", stationId)
      .order("collected_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(scanHistoryFromRow);
  }

  async invalidateCurrentQrForStation(stationId: string, invalidatedAt: string): Promise<void> {
    const { error } = await this.supabase
      .from("station_qr_tokens")
      .update({ invalidated_at: invalidatedAt })
      .eq("station_id", stationId)
      .is("invalidated_at", null)
      .is("consumed_at", null);

    if (error) {
      throw new Error(error.message);
    }
  }

  async createStationQr(qr: { stationId: string; token: string; expiresAt: string }): Promise<StationQr> {
    const { data, error } = await this.supabase
      .from("station_qr_tokens")
      .insert({ station_id: qr.stationId, token: qr.token, expires_at: qr.expiresAt })
      .select("id, token, station_id, expires_at, invalidated_at, consumed_at")
      .single<StationQrRow>();

    if (error) {
      throw new Error(error.message);
    }

    return stationQrFromRow(data);
  }
}
