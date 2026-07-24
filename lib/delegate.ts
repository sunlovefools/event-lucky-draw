import { randomUUID } from "node:crypto";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import { delegateFromRow, type DelegateRow, type SessionDelegate } from "@/lib/delegate-session";
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
  readDelegateHome(sessionId: string, nowIso: string): Promise<DelegateHomeSnapshot | null>;
};

export type DelegateHomeSnapshot = {
  delegate: Delegate;
  stations: Array<ActiveStation & { completed: boolean }>;
  finalSurveyStatus: FinalSurveyStatus;
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

  const snapshot = await store.readDelegateHome(sessionId, now().toISOString());
  if (!snapshot) {
    return { identified: false };
  }

  const activeStations = snapshot.stations.map(({ id, name }) => ({ id, name }));
  const stampedStationIdSet = new Set(snapshot.stations.filter((station) => station.completed).map((station) => station.id));
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
    delegate: snapshot.delegate,
    progress: {
      stations,
      completedCount,
      totalRequired,
      remainingCount,
      readyForFinalSurvey,
    },
    finalSurvey: {
      available: readyForFinalSurvey && !finalSurveyCompleted && !snapshot.finalSurveyStatus.submitted && !snapshot.finalSurveyStatus.eligible,
      submitted: snapshot.finalSurveyStatus.submitted,
      eligible: snapshot.finalSurveyStatus.eligible,
      eligibleAt: snapshot.finalSurveyStatus.eligibleAt,
    },
  };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type DelegateHomeProgressRow = {
  session_id: string;
  delegate_id: string;
  title: string | null;
  full_name: string;
  registration_number: string;
  eligible_at: string | null;
  draw_status: string;
  station_id: string | null;
  station_name: string | null;
  station_completed: boolean;
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

  async readDelegateHome(sessionId: string, _nowIso: string): Promise<DelegateHomeSnapshot | null> {
    const { data, error } = await this.supabase.rpc("delegate_home_progress", {
      p_session_id: sessionId,
    });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as DelegateHomeProgressRow[];
    const first = rows[0];
    if (!first) {
      return null;
    }

    const drawStatus = first.draw_status;
    const eligibleAt = first.eligible_at ?? null;
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
      delegate: delegateFromRow({
        id: first.delegate_id,
        registration_number: first.registration_number,
        title: first.title,
        full_name: first.full_name,
      }),
      stations: rows.flatMap((row) => row.station_id && row.station_name
        ? [{ id: row.station_id, name: row.station_name, completed: row.station_completed }]
        : []),
      finalSurveyStatus: {
        // The form-based survey was retired. Completion is represented by the
        // Final Survey station stamp and eligibility timestamp.
        submitted: false,
        eligible,
        eligibleAt,
      },
    };
  }
}
