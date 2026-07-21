import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { drawLuckyWinner, SupabaseDrawStore } from "@/lib/admin/draw";
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

  const result = await drawLuckyWinner({
    store: new SupabaseDrawStore(),
    sessionId,
    now: () => new Date(),
    random: Math.random,
  });

  if (!result.ok) {
    return Response.json(result, {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }

  return Response.json(result, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
