import { createSupabaseBrowserClient } from "@/lib/supabase";

export type StampDelegate = {
  id: string;
  registrationNumber: string;
  fullName: string;
};

export type ValidStampDelegateSession = {
  id: string;
  delegate: StampDelegate;
};

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

export type StampCollectionStore = {
  findValidDelegateSession(sessionId: string, nowIso: string): Promise<ValidStampDelegateSession | null>;
  readParticipationOpen(): Promise<boolean>;
  consumeStationQrToken(token: string, consumedAt: string): Promise<ConsumedStationQr | null>;
  hasDelegateStamp(delegateId: string, stationId: string): Promise<boolean>;
  createDelegateStamp(delegateId: string, stationId: string, collectedAt: string): Promise<DelegateStationStamp>;
};

export type StampCollectionResult =
  | { ok: true; station: { id: string; name: string }; duplicate: boolean; message: string }
  | { ok: false; error: string };

const INVALID_QR_ERROR = "This station QR is expired, used, or invalid. Please ask the station staff for a new QR.";

export async function collectStationStamp({
  store,
  sessionId,
  token,
  now = () => new Date(),
}: {
  store: StampCollectionStore;
  sessionId?: string | null;
  token: string;
  now?: () => Date;
}): Promise<StampCollectionResult> {
  const collectedAt = now().toISOString();
  if (!sessionId) {
    return { ok: false, error: "Delegate registration required." };
  }

  const session = await store.findValidDelegateSession(sessionId, collectedAt);
  if (!session) {
    return { ok: false, error: "Delegate registration required." };
  }

  const participationOpen = await store.readParticipationOpen();
  if (!participationOpen) {
    return { ok: false, error: "Participation is closed." };
  }

  const consumedQr = await store.consumeStationQrToken(token.trim(), collectedAt);
  if (!consumedQr) {
    return { ok: false, error: INVALID_QR_ERROR };
  }

  const station = { id: consumedQr.stationId, name: consumedQr.stationName };
  const alreadyStamped = await store.hasDelegateStamp(session.delegate.id, consumedQr.stationId);
  if (alreadyStamped) {
    return {
      ok: true,
      station,
      duplicate: true,
      message: `${consumedQr.stationName} was already collected.`,
    };
  }

  await store.createDelegateStamp(session.delegate.id, consumedQr.stationId, collectedAt);

  return {
    ok: true,
    station,
    duplicate: false,
    message: `${consumedQr.stationName} stamp collected.`,
  };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type DelegateRow = {
  id: string;
  registration_number: string;
  full_name: string;
};

type DelegateSessionRow = {
  id: string;
  delegates?: DelegateRow | DelegateRow[] | null;
};

type EventSettingsRow = {
  participation_open: boolean;
};

type ConsumedStationQrRow = {
  id: string;
  token: string;
  station_id: string;
  station_name: string;
  consumed_at: string;
};

type DelegateStationStampRow = {
  id: string;
  delegate_id: string;
  station_id: string;
  collected_at: string;
};

function delegateFromRow(row: DelegateRow): StampDelegate {
  return { id: row.id, registrationNumber: row.registration_number, fullName: row.full_name };
}

function consumedQrFromRow(row: ConsumedStationQrRow): ConsumedStationQr {
  return {
    id: row.id,
    token: row.token,
    stationId: row.station_id,
    stationName: row.station_name,
    consumedAt: row.consumed_at,
  };
}

function stampFromRow(row: DelegateStationStampRow): DelegateStationStamp {
  return { id: row.id, delegateId: row.delegate_id, stationId: row.station_id, collectedAt: row.collected_at };
}

export class SupabaseStampCollectionStore implements StampCollectionStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  async findValidDelegateSession(sessionId: string, nowIso: string): Promise<ValidStampDelegateSession | null> {
    const { data, error } = await this.supabase
      .from("delegate_sessions")
      .select("id, delegates!inner(id, registration_number, full_name)")
      .eq("id", sessionId)
      .gt("expires_at", nowIso)
      .maybeSingle<DelegateSessionRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    const delegate = Array.isArray(data.delegates) ? data.delegates[0] : data.delegates;
    if (!delegate) {
      return null;
    }

    return { id: data.id, delegate: delegateFromRow(delegate) };
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

  async consumeStationQrToken(token: string, consumedAt: string): Promise<ConsumedStationQr | null> {
    const { data, error } = await this.supabase
      .rpc("consume_station_qr_token", { qr_token: token, consumed_at: consumedAt })
      .maybeSingle<ConsumedStationQrRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? consumedQrFromRow(data) : null;
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

  async createDelegateStamp(delegateId: string, stationId: string, collectedAt: string): Promise<DelegateStationStamp> {
    const { data, error } = await this.supabase
      .from("delegate_station_stamps")
      .insert({ delegate_id: delegateId, station_id: stationId, collected_at: collectedAt })
      .select("id, delegate_id, station_id, collected_at")
      .single<DelegateStationStampRow>();

    if (error) {
      throw new Error(error.message);
    }

    return stampFromRow(data);
  }
}
