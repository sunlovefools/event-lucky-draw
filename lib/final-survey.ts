import { createSupabaseBrowserClient } from "@/lib/supabase";
import { type ValidDelegateSession } from "@/lib/delegate-session";
import { readParticipationOpen as queryParticipationOpen } from "@/lib/participation";

export type FinalSurveyAnswers = {
  satisfaction: string;
  favoriteStation: string;
  feedback: string;
};

export type FinalSurveyResponse = {
  id: string;
  delegateId: string;
  answers: FinalSurveyAnswers;
  submittedAt: string;
};

export type EligibleDelegate = {
  id: string;
  eligibleAt: string;
  drawStatus: "eligible" | string;
};

export type FinalSurveyStore = {
  readParticipationOpen(): Promise<boolean>;
  listActiveStationIds(): Promise<string[]>;
  listDelegateStampStationIds(delegateId: string): Promise<string[]>;
  findFinalSurveyResponse(delegateId: string): Promise<FinalSurveyResponse | null>;
  createFinalSurveyResponse(delegateId: string, answers: FinalSurveyAnswers, submittedAt: string): Promise<FinalSurveyResponse>;
  markDelegateEligible(delegateId: string, eligibleAt: string): Promise<EligibleDelegate>;
};

export type FinalSurveyResult =
  | {
      ok: true;
      delegate: { id: string; fullName: string; registrationNumber: string };
      eligibleAt: string;
      message: string;
    }
  | { ok: false; error: string };

function normalizeAnswers(answers: FinalSurveyAnswers): FinalSurveyAnswers {
  return {
    satisfaction: answers.satisfaction.trim(),
    favoriteStation: answers.favoriteStation.trim(),
    feedback: answers.feedback.trim(),
  };
}

export async function submitFinalSurvey({
  store,
  session,
  answers,
  now = () => new Date(),
}: {
  store: FinalSurveyStore;
  session: ValidDelegateSession;
  answers: FinalSurveyAnswers;
  now?: () => Date;
}): Promise<FinalSurveyResult> {
  const submittedAt = now().toISOString();

  const participationOpen = await store.readParticipationOpen();
  if (!participationOpen) {
    return { ok: false, error: "Participation is closed." };
  }

  const existingResponse = await store.findFinalSurveyResponse(session.delegate.id);
  if (existingResponse) {
    return { ok: false, error: "Final survey has already been submitted." };
  }

  const [activeStationIds, stampedStationIds] = await Promise.all([
    store.listActiveStationIds(),
    store.listDelegateStampStationIds(session.delegate.id),
  ]);
  const stampedStationSet = new Set(stampedStationIds);
  const complete = activeStationIds.every((stationId) => stampedStationSet.has(stationId));
  if (!complete) {
    return { ok: false, error: "Complete all active stations before submitting the final survey." };
  }

  const normalizedAnswers = normalizeAnswers(answers);
  if (!normalizedAnswers.satisfaction || !normalizedAnswers.favoriteStation) {
    return { ok: false, error: "Final survey answers are required." };
  }

  await store.createFinalSurveyResponse(session.delegate.id, normalizedAnswers, submittedAt);
  const eligible = await store.markDelegateEligible(session.delegate.id, submittedAt);

  return {
    ok: true,
    delegate: {
      id: session.delegate.id,
      fullName: session.delegate.fullName,
      registrationNumber: session.delegate.registrationNumber,
    },
    eligibleAt: eligible.eligibleAt,
    message: `${session.delegate.fullName} is entered into the lucky draw.`,
  };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type StationRow = {
  id: string;
};

type DelegateStampRow = {
  station_id: string;
};

type FinalSurveyResponseRow = {
  id: string;
  delegate_id: string;
  satisfaction: string;
  favorite_station: string;
  feedback: string;
  submitted_at: string;
};

function surveyResponseFromRow(row: FinalSurveyResponseRow): FinalSurveyResponse {
  return {
    id: row.id,
    delegateId: row.delegate_id,
    answers: { satisfaction: row.satisfaction, favoriteStation: row.favorite_station, feedback: row.feedback },
    submittedAt: row.submitted_at,
  };
}

export class SupabaseFinalSurveyStore implements FinalSurveyStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  async readParticipationOpen(): Promise<boolean> {
    return queryParticipationOpen(this.supabase);
  }

  async listActiveStationIds(): Promise<string[]> {
    const { data, error } = await this.supabase.from("stations").select("id").eq("active", true);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((station: StationRow) => station.id);
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

  async findFinalSurveyResponse(delegateId: string): Promise<FinalSurveyResponse | null> {
    const { data, error } = await this.supabase
      .from("final_survey_responses")
      .select("id, delegate_id, satisfaction, favorite_station, feedback, submitted_at")
      .eq("delegate_id", delegateId)
      .maybeSingle<FinalSurveyResponseRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? surveyResponseFromRow(data) : null;
  }

  async createFinalSurveyResponse(delegateId: string, answers: FinalSurveyAnswers, submittedAt: string): Promise<FinalSurveyResponse> {
    const { data, error } = await this.supabase
      .from("final_survey_responses")
      .insert({
        delegate_id: delegateId,
        satisfaction: answers.satisfaction,
        favorite_station: answers.favoriteStation,
        feedback: answers.feedback,
        submitted_at: submittedAt,
      })
      .select("id, delegate_id, satisfaction, favorite_station, feedback, submitted_at")
      .single<FinalSurveyResponseRow>();

    if (error) {
      throw new Error(error.message);
    }

    return surveyResponseFromRow(data);
  }

  async markDelegateEligible(delegateId: string, eligibleAt: string): Promise<EligibleDelegate> {
    const { data, error } = await this.supabase
      .from("delegates")
      .update({ eligible_at: eligibleAt, })
      .eq("id", delegateId)
      .select("id, eligible_at, draw_status")
      .single<{ id: string; eligible_at: string; draw_status: string }>();

    if (error) {
      throw new Error(error.message);
    }

    return { id: data.id, eligibleAt: data.eligible_at, drawStatus: data.draw_status };
  }
}
