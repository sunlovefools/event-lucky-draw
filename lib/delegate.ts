import { randomUUID } from "node:crypto";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import { delegateFromRow, findValidDelegateSession as queryValidDelegateSession, type DelegateRow, type SessionDelegate, type ValidDelegateSession } from "@/lib/delegate-session";
import { readParticipationOpen as queryParticipationOpen } from "@/lib/participation";
import { normalizeFullName, normalizeRegistrationNumber } from "@/lib/shared/normalize";

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
  createDelegate(delegate: { registrationNumber: string; fullName: string }): Promise<Delegate>;
  createDelegateSession(delegateId: string, expiresAt: string): Promise<DelegateSession>;
  findValidDelegateSession(sessionId: string, nowIso: string): Promise<ValidDelegateSession | null>;
  readParticipationOpen(): Promise<boolean>;
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

  const [activeStations, stampedStationIds, finalSurveyStatus] = await Promise.all([
    store.listActiveStations(),
    store.listDelegateStampStationIds(session.delegate.id),
    store.readFinalSurveyStatus(session.delegate.id),
  ]);
  const stampedStationIdSet = new Set(stampedStationIds);
  const stations = activeStations.map((station) => ({
    ...station,
    completed: stampedStationIdSet.has(station.id),
  }));
  const completedCount = stations.filter((station) => station.completed).length;
  const totalRequired = stations.length;
  const remainingCount = totalRequired - completedCount;
  const readyForFinalSurvey = remainingCount === 0;

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
      available: readyForFinalSurvey && !finalSurveyStatus.submitted,
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

type FinalSurveyResponseRow = {
  id: string;
};

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
    return queryValidDelegateSession(this.supabase, sessionId, nowIso);
  }

  async readParticipationOpen(): Promise<boolean> {
    return queryParticipationOpen(this.supabase);
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
    const [delegateResult, surveyResult] = await Promise.all([
      this.supabase
        .from("delegates")
        .select("id, registration_number, full_name, eligible_at, draw_status")
        .eq("id", delegateId)
        .single<DelegateWithEligibilityRow>(),
      this.supabase
        .from("final_survey_responses")
        .select("id")
        .eq("delegate_id", delegateId)
        .maybeSingle<FinalSurveyResponseRow>(),
    ]);

    if (delegateResult.error) {
      throw new Error(delegateResult.error.message);
    }

    if (surveyResult.error) {
      throw new Error(surveyResult.error.message);
    }

    return {
      submitted: Boolean(surveyResult.data),
      eligible: delegateResult.data.draw_status === "eligible" || Boolean(delegateResult.data.eligible_at),
      eligibleAt: delegateResult.data.eligible_at ?? null,
    };
  }
}
