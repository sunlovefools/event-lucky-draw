import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { AdminDrawScreen } from "@/app/admin/draw/admin-draw-display";
import { getPublicDrawState, SupabasePublicDrawStore } from "@/lib/public-draw";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { requireAdminSession, SupabaseAdminAuthStore } from "@/lib/auth/admin-auth";

export default async function AdminDrawPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await requireAdminSession({
    store: new SupabaseAdminAuthStore(),
    sessionId,
    nowIso: new Date().toISOString(),
  });
  if (!session) {
    redirect("/admin?error=login-required");
  }

  const [initialState, dashboard] = await Promise.all([
    getPublicDrawState({ store: new SupabasePublicDrawStore() }),
    getAdminDashboard({ store: new SupabaseDashboardStore(), sessionId }),
  ]);

  const currentRound = dashboard.authorized ? dashboard.drawRounds.find((r) => r.isCurrent) : null;
  const roundNumber = currentRound?.roundNumber ?? 1;

  return <AdminDrawScreen initialState={initialState} roundNumber={roundNumber} />;
}
