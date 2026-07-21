"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DELEGATE_SESSION_COOKIE } from "@/app/delegate/session";
import { identifyDelegate, SupabaseDelegateStore } from "@/lib/delegate";

export async function identifyDelegateAction(formData: FormData) {
  const result = await identifyDelegate({
    store: new SupabaseDelegateStore(),
    badgePayload: String(formData.get("badgePayload") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
  });

  if (!result.ok) {
    const error = result.error === "Registration is closed." ? "registration-closed" : "delegate-invalid";
    redirect(`/?error=${error}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(DELEGATE_SESSION_COOKIE, result.session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(result.session.expiresAt),
    path: "/",
  });

  redirect("/");
}

export async function logoutDelegateAction() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: DELEGATE_SESSION_COOKIE, path: "/" });
  redirect("/");
}
