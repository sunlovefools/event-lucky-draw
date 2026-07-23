import "./admin.css";
import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { requireAdminSession, SupabaseAdminAuthStore } from "@/lib/auth/admin-auth";
import { adminErrorMessage } from "@/app/admin/errors";
import { AdminChrome } from "@/app/admin/admin-chrome";
import { LoginScreen } from "@/app/admin/login-screen";

export default async function AdminLayout(props: { children: React.ReactNode }) {
  const { children } = props;
  const searchParams = (props as unknown as { searchParams?: Promise<{ error?: string }> | undefined }).searchParams;
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  const session = sessionId
    ? await requireAdminSession({
        store: new SupabaseAdminAuthStore(),
        sessionId,
        nowIso: new Date().toISOString(),
      })
    : null;

  if (!session) {
    return <LoginScreen error={adminErrorMessage(params?.error)} />;
  }

  const dashboard = await getAdminDashboard({
    store: new SupabaseDashboardStore(),
    sessionId,
  });

  if (!dashboard.authorized) {
    return <LoginScreen error={adminErrorMessage("login-required")} />;
  }

  const counts = {
    participants: dashboard.participants.length,
    stations: dashboard.stations.length,
    scan: dashboard.scanAuditLogs.length,
    winners: dashboard.drawRounds.reduce((n, r) => n + r.winners.length, 0),
  };

  return (
    <AdminChrome admin={{ username: dashboard.admin.username }} participation={dashboard.participation} counts={counts}>
      {children}
    </AdminChrome>
  );
}
