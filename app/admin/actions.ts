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
import { SupabaseVendorAuthStore } from "@/lib/auth/vendor-auth";
import {
  createParticipantAccount,
  importParticipantAccounts,
  updateDelegateName,
  setDelegateDrawStatus,
  SupabaseParticipantsStore,
} from "@/lib/admin/participants";
import { drawLuckyWinner, resetDrawRound, deleteDrawRound, SupabaseDrawStore } from "@/lib/admin/draw";
import { setParticipationState, SupabaseDashboardStore } from "@/lib/admin/dashboard";

// Resolves where an action should send the admin after succeeding. Any value
// that does not point inside /admin is ignored, so a tampered form cannot
// redirect the organizer off-site. Defaults to the overview.
function resolveRedirect(formData: FormData, fallback = "/admin"): string {
  const raw = String(formData.get("redirectTo") ?? "").trim();
  if (raw.startsWith("/admin") && !raw.startsWith("//")) {
    return raw;
  }
  return fallback;
}

function withQuery(target: string, params: Record<string, string | number>) {
  const url = new URL(target, "http://local");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}

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
    path: "/",
  });

  redirect("/admin");
}

export async function logoutAdminAction() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: ADMIN_SESSION_COOKIE, path: "/" });
  cookieStore.delete({ name: ADMIN_SESSION_COOKIE, path: "/admin" });
  redirect("/admin");
}

export async function setParticipationAction(formData: FormData) {
  const open = formData.get("open") === "true";
  const target = resolveRedirect(formData);

  const store = new SupabaseDashboardStore();
  const result = await withAdminSession(store, (sessionId) => setParticipationState({ store, sessionId, open }));

  if (!result.ok) {
    redirect(`/admin?error=login-required`);
  }

  redirect(target);
}

export async function editStationAction(formData: FormData) {
  const target = resolveRedirect(formData);
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

  redirect(target);
}

export async function editVendorAction(formData: FormData) {
  const target = resolveRedirect(formData);
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

  redirect(target);
}

export async function updateDelegateNameAction(formData: FormData) {
  const target = resolveRedirect(formData);
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

  redirect(target);
}

export async function createParticipantAction(formData: FormData) {
  const target = resolveRedirect(formData, "/admin/participants");
  const store = new SupabaseParticipantsStore();
  const result = await withAdminSession(store, (sessionId) =>
    createParticipantAccount({
      store,
      sessionId,
      registrationNumber: String(formData.get("registrationNumber") ?? ""),
      title: String(formData.get("title") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
    }),
  );

  if (!result.ok) {
    redirect(withQuery(target, { error: result.error === "Admin login required." ? "login-required" : "participant-invalid" }));
  }

  redirect(withQuery(target, { participantSaved: "1" }));
}

export async function importParticipantsAction(formData: FormData) {
  const target = resolveRedirect(formData, "/admin/participants");
  const store = new SupabaseParticipantsStore();
  const participantFile = formData.get("participantFile");
  const result = await withAdminSession(store, (sessionId) =>
    importParticipantAccounts({
      store,
      sessionId,
      file: participantFile instanceof File ? participantFile : null,
    }),
  );

  if (!result.ok) {
    redirect(withQuery(target, { error: result.error === "Admin login required." ? "login-required" : "participants-import-invalid" }));
  }

  redirect(withQuery(target, {
    importCreated: result.result.created,
    importUpdated: result.result.updated,
    importSkipped: result.result.skipped,
  }));
}

export async function drawLuckyWinnerAction(formData: FormData) {
  const target = resolveRedirect(formData);
  const store = new SupabaseDrawStore();
  const result = await withAdminSession(store, (sessionId) => drawLuckyWinner({ store, sessionId }));

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "draw-invalid"}`);
  }

  redirect(target);
}

export async function resetDrawRoundAction(formData: FormData) {
  const target = resolveRedirect(formData);
  const store = new SupabaseDrawStore();
  const result = await withAdminSession(store, (sessionId) => resetDrawRound({ store, sessionId }));

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "draw-invalid"}`);
  }

  redirect(target);
}

export async function deleteDrawRoundAction(formData: FormData) {
  const target = resolveRedirect(formData);
  const roundId = String(formData.get("roundId") ?? "");
  const store = new SupabaseDrawStore();
  const result = await withAdminSession(store, (sessionId) => deleteDrawRound({ store, sessionId, roundId }));

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "draw-invalid"}`);
  }

  redirect(target);
}

export async function setDelegateDrawStatusAction(formData: FormData) {
  const target = resolveRedirect(formData);
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

  redirect(target);
}

export async function createStationAction(formData: FormData) {
  const target = resolveRedirect(formData);
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

  redirect(target);
}

export async function createVendorAction(formData: FormData) {
  const target = resolveRedirect(formData);
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

  redirect(target);
}

export async function revokeVendorSessionAction(formData: FormData) {
  const target = resolveRedirect(formData, "/admin/vendors");
  const sessionId = String(formData.get("sessionId") ?? "");

  const cookieStore = await cookies();
  const adminSessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await requireAdminSession({
    store: new SupabaseAdminAuthStore(),
    sessionId: adminSessionId,
    nowIso: new Date().toISOString(),
  });
  if (!session) {
    redirect("/admin/vendors?error=login-required");
  }

  if (sessionId) {
    const vendorAuth = new SupabaseVendorAuthStore();
    await vendorAuth.revokeVendorSession(sessionId, new Date().toISOString());
  }

  redirect(target);
}
