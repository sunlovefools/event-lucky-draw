import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { resetDrawRound, SupabaseDrawStore } from "@/lib/admin/draw";
import { requireAdminSession, SupabaseAdminAuthStore } from "@/lib/auth/admin-auth";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await requireAdminSession({
    store: new SupabaseAdminAuthStore(),
    sessionId,
    nowIso: new Date().toISOString(),
  });

  if (!session) {
    return Response.json({ ok: false, error: "Admin login required." }, { status: 401 });
  }

  const result = await resetDrawRound({
    store: new SupabaseDrawStore(),
    sessionId,
    now: () => new Date(),
  });

  return Response.json(result.ok ? { ok: true } : result, {
    status: result.ok ? 200 : 400,
    headers: { "cache-control": "no-store" },
  });
}
