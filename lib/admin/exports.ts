import { createSupabaseBrowserClient } from "@/lib/supabase";
import { type ValidAdminSession } from "@/lib/auth/admin-auth";
import { SupabaseAdminAuthStore } from "@/lib/auth/admin-auth";

export type AdminExportKind = "participants" | "station-completions" | "survey-responses" | "winner-history" | "scan-audit";

export type ParticipantProgressExportRow = {
  fullName: string;
  registrationNumber: string;
  stampsCollected: number;
  totalActiveStations: number;
  surveySubmitted: boolean;
  drawStatus: string;
};

export type StationCompletionExportRow = {
  stationName: string;
  active: boolean;
  completions: number;
};

export type SurveyResponseExportRow = {
  fullName: string;
  registrationNumber: string;
  satisfaction: string;
  favoriteStation: string;
  feedback: string;
  submittedAt: string;
};

export type WinnerHistoryExportRow = {
  roundNumber: number;
  fullName: string;
  registrationNumber: string;
  wonAt: string;
};

export type ScanAuditExportRow = {
  delegateFullName: string | null;
  stationName: string | null;
  scannedAt: string;
  qrToken: string;
  result: string;
  consumed: boolean;
};

export type AdminExportStore = {
  findValidSession(sessionId: string, nowIso: string): Promise<ValidAdminSession | null>;
  listParticipantProgressExportRows(): Promise<ParticipantProgressExportRow[]>;
  listStationCompletionExportRows(): Promise<StationCompletionExportRow[]>;
  listSurveyResponseExportRows(): Promise<SurveyResponseExportRow[]>;
  listWinnerHistoryExportRows(): Promise<WinnerHistoryExportRow[]>;
  listScanAuditExportRows(): Promise<ScanAuditExportRow[]>;
};

export type AdminCsvExportResult =
  | { ok: true; filename: string; contentType: "text/csv; charset=utf-8"; body: string }
  | { ok: false; error: string };

const EXPORT_DEFINITIONS = {
  participants: {
    filename: "participants-progress.csv",
    headers: ["full_name", "registration_number", "stamps_collected", "total_active_stations", "survey_submitted", "draw_status"],
    rows: (store: AdminExportStore) => store.listParticipantProgressExportRows(),
    values: (row: ParticipantProgressExportRow) => [row.fullName, row.registrationNumber, row.stampsCollected, row.totalActiveStations, row.surveySubmitted, row.drawStatus],
  },
  "station-completions": {
    filename: "station-completions.csv",
    headers: ["station_name", "active", "completions"],
    rows: (store: AdminExportStore) => store.listStationCompletionExportRows(),
    values: (row: StationCompletionExportRow) => [row.stationName, row.active, row.completions],
  },
  "survey-responses": {
    filename: "survey-responses.csv",
    headers: ["full_name", "registration_number", "satisfaction", "favorite_station", "feedback", "submitted_at"],
    rows: (store: AdminExportStore) => store.listSurveyResponseExportRows(),
    values: (row: SurveyResponseExportRow) => [row.fullName, row.registrationNumber, row.satisfaction, row.favoriteStation, row.feedback, row.submittedAt],
  },
  "winner-history": {
    filename: "winner-history.csv",
    headers: ["round_number", "full_name", "registration_number", "won_at"],
    rows: (store: AdminExportStore) => store.listWinnerHistoryExportRows(),
    values: (row: WinnerHistoryExportRow) => [row.roundNumber, row.fullName, row.registrationNumber, row.wonAt],
  },
  "scan-audit": {
    filename: "scan-audit.csv",
    headers: ["delegate_full_name", "station_name", "scanned_at", "qr_token", "result", "consumed"],
    rows: (store: AdminExportStore) => store.listScanAuditExportRows(),
    values: (row: ScanAuditExportRow) => [row.delegateFullName ?? "", row.stationName ?? "", row.scannedAt, row.qrToken, row.result, row.consumed],
  },
} satisfies Record<AdminExportKind, {
  filename: string;
  headers: string[];
  rows: (store: AdminExportStore) => Promise<unknown[]>;
  values: (row: never) => Array<string | number | boolean>;
}>;

function csvCell(value: string | number | boolean) {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsv(headers: string[], rows: unknown[], values: (row: never) => Array<string | number | boolean>) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(values(row as never).map(csvCell).join(","));
  }

  return `${lines.join("\n")}\n`;
}

export async function exportAdminCsv({
  store,
  sessionId,
  kind,
  now = () => new Date(),
}: {
  store: AdminExportStore;
  sessionId?: string | null;
  kind: AdminExportKind;
  now?: () => Date;
}): Promise<AdminCsvExportResult> {
  if (!sessionId) {
    return { ok: false, error: "Admin login required." };
  }

  const session = await store.findValidSession(sessionId, now().toISOString());
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const definition = EXPORT_DEFINITIONS[kind];
  const rows = await definition.rows(store);
  return {
    ok: true,
    filename: definition.filename,
    contentType: "text/csv; charset=utf-8",
    body: toCsv(definition.headers, rows, definition.values),
  };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type ParticipantRpcRow = {
  full_name: string;
  registration_number: string;
  stamps_collected: number;
  total_active_stations: number;
  survey_submitted: boolean;
  draw_status: string;
};

type StationCompletionRpcRow = {
  station_name: string;
  active: boolean;
  completions: number;
};

type SurveyResponseRow = {
  satisfaction: string;
  favorite_station: string;
  feedback: string;
  submitted_at: string;
  delegates?: { full_name: string; registration_number: string } | Array<{ full_name: string; registration_number: string }> | null;
};

type WinnerHistoryRow = {
  draw_rounds?: { round_number: number } | Array<{ round_number: number }> | null;
  won_at: string;
  delegates?: { full_name: string; registration_number: string } | Array<{ full_name: string; registration_number: string }> | null;
};

type ScanAuditRpcRow = {
  delegate_full_name: string | null;
  station_name: string | null;
  scanned_at: string;
  qr_token: string;
  result: string;
  consumed: boolean;
};

type SessionWithAdminRow = {
  id: string;
  admin_id: string;
  admin_accounts?: { username: string } | { username: string }[] | null;
};

function joinedOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export class SupabaseAdminExportStore implements AdminExportStore {
  private readonly auth = new SupabaseAdminAuthStore();

  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  findValidSession(sessionId: string, nowIso: string): Promise<ValidAdminSession | null> {
    return this.auth.findValidSession(sessionId, nowIso);
  }

  async listParticipantProgressExportRows(): Promise<ParticipantProgressExportRow[]> {
    const { data, error } = await this.supabase.rpc("admin_participant_progress");
    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row: ParticipantRpcRow) => ({
      fullName: row.full_name,
      registrationNumber: row.registration_number,
      stampsCollected: row.stamps_collected,
      totalActiveStations: row.total_active_stations,
      surveySubmitted: row.survey_submitted,
      drawStatus: row.draw_status,
    }));
  }

  async listStationCompletionExportRows(): Promise<StationCompletionExportRow[]> {
    const { data, error } = await this.supabase.rpc("admin_station_summaries");
    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row: StationCompletionRpcRow) => ({
      stationName: row.station_name,
      active: row.active,
      completions: row.completions,
    }));
  }

  async listSurveyResponseExportRows(): Promise<SurveyResponseExportRow[]> {
    const { data, error } = await this.supabase
      .from("final_survey_responses")
      .select("satisfaction, favorite_station, feedback, submitted_at, delegates(full_name, registration_number)")
      .order("submitted_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row: SurveyResponseRow) => {
      const delegate = joinedOne(row.delegates);
      return {
        fullName: delegate?.full_name ?? "Unknown delegate",
        registrationNumber: delegate?.registration_number ?? "",
        satisfaction: row.satisfaction,
        favoriteStation: row.favorite_station,
        feedback: row.feedback,
        submittedAt: row.submitted_at,
      };
    });
  }

  async listWinnerHistoryExportRows(): Promise<WinnerHistoryExportRow[]> {
    const { data, error } = await this.supabase
      .from("winner_history")
      .select("won_at, draw_rounds(round_number), delegates(full_name, registration_number)")
      .order("won_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row: WinnerHistoryRow) => {
      const delegate = joinedOne(row.delegates);
      return {
        roundNumber: joinedOne(row.draw_rounds)?.round_number ?? 0,
        fullName: delegate?.full_name ?? "Unknown delegate",
        registrationNumber: delegate?.registration_number ?? "",
        wonAt: row.won_at,
      };
    });
  }

  async listScanAuditExportRows(): Promise<ScanAuditExportRow[]> {
    const { data, error } = await this.supabase.rpc("admin_scan_audit_logs");
    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row: ScanAuditRpcRow) => ({
      delegateFullName: row.delegate_full_name,
      stationName: row.station_name,
      scannedAt: row.scanned_at,
      qrToken: row.qr_token,
      result: row.result,
      consumed: row.consumed,
    }));
  }
}
