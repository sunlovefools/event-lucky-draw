"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DELEGATE_SESSION_COOKIE } from "@/app/delegate/session";
import { submitFinalSurvey, SupabaseFinalSurveyStore } from "@/lib/final-survey";
import { SupabaseDelegateSessionStore } from "@/lib/delegate-session";

export async function submitFinalSurveyAction(formData: FormData) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(DELEGATE_SESSION_COOKIE)?.value;
  const session = sessionId
    ? await new SupabaseDelegateSessionStore().findValidDelegateSession(sessionId, new Date().toISOString())
    : null;

  if (!session) {
    redirect("/?error=survey-invalid");
  }

  const result = await submitFinalSurvey({
    store: new SupabaseFinalSurveyStore(),
    session,
    answers: {
      satisfaction: String(formData.get("satisfaction") ?? ""),
      favoriteStation: String(formData.get("favoriteStation") ?? ""),
      feedback: String(formData.get("feedback") ?? ""),
    },
  });

  if (!result.ok) {
    redirect("/?error=survey-invalid");
  }

  redirect("/");
}
