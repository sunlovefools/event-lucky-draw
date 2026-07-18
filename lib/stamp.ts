import { createSupabaseBrowserClient } from "@/lib/supabase";
import { type ValidDelegateSession } from "@/lib/delegate-session";
import { readParticipationOpen as queryParticipationOpen } from "@/lib/participation";

export type ConsumedStationQr = {
  id: string;
  token: string;
  stationId: string;
  stationName: string;
  consumedAt: string;
};

export type DelegateStationStamp = {
  id: string;
  delegateId: string;
  stationId: string;
  collectedAt: string;
};

export type AuditStationQrToken = {
  id: string;
  stationId: string;
  expiresAt: string;
  invalidatedAt: string | null;
  consumedAt: string | null;
};

export type ScanAuditLogInput = {
  delegateId: string;
  stationId: string | null;
  qrTokenId: string | null;
  qrToken: string;
  result: "success" | "duplicate" | "expired" | "used" | "invalid" | string;
  consumed: boolean;
  scannedAt: string;
};

export type StampCollectionStore = {
  readParticipationOpen(): Promise<boolean>;
  consumeStationQrToken(token: string, consumedAt: string): Promise<ConsumedStationQr | null>;
  findStationQrTokenForAudit(token: string): Promise<AuditStationQrToken | null>;
  hasDelegateStamp(delegateId: string, stationId: string): Promise<boolean>;
  createDelegateStamp(delegateId: string, stationId: string, collectedAt: string, qrTokenId?: string): Promise<DelegateStationStamp>;
  recordScanAuditLog(log: ScanAuditLogInput): Promise<void>;
};

export type StampCollectionResult =
  | { ok: true; station: { id: string; name: string }; duplicate: boolean; message: string }
  | { ok: false; error: string };

export type PreparedStampCollectionRequest =
  | { registrationRequired: true; pendingStampToken: string }
  | { registrationRequired: false; result: StampCollectionResult };

const INVALID_QR_ERROR = "This station QR is expired, used, or invalid. Please ask the station staff for a new QR.";

function failedScanAuditResult(qr: AuditStationQrToken | null, scannedAt: string) {
  if (!qr) {
    return "invalid";
  }

  if (qr.consumedAt) {
    return "used";
  }

  if (qr.expiresAt <= scannedAt) {
    return "expired";
  }

  return "invalid";
}

export async function prepareStampCollectionRequest({
  store,
  session,
  token,
  now = () => new Date(),
}: {
  store: StampCollectionStore;
  session: ValidDelegateSession | null;
  token: string;
  now?: () => Date;
}): Promise<PreparedStampCollectionRequest> {
  const pendingStampToken = token.trim();
  if (!session) {
    return { registrationRequired: true, pendingStampToken };
  }

  return {
    registrationRequired: false,
    result: await collectStationStamp({ store, session, token: pendingStampToken, now }),
  };
}

export async function collectStationStamp({
  store,
  session,
  token,
  now = () => new Date(),
}: {
  store: StampCollectionStore;
  session: ValidDelegateSession;
  token: string;
  now?: () => Date;
}): Promise<StampCollectionResult> {
  const collectedAt = now().toISOString();

  const participationOpen = await store.readParticipationOpen();
  if (!participationOpen) {
    return { ok: false, error: "Participation is closed." };
  }

  const trimmedToken = token.trim();
  const consumedQr = await store.consumeStationQrToken(trimmedToken, collectedAt);
  if (!consumedQr) {
    const auditQr = await store.findStationQrTokenForAudit(trimmedToken);
    await store.recordScanAuditLog({
      delegateId: session.delegate.id,
      stationId: auditQr?.stationId ?? null,
      qrTokenId: auditQr?.id ?? null,
      qrToken: trimmedToken,
      result: failedScanAuditResult(auditQr, collectedAt),
      consumed: false,
      scannedAt: collectedAt,
    });
    return { ok: false, error: INVALID_QR_ERROR };
  }

  const station = { id: consumedQr.stationId, name: consumedQr.stationName };
  const alreadyStamped = await store.hasDelegateStamp(session.delegate.id, consumedQr.stationId);
  if (alreadyStamped) {
    await store.recordScanAuditLog({
      delegateId: session.delegate.id,
      stationId: consumedQr.stationId,
      qrTokenId: consumedQr.id,
      qrToken: consumedQr.token,
      result: "duplicate",
      consumed: true,
      scannedAt: collectedAt,
    });
    return {
      ok: true,
      station,
      duplicate: true,
      message: `${consumedQr.stationName} was already collected.`,
    };
  }

  await store.createDelegateStamp(session.delegate.id, consumedQr.stationId, collectedAt, consumedQr.id);
  await store.recordScanAuditLog({
    delegateId: session.delegate.id,
    stationId: consumedQr.stationId,
    qrTokenId: consumedQr.id,
    qrToken: consumedQr.token,
    result: "success",
    consumed: true,
    scannedAt: collectedAt,
  });

  return {
    ok: true,
    station,
    duplicate: false,
    message: `${consumedQr.stationName} stamp collected.`,
  };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type ConsumedStationQrRow = {
  id: string;
  token: string;
  station_id: string;
  station_name: string;
  consumed_at: string;
};

type AuditStationQrTokenRow = {
  id: string;
  station_id: string;
  expires_at: string;
  invalidated_at: string | null;
  consumed_at: string | null;
};

type DelegateStationStampRow = {
  id: string;
  delegate_id: string;
  station_id: string;
  collected_at: string;
};

function consumedQrFromRow(row: ConsumedStationQrRow): ConsumedStationQr {
  return {
    id: row.id,
    token: row.token,
    stationId: row.station_id,
    stationName: row.station_name,
    consumedAt: row.consumed_at,
  };
}

function auditQrFromRow(row: AuditStationQrTokenRow): AuditStationQrToken {
  return {
    id: row.id,
    stationId: row.station_id,
    expiresAt: row.expires_at,
    invalidatedAt: row.invalidated_at,
    consumedAt: row.consumed_at,
  };
}

function stampFromRow(row: DelegateStationStampRow): DelegateStationStamp {
  return { id: row.id, delegateId: row.delegate_id, stationId: row.station_id, collectedAt: row.collected_at };
}

export class SupabaseStampCollectionStore implements StampCollectionStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  async readParticipationOpen(): Promise<boolean> {
    return queryParticipationOpen(this.supabase);
  }

  async consumeStationQrToken(token: string, consumedAt: string): Promise<ConsumedStationQr | null> {
    const { data, error } = await this.supabase
      .rpc("consume_station_qr_token", { qr_token: token, consumed_at: consumedAt })
      .maybeSingle<ConsumedStationQrRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? consumedQrFromRow(data) : null;
  }

  async findStationQrTokenForAudit(token: string): Promise<AuditStationQrToken | null> {
    const { data, error } = await this.supabase
      .from("station_qr_tokens")
      .select("id, station_id, expires_at, invalidated_at, consumed_at")
      .eq("token", token)
      .maybeSingle<AuditStationQrTokenRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? auditQrFromRow(data) : null;
  }

  async hasDelegateStamp(delegateId: string, stationId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("delegate_station_stamps")
      .select("id")
      .eq("delegate_id", delegateId)
      .eq("station_id", stationId)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new Error(error.message);
    }

    return Boolean(data);
  }

  async createDelegateStamp(delegateId: string, stationId: string, collectedAt: string, qrTokenId?: string): Promise<DelegateStationStamp> {
    const { data, error } = await this.supabase
      .from("delegate_station_stamps")
      .insert({ delegate_id: delegateId, station_id: stationId, collected_at: collectedAt, qr_token_id: qrTokenId })
      .select("id, delegate_id, station_id, collected_at")
      .single<DelegateStationStampRow>();

    if (error) {
      throw new Error(error.message);
    }

    return stampFromRow(data);
  }

  async recordScanAuditLog(log: ScanAuditLogInput): Promise<void> {
    const { error } = await this.supabase.from("scan_audit_logs").insert({
      delegate_id: log.delegateId,
      station_id: log.stationId,
      qr_token_id: log.qrTokenId,
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
