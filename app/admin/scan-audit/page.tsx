import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { AdminCard, EmptyState, Pagination, formatTime } from "@/app/admin/ui";
import { IconScan, IconSearch, IconFilter, IconList } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";

const PAGE_SIZE = 25;

const RESULT_OPTIONS = [
  { value: "all", label: "All results" },
  { value: "success", label: "Success" },
  { value: "duplicate", label: "Duplicate" },
  { value: "failure", label: "Failure" },
];

function resultBadge(result: string) {
  if (result === "success") return "badge-success";
  if (result === "duplicate") return "badge-warn";
  return "badge-danger";
}

export default async function ScanAuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ result?: string; station?: string; page?: string }>;
}) {
  const cookieStore = await cookies();
  const params = await searchParams;
  const dashboard = await getAdminDashboard({
    store: new SupabaseDashboardStore(),
    sessionId: cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  });
  if (!dashboard.authorized) redirect("/admin?error=login-required");

  const result = params?.result ?? "all";
  const station = params?.station ?? "all";
  const page = Math.max(1, Number(params?.page ?? "1") || 1);

  let rows = [...dashboard.scanAuditLogs].sort((a, b) => (a.scannedAt < b.scannedAt ? 1 : -1));
  if (result && result !== "all") rows = rows.filter((r) => r.result === result);
  if (station && station !== "all") rows = rows.filter((r) => r.stationId === station);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const filterParams: Record<string, string> = {};
  if (result && result !== "all") filterParams.result = result;
  if (station && station !== "all") filterParams.station = station;

  return (
    <div className="module-grid">
      <AdminCard
        icon={IconScan}
        eyebrow="Activity"
        title="Scan audit log"
        action={<span className="badge badge-neutral">{total}</span>}
      >
        <form method="get" action="/admin/scan-audit" className="toolbar">
          <div className="field" style={{ flex: "0 1 200px" }}>
            <label className="field-label" htmlFor="result">
              <IconFilter size={14} /> Result
            </label>
            <select id="result" name="result" className="select" defaultValue={result}>
              {RESULT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "0 1 200px" }}>
            <label className="field-label" htmlFor="station">
              Station
            </label>
            <select id="station" name="station" className="select" defaultValue={station}>
              <option value="all">All stations</option>
              {dashboard.stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <PendingSubmitButton className="btn btn-primary" pendingLabel="Applying…">
            Apply
          </PendingSubmitButton>
          <Link href="/admin/scan-audit" className="icon-btn">
            Clear
          </Link>
        </form>

        {pageRows.length === 0 ? (
          <EmptyState icon={IconList} title={total === 0 ? "No scan attempts yet" : "No matches"} hint="Badge scans appear here in real time." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Delegate</th>
                    <th>Station</th>
                    <th>Scanned</th>
                    <th>Result</th>
                    <th>Consumed</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <span className="cell-strong">{entry.delegateFullName ?? "Unknown"}</span>
                      </td>
                      <td>{entry.stationName ?? "Unknown"}</td>
                      <td className="nowrap">{formatTime(entry.scannedAt)}</td>
                      <td>
                        <span className={`badge ${resultBadge(entry.result)}`}>{entry.result}</span>
                      </td>
                      <td>{entry.consumed ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination basePath="/admin/scan-audit" params={filterParams} page={safePage} pageSize={PAGE_SIZE} total={total} />
          </>
        )}
      </AdminCard>
    </div>
  );
}
