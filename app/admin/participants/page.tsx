import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import {
  updateDelegateNameAction,
  setDelegateDrawStatusAction,
} from "@/app/admin/actions";
import type { DelegateDrawStatus } from "@/lib/admin/participants";
import { AdminCard, EmptyState, Pagination } from "@/app/admin/ui";
import { IconUsers, IconSearch, IconFilter, IconCheck, IconX, IconPencil, IconList } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";

const PAGE_SIZE = 20;

const DRAW_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  eligible: { label: "Eligible", cls: "badge-success" },
  manual_include: { label: "Manual include", cls: "badge-info" },
  winner: { label: "Winner", cls: "badge-accent" },
  disqualified: { label: "Disqualified", cls: "badge-danger" },
  not_eligible: { label: "Not eligible", cls: "badge-neutral" },
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "eligible", label: "Eligible" },
  { value: "manual_include", label: "Manual include" },
  { value: "winner", label: "Winner" },
  { value: "disqualified", label: "Disqualified" },
  { value: "not_eligible", label: "Not eligible" },
];

const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "reg", label: "Registration #" },
  { value: "stamps", label: "Most stamps" },
  { value: "status", label: "Draw status" },
];

const STATUS_ORDER: DelegateDrawStatus[] = ["winner", "eligible", "manual_include", "disqualified", "not_eligible"];

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; sort?: string; page?: string }>;
}) {
  const cookieStore = await cookies();
  const params = await searchParams;
  const dashboard = await getAdminDashboard({
    store: new SupabaseDashboardStore(),
    sessionId: cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  });
  if (!dashboard.authorized) redirect("/admin?error=login-required");

  const q = (params?.q ?? "").trim().toLowerCase();
  const status = params?.status ?? "all";
  const sort = params?.sort ?? "name";
  const page = Math.max(1, Number(params?.page ?? "1") || 1);

  let rows = dashboard.participants;
  if (q) {
    rows = rows.filter(
      (p) => p.fullName.toLowerCase().includes(q) || p.registrationNumber.toLowerCase().includes(q),
    );
  }
  if (status && status !== "all") {
    rows = rows.filter((p) => p.drawStatus === status);
  }

  rows = [...rows].sort((a, b) => {
    switch (sort) {
      case "reg":
        return a.registrationNumber.localeCompare(b.registrationNumber);
      case "stamps":
        return b.stampsCollected - a.stampsCollected;
      case "status":
        return STATUS_ORDER.indexOf(a.drawStatus as DelegateDrawStatus) - STATUS_ORDER.indexOf(b.drawStatus as DelegateDrawStatus);
      default:
        return a.fullName.localeCompare(b.fullName);
    }
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Preserve the current filters+page so an action returns the organizer here.
  const redirectQuery = new URLSearchParams();
  if (q) redirectQuery.set("q", q);
  if (status && status !== "all") redirectQuery.set("status", status);
  if (sort && sort !== "name") redirectQuery.set("sort", sort);
  redirectQuery.set("page", String(safePage));
  const redirectTo = `/admin/participants?${redirectQuery.toString()}`;

  const filterParams: Record<string, string> = {};
  if (q) filterParams.q = q;
  if (status && status !== "all") filterParams.status = status;
  if (sort && sort !== "name") filterParams.sort = sort;

  return (
    <div className="module-grid">
      <AdminCard
        icon={IconUsers}
        eyebrow="Manage"
        title="Participants"
        action={<span className="badge badge-neutral">{total}</span>}
      >
        <form method="get" action="/admin/participants" className="toolbar">
          <div className="search-box">
            <IconSearch size={18} />
            <input
              type="search"
              name="q"
              className="input"
              placeholder="Search name or registration #"
              defaultValue={q}
              aria-label="Search participants"
            />
          </div>
          <div className="field" style={{ flex: "0 1 190px" }}>
            <label className="field-label" htmlFor="status">
              <IconFilter size={14} /> Status
            </label>
            <select id="status" name="status" className="select" defaultValue={status}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "0 1 180px" }}>
            <label className="field-label" htmlFor="sort">
              Sort
            </label>
            <select id="sort" name="sort" className="select" defaultValue={sort}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <PendingSubmitButton className="btn btn-primary" pendingLabel="Applying…">
            Apply
          </PendingSubmitButton>
          <Link href="/admin/participants" className="icon-btn">
            Clear
          </Link>
        </form>

        {pageRows.length === 0 ? (
          <EmptyState
            icon={IconList}
            title={total === 0 ? "No participants yet" : "No matches"}
            hint={total === 0 ? "Delegates appear here once they register." : "Try a different search or filter."}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th className="hide-sm">Progress</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((p) => {
                    const badge = DRAW_STATUS_BADGE[p.drawStatus as DelegateDrawStatus] ?? DRAW_STATUS_BADGE.not_eligible;
                    const initials = p.fullName
                      .split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="participant-name">
                            <span className="participant-avatar" aria-hidden="true">
                              {initials || "?"}
                            </span>
                            <span>
                              <span className="cell-strong">{p.fullName}</span>
                              <br />
                              <span className="cell-sub">#{p.registrationNumber}</span>
                            </span>
                          </div>
                        </td>
                        <td className="hide-sm">
                          <span className="cell-strong">
                            {p.stampsCollected}/{p.totalActiveStations}
                          </span>{" "}
                          <span className="cell-sub">stamps</span>
                          <br />
                          <span className={`badge ${p.surveySubmitted ? "badge-success" : "badge-neutral"}`} style={{ marginTop: "0.25rem" }}>
                            {p.surveySubmitted ? "Survey done" : "No survey"}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <form action={setDelegateDrawStatusAction}>
                              <input type="hidden" name="delegateId" value={p.id} />
                              <input type="hidden" name="drawStatus" value="manual_include" />
                              <input type="hidden" name="redirectTo" value={redirectTo} />
                              <PendingSubmitButton className="icon-btn" title="Manually include in the draw" pendingLabel="Including…">
                                <IconCheck size={16} />
                                Include
                              </PendingSubmitButton>
                            </form>
                            <form action={setDelegateDrawStatusAction}>
                              <input type="hidden" name="delegateId" value={p.id} />
                              <input type="hidden" name="drawStatus" value="disqualified" />
                              <input type="hidden" name="redirectTo" value={redirectTo} />
                              <PendingSubmitButton className="icon-btn icon-btn--danger" title="Disqualify from the draw" pendingLabel="Disqualifying…">
                                <IconX size={16} />
                                Disqualify
                              </PendingSubmitButton>
                            </form>
                            <details className="disclosure" style={{ flex: "1 1 120px" }}>
                              <summary>
                                <IconPencil size={16} /> Rename
                              </summary>
                              <div className="disclosure-body">
                                <form action={updateDelegateNameAction} className="inline-form">
                                  <input type="hidden" name="delegateId" value={p.id} />
                                  <input type="hidden" name="redirectTo" value={redirectTo} />
                                  <div className="field">
                                    <label className="field-label" htmlFor={`rename-${p.id}`}>
                                      Full name
                                    </label>
                                    <input id={`rename-${p.id}`} name="fullName" className="input" defaultValue={p.fullName} required />
                                  </div>
                                  <PendingSubmitButton className="btn btn-ghost btn-sm" pendingLabel="Saving…">
                                    Save name
                                  </PendingSubmitButton>
                                </form>
                              </div>
                            </details>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination basePath="/admin/participants" params={filterParams} page={safePage} pageSize={PAGE_SIZE} total={total} />
          </>
        )}
      </AdminCard>
    </div>
  );
}
