"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DELEGATE_SESSION_COOKIE } from "@/app/delegate/session";
import { submitFinalSurvey, SupabaseFinalSurveyStore } from "@/lib/final-survey";

export async function submitFinalSurveyAction(formData: FormData) {
  const cookieStore = await cookies();
  const result = await submitFinalSurvey({
    store: new SupabaseFinalSurveyStore(),
    sessionId: cookieStore.get(DELEGATE_SESSION_COOKIE)?.value,
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
