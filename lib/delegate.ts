import { randomUUID } from "node:crypto";

import { createSupabaseBrowserClient } from "@/lib/supabase";

export type Delegate = {
  id: string;
  registrationNumber: string;
  fullName: string;
};

export type DelegateSession = {
  id: string;
  delegateId: string;
  expiresAt: string;
};

export type ValidDelegateSession = {
  id: string;
  delegate: Delegate;
};

export type ProgressStation = {
  id: string;
  name: string;
  completed: boolean;
};

export type ActiveStation = {
  id: string;
  name: string;
};

export type DelegateProgress = {
  stations: ProgressStation[];
  completedCount: number;
  totalRequired: number;
  remainingCount: number;
  readyForFinalSurvey: boolean;
};

export type DelegateStore = {
  findDelegateByRegistrationNumber(registrationNumber: string): Promise<Delegate | null>;
  createDelegate(delegate: { registrationNumber: string; fullName: string }): Promise<Delegate>;
  createDelegateSession(delegateId: string, expiresAt: string): Promise<DelegateSession>;
  findValidDelegateSession(sessionId: string, nowIso: string): Promise<ValidDelegateSession | null>;
  readParticipationOpen(): Promise<boolean>;
  listActiveStations(): Promise<ActiveStation[]>;
  listDelegateStampStationIds(delegateId: string): Promise<string[]>;
};

export type DelegateHomeResult =
  | { identified: false }
  | { identified: true; delegate: Delegate; progress: DelegateProgress };

const DELEGATE_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeRegistrationNumber(registrationNumber: string) {
  return registrationNumber.trim();
}

function normalizeFullName(fullName: string) {
  return fullName.trim().replace(/\s+/g, " ");
}

function extractRegistrationNumberFromBadgePayload(payload: string) {
  const trimmed = payload.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    return normalizeRegistrationNumber(
      url.searchParams.get("registrationNumber") ??
        url.searchParams.get("registration_number") ??
        url.searchParams.get("reg") ??
        trimmed,
    );
  } catch {
    return normalizeRegistrationNumber(trimmed);
  }
}

async function createSessionForDelegate({
  store,
  delegate,
  now,
}: {
  store: DelegateStore;
  delegate: Delegate;
  now: () => Date;
}) {
  const expiresAt = new Date(now().getTime() + DELEGATE_SESSION_DURATION_MS).toISOString();
  return store.createDelegateSession(delegate.id, expiresAt);
}

export async function identifyDelegate({
  store,
  badgePayload,
  fullName,
  now,
}: {
  store: DelegateStore;
  badgePayload: string;
  fullName: string;
  now?: () => Date;
}) {
  return registerOrResumeDelegate({
    store,
    registrationNumber: extractRegistrationNumberFromBadgePayload(badgePayload),
    fullName,
    now,
  });
}

export async function registerOrResumeDelegate({
  store,
  registrationNumber,
  fullName,
  now = () => new Date(),
}: {
  store: DelegateStore;
  registrationNumber: string;
  fullName: string;
  now?: () => Date;
}): Promise<
  | { ok: true; delegate: Delegate; session: DelegateSession; resumed: boolean }
  | { ok: false; error: string }
> {
  const normalizedRegistrationNumber = normalizeRegistrationNumber(registrationNumber);
  if (!normalizedRegistrationNumber) {
    return { ok: false, error: "Registration number is required." };
  }

  const existingDelegate = await store.findDelegateByRegistrationNumber(normalizedRegistrationNumber);
  if (existingDelegate) {
    return {
      ok: true,
      delegate: existingDelegate,
      session: await createSessionForDelegate({ store, delegate: existingDelegate, now }),
      resumed: true,
    };
  }

  const normalizedFullName = normalizeFullName(fullName);
  if (!normalizedFullName) {
    return { ok: false, error: "Full name is required for first registration." };
  }

  const participationOpen = await store.readParticipationOpen();
  if (!participationOpen) {
    return { ok: false, error: "Registration is closed." };
  }

  const delegate = await store.createDelegate({
    registrationNumber: normalizedRegistrationNumber,
    fullName: normalizedFullName,
  });

  return {
    ok: true,
    delegate,
    session: await createSessionForDelegate({ store, delegate, now }),
    resumed: false,
  };
}

export async function getDelegateHome({
  store,
  sessionId,
  now = () => new Date(),
}: {
  store: DelegateStore;
  sessionId?: string | null;
  now?: () => Date;
}): Promise<DelegateHomeResult> {
  if (!sessionId) {
    return { identified: false };
  }

  const session = await store.findValidDelegateSession(sessionId, now().toISOString());
  if (!session) {
    return { identified: false };
  }

  const [activeStations, stampedStationIds] = await Promise.all([
    store.listActiveStations(),
    store.listDelegateStampStationIds(session.delegate.id),
  ]);
  const stampedStationIdSet = new Set(stampedStationIds);
  const stations = activeStations.map((station) => ({
    ...station,
    completed: stampedStationIdSet.has(station.id),
  }));
  const completedCount = stations.filter((station) => station.completed).length;
  const totalRequired = stations.length;
  const remainingCount = totalRequired - completedCount;

  return {
    identified: true,
    delegate: session.delegate,
    progress: {
      stations,
      completedCount,
      totalRequired,
      remainingCount,
      readyForFinalSurvey: remainingCount === 0,
    },
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
  delegate_id: string;
  expires_at: string;
  delegates?: DelegateRow | DelegateRow[] | null;
};

type EventSettingsRow = {
  participation_open: boolean;
};

type ActiveStationRow = {
  id: string;
  name: string;
};

type DelegateStampRow = {
  station_id: string;
};

function delegateFromRow(row: DelegateRow): Delegate {
  return { id: row.id, registrationNumber: row.registration_number, fullName: row.full_name };
}

export class SupabaseDelegateStore implements DelegateStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

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

  async createDelegate(delegate: { registrationNumber: string; fullName: string }): Promise<Delegate> {
    const { data, error } = await this.supabase
      .from("delegates")
      .insert({ registration_number: delegate.registrationNumber, full_name: delegate.fullName })
      .select("id, registration_number, full_name")
      .single<DelegateRow>();

    if (error) {
      throw new Error(error.message);
    }

    return delegateFromRow(data);
  }

  async createDelegateSession(delegateId: string, expiresAt: string): Promise<DelegateSession> {
    const id = randomUUID();
    const { data, error } = await this.supabase
      .from("delegate_sessions")
      .insert({ id, delegate_id: delegateId, expires_at: expiresAt })
      .select("id, delegate_id, expires_at")
      .single<{ id: string; delegate_id: string; expires_at: string }>();

    if (error) {
      throw new Error(error.message);
    }

    return { id: data.id, delegateId: data.delegate_id, expiresAt: data.expires_at };
  }

  async findValidDelegateSession(sessionId: string, nowIso: string): Promise<ValidDelegateSession | null> {
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

  async listActiveStations(): Promise<ActiveStation[]> {
    const { data, error } = await this.supabase
      .from("stations")
      .select("id, name")
      .eq("active", true)
      .order("name");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((station: ActiveStationRow) => ({ id: station.id, name: station.name }));
  }

  async listDelegateStampStationIds(delegateId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("delegate_station_stamps")
      .select("station_id")
      .eq("delegate_id", delegateId);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((stamp: DelegateStampRow) => stamp.station_id);
  }
}
