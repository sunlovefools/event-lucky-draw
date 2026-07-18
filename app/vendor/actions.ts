"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { VENDOR_SESSION_COOKIE } from "@/app/vendor/session";
import { authenticateVendor, generateStationQr, SupabaseVendorStore } from "@/lib/vendor";

async function currentVendorSessionId() {
  const cookieStore = await cookies();
  return cookieStore.get(VENDOR_SESSION_COOKIE)?.value;
}

export async function loginVendorAction(formData: FormData) {
  const result = await authenticateVendor({
    store: new SupabaseVendorStore(),
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    redirect("/vendor?error=invalid-login");
  }

  const cookieStore = await cookies();
  cookieStore.set(VENDOR_SESSION_COOKIE, result.session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(result.session.expiresAt),
    path: "/vendor",
  });

  redirect("/vendor");
}

export async function generateStationQrAction() {
  const result = await generateStationQr({
    store: new SupabaseVendorStore(),
    sessionId: await currentVendorSessionId(),
  });

  if (!result.ok) {
    const error = result.error === "Participation is closed." ? "participation-closed" : "login-required";
    redirect(`/vendor?error=${error}`);
  }

  redirect("/vendor");
}
