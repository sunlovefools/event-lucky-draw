import { createSupabaseBrowserClient } from "@/lib/supabase";
import { readParticipationOpen as queryParticipationOpen } from "@/lib/participation";
import {
  requireVendorSession,
  type VendorSessionStore,
  SupabaseVendorAuthStore,
  type VendorStation,
  type ValidVendorSession,
} from "@/lib/auth/vendor-auth";
import { type Delegate, extractRegistrationNumberFromBadgePayload } from "@/lib/delegate";
import { stationFromRow, type Station } from "@/lib/shared/station";
import { delegateFromRow } from "@/lib/delegate-session";

export type StationDashboardResult =
  | { found: false }
  | {
      found: true;
      station: Station;
      participationOpen: boolean;
      scanHistory: StationScanHistoryEntry[];
    };

export type VendorDashboardResult =
  | { authorized: false }
  | {
      authorized: true;
      vendor: { id: string; username: string };
      station: VendorStation;
      participationOpen: boolean;
      scanHistory: StationScanHistoryEntry[];
    };

export type StationScanHistoryEntry = {
  id: string;
  delegateFullName: string;
  stationId: string;
  stationName: string;
  collectedAt: string;
};

export type VendorScanDelegateStamp = {
  id: string;
  delegateId: string;
  stationId: string;
  collectedAt: string;
};

export type VendorScanAuditLogInput = {
  delegateId: string;
  stationId: string;
  qrToken: string;
  result: string;
  consumed: boolean;
  scannedAt: string;
};

export type VendorScanResult =
  | { ok: true; delegate: { fullName: string }; duplicate: boolean; message: string }
  | { ok: false; reason: "not-registered" | "invalid" | "closed"; error: string };

export type VendorPortalStore = VendorSessionStore & {
  readParticipationOpen(): Promise<boolean>;
  findStationByName(stationName: string): Promise<Station | null>;
  listStationScanHistory(stationId: string): Promise<StationScanHistoryEntry[]>;
  findDelegateByRegistrationNumber(registrationNumber: string): Promise<Delegate | null>;
  createDelegateStampIfMissing(delegateId: string, stationId: string, collectedAt: string): Promise<{ created: boolean; stamp: VendorScanDelegateStamp | null }>;
  recordScanAuditLog(log: VendorScanAuditLogInput): Promise<void>;
};

export async function getStationDashboard({
  store,
  stationName,
}: {
  store: VendorPortalStore;
  stationName: string;
}): Promise<StationDashboardResult> {
  const station = await store.findStationByName(stationName.trim());
  if (!station) {
    return { found: false };
  }

  const [participationOpen, scanHistory] = await Promise.all([
    store.readParticipationOpen(),
    store.listStationScanHistory(station.id),
  ]);

  return { found: true, station, participationOpen, scanHistory };
}

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

  const [participationOpen, scanHistory] = await Promise.all([
    store.readParticipationOpen(),
    store.listStationScanHistory(session.vendor.station.id),
  ]);

  return {
    authorized: true,
    vendor: { id: session.vendor.id, username: session.vendor.username },
    station: session.vendor.station,
    participationOpen,
    scanHistory,
  };
}

export async function collectStampForStationScan({
  store,
  station,
  badgePayload,
  now = () => new Date(),
}: {
  store: VendorPortalStore;
  station: Station;
  badgePayload: string;
  now?: () => Date;
}): Promise<VendorScanResult> {
  const scannedAt = now().toISOString();

  const participationOpen = await store.readParticipationOpen();
  if (!participationOpen) {
    return { ok: false, reason: "closed", error: "Participation is closed." };
  }

  const registrationNumber = extractRegistrationNumberFromBadgePayload(badgePayload);
  if (!registrationNumber) {
    return { ok: false, reason: "invalid", error: "This QR isn't a valid delegate badge." };
  }

  const delegate = await store.findDelegateByRegistrationNumber(registrationNumber);
  if (!delegate) {
    return { ok: false, reason: "not-registered", error: "Delegate not registered — ask them to register first." };
  }

  const stationId = station.id;
  const stampResult = await store.createDelegateStampIfMissing(delegate.id, stationId, scannedAt);
  if (!stampResult.created) {
    await store.recordScanAuditLog({
      delegateId: delegate.id,
      stationId,
      qrToken: badgePayload.trim(),
      result: "duplicate",
      consumed: true,
      scannedAt,
    }).catch(() => {});
    return {
      ok: true,
      delegate: { fullName: delegate.fullName },
      duplicate: true,
      message: `${delegate.fullName} was already collected at this station.`,
    };
  }

  await store.recordScanAuditLog({
    delegateId: delegate.id,
    stationId,
    qrToken: badgePayload.trim(),
    result: "success",
    consumed: true,
    scannedAt,
  }).catch(() => {});

  return {
    ok: true,
    delegate: { fullName: delegate.fullName },
    duplicate: false,
    message: `Successful Stamped ${delegate.fullName} QR! Ask him/her to refresh their page to look at the stamp!`,
  };
}

export async function collectStampFromVendorScan({
  store,
  session,
  badgePayload,
  now = () => new Date(),
}: {
  store: VendorPortalStore;
  session: ValidVendorSession;
  badgePayload: string;
  now?: () => Date;
}): Promise<VendorScanResult> {
  return collectStampForStationScan({ store, station: session.vendor.station, badgePayload, now });
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type DelegateRow = { id: string; registration_number: string; full_name: string };

type VendorScanDelegateStampRow = {
  id: string;
  delegate_id: string;
  station_id: string;
  collected_at: string;
};

type StationScanHistoryRow = {
  id: string;
  station_id: string;
  collected_at: string;
  delegates?: { full_name: string } | { full_name: string }[] | null;
  stations?: { name: string } | { name: string }[] | null;
};

function stampFromRow(row: VendorScanDelegateStampRow): VendorScanDelegateStamp {
  return { id: row.id, delegateId: row.delegate_id, stationId: row.station_id, collectedAt: row.collected_at };
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

  async findStationByName(stationName: string): Promise<Station | null> {
    const { data, error } = await this.supabase
      .from("stations")
      .select("id, name, active")
      .eq("name", stationName)
      .maybeSingle<{ id: string; name: string; active: boolean }>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? stationFromRow(data) : null;
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

  async findDelegateByRegistrationNumber(registrationNumber: string): Promise<Delegate | null> {
    const { data, error } = await this.supabase
      .from("delegates")
      .select("id, registration_number, full_name")
      .eq("registration_number", registrationNumber)
      .maybeSingle<DelegateRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? delegateFromRow(data) : null;
  }

  async createDelegateStampIfMissing(delegateId: string, stationId: string, collectedAt: string): Promise<{ created: boolean; stamp: VendorScanDelegateStamp | null }> {
    const { data, error } = await this.supabase
      .from("delegate_station_stamps")
      .upsert(
        { delegate_id: delegateId, station_id: stationId, collected_at: collectedAt },
        { onConflict: "delegate_id,station_id", ignoreDuplicates: true },
      )
      .select("id, delegate_id, station_id, collected_at")
      .maybeSingle<VendorScanDelegateStampRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? { created: true, stamp: stampFromRow(data) } : { created: false, stamp: null };
  }

  async recordScanAuditLog(log: VendorScanAuditLogInput): Promise<void> {
    const { error } = await this.supabase.from("scan_audit_logs").insert({
      delegate_id: log.delegateId,
      station_id: log.stationId,
      qr_token: log.qrToken,
      result: log.result,
      consumed: log.consumed,
      scanned_at: log.scannedAt,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}
