import { cookies } from "next/headers";

import { VENDOR_SESSION_COOKIE } from "@/app/vendor/session";
import { VendorPortal } from "@/app/vendor/vendor-portal";
import { getVendorDashboard, SupabaseVendorStore } from "@/lib/vendor";

function errorMessage(error?: string) {
  if (error === "invalid-login") {
    return "Invalid username or password.";
  }

  if (error === "login-required") {
    return "Vendor login required.";
  }

  if (error === "participation-closed") {
    return "Participation is closed.";
  }

  return undefined;
}

export default async function VendorPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const [cookieStore, params] = await Promise.all([cookies(), searchParams]);
  const dashboard = await getVendorDashboard({
    store: new SupabaseVendorStore(),
    sessionId: cookieStore.get(VENDOR_SESSION_COOKIE)?.value,
  });

  return <VendorPortal dashboard={dashboard} error={errorMessage(params?.error)} />;
}
