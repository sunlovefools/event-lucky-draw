import { createSupabaseBrowserClient } from "@/lib/supabase";
import { requireAdminSession, type AdminSessionStore, SupabaseAdminAuthStore } from "@/lib/auth/admin-auth";
import { type VendorDeviceSession } from "@/lib/auth/vendor-auth";
import { stationFromRow, type Station } from "@/lib/shared/station";
import { type VendorAccount } from "@/lib/shared/vendor-account";
import { type AdminParticipant } from "@/lib/admin/participants";
import { SupabaseStationsStore } from "@/lib/admin/stations";
import { SupabaseParticipantsStore } from "@/lib/admin/participants";
import { SupabaseDrawStore, type DrawRoundView } from "@/lib/admin/draw";

export type ParticipationState = {
  open: boolean;
  updatedAt: string;
  updatedByUsername: string | null;
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
  qrToken: string;
  result: string;
  consumed: boolean;
};

export type AdminDashboardResult =
  | { authorized: false }
  | {
      authorized: true;
      admin: { id: string; username: string };
      participation: ParticipationState;
      stations: Station[];
      // Compatibility fields for an old, un-routed vendor screen. The current
      // dashboard intentionally supplies no vendor data or database queries.
      vendorAccounts: VendorAccount[];
      vendorSessions?: VendorDeviceSession[];
      participants: AdminParticipant[];
      stationSummaries: AdminStationSummary[];
      scanAuditLogs: AdminScanAuditLog[];
      drawRounds: DrawRoundView[];
    };

// The dashboard aggregates reads from every admin feature store plus the
// participation write and admin session check.
export type DashboardStore = AdminSessionStore & {
  readParticipationState(): Promise<ParticipationState>;
  updateParticipationState(open: boolean, adminId: string, updatedAt: string): Promise<ParticipationState>;
  listStations(): Promise<Station[]>;
  listParticipants(): Promise<AdminParticipant[]>;
  listStationSummaries(): Promise<AdminStationSummary[]>;
  listScanAuditLogs(): Promise<AdminScanAuditLog[]>;
  listDrawRounds(): Promise<DrawRoundView[]>;
};

export async function getAdminDashboard({
  store,
  sessionId,
  now = () => new Date(),
}: {
  store: DashboardStore;
  sessionId?: string | null;
  now?: () => Date;
}): Promise<AdminDashboardResult> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { authorized: false };
  }

  const [participation, stations, participants, stationSummaries, scanAuditLogs, drawRounds] = await Promise.all([
    store.readParticipationState(),
    store.listStations(),
    store.listParticipants(),
    store.listStationSummaries(),
    store.listScanAuditLogs(),
    store.listDrawRounds(),
  ]);

  return {
    authorized: true,
    admin: { id: session.adminId, username: session.username },
    participation,
    stations,
    vendorAccounts: [],
    vendorSessions: [],
    participants,
    stationSummaries,
    scanAuditLogs,
    drawRounds,
  };
}

export async function setParticipationState({
  store,
  sessionId,
  open,
  now = () => new Date(),
}: {
  store: DashboardStore;
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

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type EventSettingsRow = {
  participation_open: boolean;
  updated_at: string;
  admin_accounts?: { username: string } | { username: string }[] | null;
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
  qr_token: string;
  result: string;
  consumed: boolean;
};

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
    qrToken: row.qr_token,
    result: row.result,
    consumed: row.consumed,
  };
}

export class SupabaseDashboardStore implements DashboardStore {
  private readonly auth = new SupabaseAdminAuthStore();
  private readonly stations = new SupabaseStationsStore();
  private readonly participants = new SupabaseParticipantsStore();
  private readonly draw = new SupabaseDrawStore();

  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  findValidSession(sessionId: string, nowIso: string) {
    return this.auth.findValidSession(sessionId, nowIso);
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

  listStations() {
    return this.stations.listStations();
  }

  listParticipants() {
    return this.participants.listParticipants();
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

  listDrawRounds() {
    return this.draw.listDrawRounds();
  }
}
