import { randomUUID } from "node:crypto";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import { delegateFromRow, findValidDelegateSession as queryValidDelegateSession, type DelegateRow, type SessionDelegate, type ValidDelegateSession } from "@/lib/delegate-session";
import { normalizeRegistrationNumber } from "@/lib/shared/normalize";
import { isFinalSurveyStationName, sortStationsWithFinalSurveyLast } from "@/lib/shared/station";

export type Delegate = SessionDelegate;

export type DelegateSession = {
  id: string;
  delegateId: string;
  expiresAt: string;
};

export type ProgressStation = {
  id: string;
  name: string;
  completed: boolean;
  isFinalSurvey: boolean;
  locked: boolean;
  lockReason?: string;
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

export type FinalSurveyStatus = {
  submitted: boolean;
  eligible: boolean;
  eligibleAt: string | null;
};

export type DelegateFinalSurvey = FinalSurveyStatus & {
  available: boolean;
};

export type DelegateStore = {
  findDelegateByRegistrationNumber(registrationNumber: string): Promise<Delegate | null>;
  createDelegateSession(delegateId: string, expiresAt: string): Promise<DelegateSession>;
  findValidDelegateSession(sessionId: string, nowIso: string): Promise<ValidDelegateSession | null>;
  listActiveStations(): Promise<ActiveStation[]>;
  listDelegateStampStationIds(delegateId: string): Promise<string[]>;
  readFinalSurveyStatus(delegateId: string): Promise<FinalSurveyStatus>;
};

export type DelegateHomeResult =
  | { identified: false }
  | { identified: true; delegate: Delegate; progress: DelegateProgress; finalSurvey: DelegateFinalSurvey };

const DELEGATE_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function extractRegistrationNumberFromBadgePayload(payload: string) {
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

  return { ok: false, error: "Delegate account was not found." };
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

  const [activeStations, stampedStationIds, finalSurveyStatus] = await Promise.all([
    store.listActiveStations(),
    store.listDelegateStampStationIds(session.delegate.id),
    store.readFinalSurveyStatus(session.delegate.id),
  ]);
  const stampedStationIdSet = new Set(stampedStationIds);
  const displayStations = sortStationsWithFinalSurveyLast(activeStations);
  const finalSurveyStation = displayStations.find((station) => isFinalSurveyStationName(station.name));
  const prerequisiteStations = displayStations.filter((station) => !isFinalSurveyStationName(station.name));
  const finalSurveyUnlocked = prerequisiteStations.every((station) => stampedStationIdSet.has(station.id));
  const stations = displayStations.map((station) => {
    const isFinalSurvey = isFinalSurveyStationName(station.name);
    const completed = stampedStationIdSet.has(station.id);
    const locked = isFinalSurvey && !completed && !finalSurveyUnlocked;
    return {
      ...station,
      completed,
      isFinalSurvey,
      locked,
      lockReason: locked ? "Complete all other stations first, then scan the Final Survey station." : undefined,
    };
  });
  const completedCount = stations.filter((station) => station.completed).length;
  const totalRequired = stations.length;
  const remainingCount = totalRequired - completedCount;
  const finalSurveyCompleted = finalSurveyStation ? stampedStationIdSet.has(finalSurveyStation.id) : false;
  const readyForFinalSurvey = Boolean(finalSurveyStation) && finalSurveyUnlocked;

  return {
    identified: true,
    delegate: session.delegate,
    progress: {
      stations,
      completedCount,
      totalRequired,
      remainingCount,
      readyForFinalSurvey,
    },
    finalSurvey: {
      available: readyForFinalSurvey && !finalSurveyCompleted && !finalSurveyStatus.submitted && !finalSurveyStatus.eligible,
      submitted: finalSurveyStatus.submitted,
      eligible: finalSurveyStatus.eligible,
      eligibleAt: finalSurveyStatus.eligibleAt,
    },
  };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type ActiveStationRow = {
  id: string;
  name: string;
};

type DelegateStampRow = {
  station_id: string;
};

type DelegateWithEligibilityRow = DelegateRow & {
  eligible_at?: string | null;
  draw_status?: string | null;
};

export class SupabaseDelegateStore implements DelegateStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  async findDelegateByRegistrationNumber(registrationNumber: string): Promise<Delegate | null> {
    const { data, error } = await this.supabase
      .from("delegates")
      .select("id, registration_number, full_name, title")
      .eq("registration_number", registrationNumber)
      .maybeSingle<DelegateRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? delegateFromRow(data) : null;
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
    return queryValidDelegateSession(this.supabase, sessionId, nowIso);
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

  async readFinalSurveyStatus(delegateId: string): Promise<FinalSurveyStatus> {
    const delegateResult = await this.supabase
      .from("delegates")
      .select("id, registration_number, full_name, eligible_at, draw_status")
      .eq("id", delegateId)
      .single<DelegateWithEligibilityRow>();

    if (delegateResult.error) {
      throw new Error(delegateResult.error.message);
    }

    const drawStatus = delegateResult.data.draw_status;
    const eligibleAt = delegateResult.data.eligible_at ?? null;
    let eligible: boolean;
    if (drawStatus === "eligible") {
      eligible = true;
    } else if (drawStatus === "excluded") {
      eligible = false;
    } else {
      // Eligibility is written when the Final Survey station is stamped. Do
      // not re-count stations here: the home page already has the current
      // station progress, avoiding extra queries under event traffic.
      eligible = Boolean(eligibleAt);
    }

    return {
      // The form-based survey was retired. Completion is now represented by a
      // Final Survey station stamp and eligibility timestamp.
      submitted: false,
      eligible,
      eligibleAt,
    };
  }
}
