"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import {
  authenticateAdmin,
  requireAdminSession,
  type AdminSessionStore,
  SupabaseAdminAuthStore,
} from "@/lib/auth/admin-auth";
import { createStation, editStation, SupabaseStationsStore } from "@/lib/admin/stations";
import { createVendorAccount, editVendorAccount, SupabaseVendorsStore } from "@/lib/admin/vendors";
import { updateDelegateName, setDelegateDrawStatus, SupabaseParticipantsStore } from "@/lib/admin/participants";
import { drawLuckyWinner, SupabaseDrawStore } from "@/lib/admin/draw";
import { setParticipationState, SupabaseDashboardStore } from "@/lib/admin/dashboard";

async function currentAdminSessionId() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
}

// Resolves the admin session once and redirects to the login screen when it is
// missing, then runs the action with the resolved session id. Each action
// constructs the specific store it needs.
async function withAdminSession<T>(
  sessionStore: AdminSessionStore,
  run: (sessionId: string) => Promise<T>,
): Promise<T> {
  const sessionId = await currentAdminSessionId();
  const session = await requireAdminSession({ store: sessionStore, sessionId, nowIso: new Date().toISOString() });
  if (!session) {
    redirect("/admin?error=login-required");
  }

  return run(session.id);
}

export async function loginAdminAction(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await authenticateAdmin({
    store: new SupabaseAdminAuthStore(),
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
  const open = formData.get("open") === "true";

  const store = new SupabaseDashboardStore();
  const result = await withAdminSession(store, (sessionId) => setParticipationState({ store, sessionId, open }));

  if (!result.ok) {
    redirect("/admin?error=login-required");
  }

  redirect("/admin");
}

export async function createStationAction(formData: FormData) {
  const store = new SupabaseStationsStore();
  const result = await withAdminSession(store, (sessionId) =>
    createStation({
      store,
      sessionId,
      name: String(formData.get("name") ?? ""),
      active: formData.get("active") === "true",
    }),
  );

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "station-invalid"}`);
  }

  redirect("/admin");
}

export async function editStationAction(formData: FormData) {
  const store = new SupabaseStationsStore();
  const result = await withAdminSession(store, (sessionId) =>
    editStation({
      store,
      sessionId,
      stationId: String(formData.get("stationId") ?? ""),
      name: String(formData.get("name") ?? ""),
      active: formData.get("active") === "true",
    }),
  );

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "station-invalid"}`);
  }

  redirect("/admin");
}

export async function createVendorAction(formData: FormData) {
  const store = new SupabaseVendorsStore();
  const result = await withAdminSession(store, (sessionId) =>
    createVendorAccount({
      store,
      sessionId,
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
      stationId: String(formData.get("stationId") ?? ""),
      active: formData.get("active") === "true",
    }),
  );

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "vendor-invalid"}`);
  }

  redirect("/admin");
}

export async function editVendorAction(formData: FormData) {
  const store = new SupabaseVendorsStore();
  const result = await withAdminSession(store, (sessionId) =>
    editVendorAccount({
      store,
      sessionId,
      vendorId: String(formData.get("vendorId") ?? ""),
      username: String(formData.get("username") ?? ""),
      stationId: String(formData.get("stationId") ?? ""),
      active: formData.get("active") === "true",
    }),
  );

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "vendor-invalid"}`);
  }

  redirect("/admin");
}

export async function updateDelegateNameAction(formData: FormData) {
  const store = new SupabaseParticipantsStore();
  const result = await withAdminSession(store, (sessionId) =>
    updateDelegateName({
      store,
      sessionId,
      delegateId: String(formData.get("delegateId") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
    }),
  );

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "delegate-invalid"}`);
  }

  redirect("/admin");
}

export async function drawLuckyWinnerAction(formData: FormData) {
  const store = new SupabaseDrawStore();
  const result = await withAdminSession(store, (sessionId) =>
    drawLuckyWinner({
      store,
      sessionId,
      drawLabel: String(formData.get("drawLabel") ?? ""),
    }),
  );

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "draw-invalid"}`);
  }

  redirect("/admin");
}

export async function setDelegateDrawStatusAction(formData: FormData) {
  const store = new SupabaseParticipantsStore();
  const result = await withAdminSession(store, (sessionId) =>
    setDelegateDrawStatus({
      store,
      sessionId,
      delegateId: String(formData.get("delegateId") ?? ""),
      drawStatus: String(formData.get("drawStatus") ?? "not_eligible"),
    }),
  );

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "delegate-invalid"}`);
  }

  redirect("/admin");
}
