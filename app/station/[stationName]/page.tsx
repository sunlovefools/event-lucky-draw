import { VendorPortal } from "@/app/vendor/vendor-portal";
import { getStationDashboard, SupabaseVendorStore } from "@/lib/vendor/portal";

export const dynamic = "force-dynamic";

export default async function StationPage({
  params,
  searchParams,
}: {
  params: Promise<{ stationName: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const [{ stationName }, query] = await Promise.all([params, searchParams]);
  const dashboard = await getStationDashboard({
    store: new SupabaseVendorStore(),
    stationName,
  });

  return <VendorPortal dashboard={dashboard} error={query?.error} />;
}
