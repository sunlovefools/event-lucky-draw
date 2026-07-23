import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { AdminCard, EmptyState } from "@/app/admin/ui";
import { IconReport, IconDownload, IconStore, IconList } from "@/app/admin/icons";

const EXPORTS = [
  { kind: "participants", label: "Participants / progress" },
  { kind: "station-completions", label: "Station completions" },
  { kind: "winner-history", label: "Winner history" },
  { kind: "scan-audit", label: "Scan audit logs" },
];

export default async function ReportsPage() {
  const cookieStore = await cookies();
  const dashboard = await getAdminDashboard({
    store: new SupabaseDashboardStore(),
    sessionId: cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  });
  if (!dashboard.authorized) redirect("/admin?error=login-required");

  const { stationSummaries } = dashboard;

  return (
    <div className="module-grid">
      <AdminCard icon={IconDownload} eyebrow="Export" title="CSV exports">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {EXPORTS.map((e) => (
            <a key={e.kind} href={`/admin/exports/${e.kind}`} className="btn btn-ghost btn-block">
              <IconDownload size={18} />
              {e.label}
            </a>
          ))}
        </div>
      </AdminCard>

      <AdminCard icon={IconStore} eyebrow="Progress" title="Station summary">
        {stationSummaries.length === 0 ? (
          <EmptyState icon={IconList} title="No station completions yet" hint="Completions appear as delegates scan stations." />
        ) : (
          <div className="table-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Status</th>
                  <th>Completions</th>
                </tr>
              </thead>
              <tbody>
                {stationSummaries.map((summary) => (
                  <tr key={summary.stationId}>
                    <td>{summary.stationName}</td>
                    <td>
                      <span className={`badge ${summary.active ? "badge-success" : "badge-neutral"}`}>
                        {summary.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td>{summary.completions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
