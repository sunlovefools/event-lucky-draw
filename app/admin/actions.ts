"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { authenticateAdmin, setParticipationState, SupabaseAdminStore } from "@/lib/admin";
import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";

export async function loginAdminAction(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await authenticateAdmin({
    store: new SupabaseAdminStore(),
    username,
    password,
  });

  if (!result.ok) {
    redirect("/admin?error=invalid-login");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, result.session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(result.session.expiresAt),
    path: "/admin",
  });

  redirect("/admin");
}

export async function setParticipationAction(formData: FormData) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const open = formData.get("open") === "true";

  const result = await setParticipationState({
    store: new SupabaseAdminStore(),
    sessionId,
    open,
  });

  if (!result.ok) {
    redirect("/admin?error=login-required");
  }

  redirect("/admin");
}
