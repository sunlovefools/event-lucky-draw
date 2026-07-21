import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { getHealthStatus } from "@/lib/health";
import { adminErrorMessage } from "@/app/admin/errors";
import { AdminOverview } from "@/app/admin/overview";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const params = await searchParams;
  const dashboard = await getAdminDashboard({
    store: new SupabaseDashboardStore(),
    sessionId: cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  });

  if (!dashboard.authorized) {
    redirect("/admin?error=login-required");
  }

  return <AdminOverview dashboard={dashboard} error={adminErrorMessage(params?.error)} health={await getHealthStatus()} />;
}
