import { randomUUID } from "node:crypto";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import { readParticipationOpen as queryParticipationOpen } from "@/lib/participation";
import {
  requireVendorSession,
  type VendorSessionStore,
  SupabaseVendorAuthStore,
  type VendorStation,
} from "@/lib/auth/vendor-auth";

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

export type VendorPortalStore = VendorSessionStore & {
  readParticipationOpen(): Promise<boolean>;
  findCurrentQrForStation(stationId: string, nowIso: string): Promise<StationQr | null>;
  listStationScanHistory(stationId: string): Promise<StationScanHistoryEntry[]>;
  invalidateCurrentQrForStation(stationId: string, invalidatedAt: string): Promise<void>;
  createStationQr(qr: { stationId: string; token: string; expiresAt: string }): Promise<StationQr>;
};

const STATION_QR_DURATION_MS = 2 * 60 * 1000;

export async function getVendorDashboard({
  store,
  sessionId,
  now = () => new Date(),
}: {
  store: VendorPortalStore;
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
  store: VendorPortalStore;
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

export class SupabaseVendorStore implements VendorPortalStore {
  private readonly auth = new SupabaseVendorAuthStore();

  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  findValidVendorSession(sessionId: string, nowIso: string) {
    return this.auth.findValidVendorSession(sessionId, nowIso);
  }

  async readParticipationOpen(): Promise<boolean> {
    return queryParticipationOpen(this.supabase);
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
