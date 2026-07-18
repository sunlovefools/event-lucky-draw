"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  authenticateAdmin,
  createStation,
  createVendorAccount,
  editStation,
  editVendorAccount,
  setDelegateDrawStatus,
  setParticipationState,
  SupabaseAdminStore,
  updateDelegateName,
} from "@/lib/admin";
import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";

async function currentAdminSessionId() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
}

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
  const open = formData.get("open") === "true";

  const result = await setParticipationState({
    store: new SupabaseAdminStore(),
    sessionId: await currentAdminSessionId(),
    open,
  });

  if (!result.ok) {
    redirect("/admin?error=login-required");
  }

  redirect("/admin");
}

export async function createStationAction(formData: FormData) {
  const result = await createStation({
    store: new SupabaseAdminStore(),
    sessionId: await currentAdminSessionId(),
    name: String(formData.get("name") ?? ""),
    active: formData.get("active") === "true",
  });

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "station-invalid"}`);
  }

  redirect("/admin");
}

export async function editStationAction(formData: FormData) {
  const result = await editStation({
    store: new SupabaseAdminStore(),
    sessionId: await currentAdminSessionId(),
    stationId: String(formData.get("stationId") ?? ""),
    name: String(formData.get("name") ?? ""),
    active: formData.get("active") === "true",
  });

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "station-invalid"}`);
  }

  redirect("/admin");
}

export async function createVendorAction(formData: FormData) {
  const result = await createVendorAccount({
    store: new SupabaseAdminStore(),
    sessionId: await currentAdminSessionId(),
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
    stationId: String(formData.get("stationId") ?? ""),
    active: formData.get("active") === "true",
  });

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "vendor-invalid"}`);
  }

  redirect("/admin");
}

export async function editVendorAction(formData: FormData) {
  const result = await editVendorAccount({
    store: new SupabaseAdminStore(),
    sessionId: await currentAdminSessionId(),
    vendorId: String(formData.get("vendorId") ?? ""),
    username: String(formData.get("username") ?? ""),
    stationId: String(formData.get("stationId") ?? ""),
    active: formData.get("active") === "true",
  });

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "vendor-invalid"}`);
  }

  redirect("/admin");
}

export async function updateDelegateNameAction(formData: FormData) {
  const result = await updateDelegateName({
    store: new SupabaseAdminStore(),
    sessionId: await currentAdminSessionId(),
    delegateId: String(formData.get("delegateId") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
  });

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "delegate-invalid"}`);
  }

  redirect("/admin");
}

export async function setDelegateDrawStatusAction(formData: FormData) {
  const result = await setDelegateDrawStatus({
    store: new SupabaseAdminStore(),
    sessionId: await currentAdminSessionId(),
    delegateId: String(formData.get("delegateId") ?? ""),
    drawStatus: String(formData.get("drawStatus") ?? "not_eligible"),
  });

  if (!result.ok) {
    redirect(`/admin?error=${result.error === "Admin login required." ? "login-required" : "delegate-invalid"}`);
  }

  redirect("/admin");
}
