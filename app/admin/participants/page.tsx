import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import {
  updateDelegateNameAction,
  setDelegateDrawStatusAction,
} from "@/app/admin/actions";
import type { AdminParticipant, DelegateDrawStatus } from "@/lib/admin/participants";
import { AdminCard, EmptyState, Pagination } from "@/app/admin/ui";
import {
  IconUsers,
  IconSearch,
  IconFilter,
  IconCheck,
  IconX,
  IconPencil,
  IconList,
  IconChevronDown,
} from "@/app/admin/icons";
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
  { value: "name", label: "Name (Aâ€“Z)" },
  { value: "reg", label: "Registration #" },
  { value: "stamps", label: "Most stamps" },
  { value: "status", label: "Draw status" },
];

const STATUS_ORDER: DelegateDrawStatus[] = [
  "winner",
  "eligible",
  "manual_include",
  "disqualified",
  "not_eligible",
];

function getParticipantInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getParticipantProgress(participant: AdminParticipant) {
  if (participant.totalActiveStations <= 0) return 0;
  return Math.min(
    100,
    Math.round((participant.stampsCollected / participant.totalActiveStations) * 100),
  );
}

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

  const allParticipants = dashboard.participants;
  let rows = allParticipants;

  if (q) {
    rows = rows.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.registrationNumber.toLowerCase().includes(q),
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
        return (
          STATUS_ORDER.indexOf(a.drawStatus as DelegateDrawStatus) -
          STATUS_ORDER.indexOf(b.drawStatus as DelegateDrawStatus)
        );
      default:
        return a.fullName.localeCompare(b.fullName);
    }
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const eligibleCount = allParticipants.filter((p) =>
    ["eligible", "manual_include"].includes(p.drawStatus),
  ).length;
  const completedCount = allParticipants.filter(
    (p) => p.totalActiveStations > 0 && p.stampsCollected >= p.totalActiveStations,
  ).length;
  const surveyCount = allParticipants.filter((p) => p.surveySubmitted).length;

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

  const hasActiveFilters = Boolean(q || status !== "all" || sort !== "name");

  return (
    <div className="module-grid participants-page">
      <AdminCard
        icon={IconUsers}
        eyebrow="Manage"
        title="Participants"
        action={<span className="badge badge-neutral">{allParticipants.length}</span>}
      >
        <div className="participant-summary" aria-label="Participant summary">
          <div className="summary-card">
            <span className="summary-label">Total participants</span>
            <strong>{allParticipants.length}</strong>
            <span className="summary-hint">Registered delegates</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Draw eligible</span>
            <strong>{eligibleCount}</strong>
            <span className="summary-hint">Eligible or included</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">All stamps</span>
            <strong>{completedCount}</strong>
            <span className="summary-hint">Completed station quest</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Survey completed</span>
            <strong>{surveyCount}</strong>
            <span className="summary-hint">Feedback submitted</span>
          </div>
        </div>

        <form method="get" action="/admin/participants" className="participant-toolbar">
          <div className="participant-search">
            <IconSearch size={19} />
            <input
              type="search"
              name="q"
              className="input"
              placeholder="Search participant or registration number"
              defaultValue={q}
              aria-label="Search participants"
            />
          </div>

          <div className="participant-filter-row">
            <div className="field participant-filter">
              <label className="field-label" htmlFor="status">
                <IconFilter size={14} /> Status
              </label>
              <select id="status" name="status" className="select" defaultValue={status}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field participant-filter">
              <label className="field-label" htmlFor="sort">
                Sort by
              </label>
              <select id="sort" name="sort" className="select" defaultValue={sort}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <PendingSubmitButton className="btn btn-primary participant-apply" pendingLabel="Applyingâ€¦">
              Apply filters
            </PendingSubmitButton>

            {hasActiveFilters && (
              <Link href="/admin/participants" className="btn btn-ghost participant-clear">
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="results-bar">
          <div>
            <strong>{total}</strong> {total === 1 ? "participant" : "participants"}
            {hasActiveFilters ? " found" : ""}
          </div>
          {hasActiveFilters && <span>Filters are active</span>}
        </div>

        {pageRows.length === 0 ? (
          <EmptyState
            icon={IconList}
            title={allParticipants.length === 0 ? "No participants yet" : "No matching participants"}
            hint={
              allParticipants.length === 0
                ? "Delegates will appear here once they register."
                : "Try another name, registration number, or status."
            }
          />
        ) : (
          <>
            <div className="table-wrap participant-table-wrap">
              <table className="dtable participant-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Quest progress</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((participant) => (
                    <ParticipantRow
                      key={participant.id}
                      participant={participant}
                      redirectTo={redirectTo}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              basePath="/admin/participants"
              params={filterParams}
              page={safePage}
              pageSize={PAGE_SIZE}
              total={total}
            />
          </>
        )}
      </AdminCard>


    </div>
  );
}

function ParticipantRow({
  participant,
  redirectTo,
}: {
  participant: AdminParticipant;
  redirectTo: string;
}) {
  const badge = DRAW_STATUS_BADGE[participant.drawStatus] ?? DRAW_STATUS_BADGE.not_eligible;
  const progress = getParticipantProgress(participant);

  return (
    <tr>
      <td>
        <div className="participant-identity">
          <span className="participant-avatar" aria-hidden="true">
            {getParticipantInitials(participant.fullName) || "?"}
          </span>
          <span className="participant-copy">
            <span className="cell-strong">{participant.fullName}</span>
            <span className="cell-sub">#{participant.registrationNumber}</span>
          </span>
        </div>
      </td>

      <td>
        <div className="progress-cell">
          <div className="progress-copy">
            <span>
              <strong>{participant.stampsCollected}</strong> / {participant.totalActiveStations} stamps
            </span>
            <span>{progress}%</span>
          </div>
          <div className="progress-track" aria-label={`${progress}% complete`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className={`survey-state ${participant.surveySubmitted ? "is-complete" : ""}`}>
            {participant.surveySubmitted ? "Survey completed" : "Survey pending"}
          </span>
        </div>
      </td>

      <td>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
      </td>

      <td>
        <ParticipantActions participant={participant} redirectTo={redirectTo} />
      </td>
    </tr>
  );
}

function ParticipantActions({
  participant,
  redirectTo,
}: {
  participant: AdminParticipant;
  redirectTo: string;
}) {
  const canInclude = participant.drawStatus !== "manual_include" && participant.drawStatus !== "winner";
  const canDisqualify = participant.drawStatus !== "disqualified" && participant.drawStatus !== "winner";

  return (
    <div className="participant-actions">
      <details className="action-menu">
        <summary aria-label={`Show actions for ${participant.fullName}`}>
          Actions
          <IconChevronDown size={15} />
        </summary>
        <div className="action-menu-panel">
          {canInclude && (
            <form action={setDelegateDrawStatusAction}>
              <input type="hidden" name="delegateId" value={participant.id} />
              <input type="hidden" name="drawStatus" value="manual_include" />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <PendingSubmitButton
                className="action-menu-item action-include"
                title="Manually include in the draw"
                pendingLabel="Including…"
              >
                <IconCheck size={16} />
                Include in draw
              </PendingSubmitButton>
            </form>
          )}

          {canDisqualify && (
            <form action={setDelegateDrawStatusAction}>
              <input type="hidden" name="delegateId" value={participant.id} />
              <input type="hidden" name="drawStatus" value="disqualified" />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <PendingSubmitButton
                className="action-menu-item action-menu-item--danger"
                title="Disqualify from the draw"
                pendingLabel="Disqualifying…"
              >
                <IconX size={16} />
                Disqualify
              </PendingSubmitButton>
            </form>
          )}

          <details className="rename-disclosure">
            <summary aria-label={`Rename ${participant.fullName}`}>
              <IconPencil size={16} />
              Rename
            </summary>
            <div className="rename-panel">
              <form action={updateDelegateNameAction} className="inline-form">
                <input type="hidden" name="delegateId" value={participant.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <div className="field">
                  <label className="field-label" htmlFor={`rename-${participant.id}`}>
                    Full name
                  </label>
                  <input
                    id={`rename-${participant.id}`}
                    name="fullName"
                    className="input"
                    defaultValue={participant.fullName}
                    required
                  />
                </div>
                <PendingSubmitButton className="btn btn-primary btn-sm" pendingLabel="Saving…">
                  Save name
                </PendingSubmitButton>
              </form>
            </div>
          </details>
        </div>
      </details>
    </div>
  );
}

