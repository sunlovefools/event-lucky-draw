import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { AdminDashboard } from "@/app/admin/admin-dashboard";
import { getAdminDashboard, SupabaseAdminStore } from "@/lib/admin";

function errorMessage(error?: string) {
  if (error === "invalid-login") {
    return "Invalid username or password.";
  }

  if (error === "login-required") {
    return "Admin login required.";
  }

  if (error === "station-invalid") {
    return "Station name is required.";
  }

  if (error === "vendor-invalid") {
    return "Vendor account needs a username, password, and exactly one station.";
  }

  return undefined;
}

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  const params = await searchParams;
  const dashboard = await getAdminDashboard({
    store: new SupabaseAdminStore(),
    sessionId: cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  });

  return <AdminDashboard dashboard={dashboard} error={errorMessage(params?.error)} />;
}
