import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { createStationAction, editStationAction } from "@/app/admin/actions";
import { AdminCard, EmptyState } from "@/app/admin/ui";
import { IconPlus, IconStore, IconList, IconSearch } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";

export const dynamic = "force-dynamic";

type StationFilter = "all" | "active" | "inactive" | "linked" | "unlinked";

const FILTERS: Array<{ value: StationFilter; label: string }> = [
  { value: "all", label: "All stations" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "linked", label: "Linked to vendor" },
  { value: "unlinked", label: "Not linked" },
];

export default async function StationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; filter?: string }>;
}) {
  const cookieStore = await cookies();
  const params = await searchParams;

  const dashboard = await getAdminDashboard({
    store: new SupabaseDashboardStore(),
    sessionId: cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  });

  if (!dashboard.authorized) redirect("/admin?error=login-required");

  const linkedStationIds = new Set(dashboard.vendorAccounts.map((v) => v.stationId));
  const q = (params?.q ?? "").trim().toLowerCase();
  const requestedFilter = params?.filter ?? "all";
  const filter: StationFilter = FILTERS.some((item) => item.value === requestedFilter)
    ? (requestedFilter as StationFilter)
    : "all";

  const totalStations = dashboard.stations.length;
  const activeStations = dashboard.stations.filter((station) => station.active).length;
  const linkedStations = dashboard.stations.filter((station) => linkedStationIds.has(station.id)).length;
  const unlinkedStations = totalStations - linkedStations;

  const filteredStations = dashboard.stations.filter((station) => {
    const matchesSearch = !q || station.name.toLowerCase().includes(q);
    const linked = linkedStationIds.has(station.id);

    const matchesFilter =
      filter === "all" ||
      (filter === "active" && station.active) ||
      (filter === "inactive" && !station.active) ||
      (filter === "linked" && linked) ||
      (filter === "unlinked" && !linked);

    return matchesSearch && matchesFilter;
  });

  const redirectParams = new URLSearchParams();
  if (q) redirectParams.set("q", q);
  if (filter !== "all") redirectParams.set("filter", filter);
  const redirectTo = redirectParams.size
    ? `/admin/stations?${redirectParams.toString()}`
    : "/admin/stations";

  return (
    <div className="module-grid">
      <AdminCard icon={IconStore} eyebrow="Manage" title="Stations">
        <div className="stations-heading">
          <div>
            <p className="stations-intro">
              Create and manage event booths, control availability, and see which stations
              already have a vendor account.
            </p>
          </div>
          <span className="badge badge-neutral">{totalStations} total</span>
        </div>

        <section className="stations-stats" aria-label="Station summary">
          <article className="station-stat">
            <span className="station-stat__icon" aria-hidden="true">
              <IconStore size={20} />
            </span>
            <div>
              <strong>{totalStations}</strong>
              <span>Total stations</span>
            </div>
          </article>

          <article className="station-stat">
            <span className="station-stat__dot station-stat__dot--active" aria-hidden="true" />
            <div>
              <strong>{activeStations}</strong>
              <span>Active</span>
            </div>
          </article>

          <article className="station-stat">
            <span className="station-stat__dot station-stat__dot--linked" aria-hidden="true" />
            <div>
              <strong>{linkedStations}</strong>
              <span>Vendor linked</span>
            </div>
          </article>

          <article className="station-stat">
            <span className="station-stat__dot station-stat__dot--unlinked" aria-hidden="true" />
            <div>
              <strong>{unlinkedStations}</strong>
              <span>Need vendor</span>
            </div>
          </article>
        </section>

        <details className="station-create" open={totalStations === 0}>
          <summary>
            <span className="station-create__summary-icon" aria-hidden="true">
              <IconPlus size={18} />
            </span>
            <span>
              <strong>Add a new station</strong>
              <small>Create another booth or activity point</small>
            </span>
            <span className="station-create__summary-action">Add station</span>
          </summary>

          <form action={createStationAction} className="station-create__form">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <div className="field station-create__name">
              <label className="field-label" htmlFor="station-name">
                Station name
              </label>
              <input
                id="station-name"
                name="name"
                className="input"
                placeholder="e.g. Main stage, Booth A or Registration"
                autoComplete="off"
                required
              />
              <p className="hint">
                Use a name that participants and vendors can recognise immediately.
              </p>
            </div>

            <label className="station-toggle">
              <input type="checkbox" name="active" value="true" defaultChecked />
              <span className="station-toggle__track" aria-hidden="true">
                <span />
              </span>
              <span>
                <strong>Active immediately</strong>
                <small>Participants can collect a stamp at this station.</small>
              </span>
            </label>

            <PendingSubmitButton
              className="btn btn-primary station-create__button"
              pendingLabel="Creating…"
            >
              <IconPlus size={17} />
              Create station
            </PendingSubmitButton>
          </form>
        </details>

        <section className="stations-list-section">
          <div className="stations-list-heading">
            <div>
              <h2>Station directory</h2>
              <p className="muted">
                {filteredStations.length === totalStations
                  ? `${totalStations} stations`
                  : `${filteredStations.length} of ${totalStations} stations`}
              </p>
            </div>
          </div>

          <form method="get" action="/admin/stations" className="stations-toolbar">
            <div className="search-box stations-search">
              <IconSearch size={18} />
              <input
                type="search"
                name="q"
                className="input"
                placeholder="Search station name"
                defaultValue={q}
                aria-label="Search stations"
              />
            </div>

            <div className="field stations-filter">
              <label className="field-label" htmlFor="station-filter">
                Show
              </label>
              <select
                id="station-filter"
                name="filter"
                className="select"
                defaultValue={filter}
              >
                {FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <PendingSubmitButton className="btn btn-primary" pendingLabel="Applying…">
              Apply
            </PendingSubmitButton>

            {(q || filter !== "all") && (
              <Link href="/admin/stations" className="icon-btn">
                Clear
              </Link>
            )}
          </form>

          {filteredStations.length === 0 ? (
            <EmptyState
              icon={IconList}
              title={totalStations === 0 ? "No stations yet" : "No matching stations"}
              hint={
                totalStations === 0
                  ? "Use the Add a new station panel above to create your first booth."
                  : "Try another search term or change the filter."
              }
            />
          ) : (
            <div className="station-cards">
              {filteredStations.map((station, index) => {
                const linked = linkedStationIds.has(station.id);

                return (
                  <article key={station.id} className="station-card">
                    <div className="station-card__number" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="station-card__content">
                      <div className="station-card__topline">
                        <div className="station-card__identity">
                          <span className="station-card__icon" aria-hidden="true">
                            <IconStore size={19} />
                          </span>
                          <div>
                            <strong>{station.name}</strong>
                            <span>Station</span>
                          </div>
                        </div>

                        <div className="station-card__badges">
                          <span
                            className={`badge ${
                              station.active ? "badge-success" : "badge-neutral"
                            }`}
                          >
                            <span className="station-status-dot" aria-hidden="true" />
                            {station.active ? "Active" : "Inactive"}
                          </span>
                          <span className={`badge ${linked ? "badge-info" : "badge-neutral"}`}>
                            {linked ? "Vendor linked" : "No vendor"}
                          </span>
                        </div>
                      </div>

                      <form action={editStationAction} className="station-card__form">
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <input type="hidden" name="stationId" value={station.id} />

                        <div className="field station-card__name-field">
                          <label className="field-label" htmlFor={`station-${station.id}`}>
                            Station name
                          </label>
                          <input
                            id={`station-${station.id}`}
                            name="name"
                            className="input"
                            defaultValue={station.name}
                            required
                          />
                        </div>

                        <label className="station-toggle station-toggle--compact">
                          <input
                            type="checkbox"
                            name="active"
                            value="true"
                            defaultChecked={station.active}
                          />
                          <span className="station-toggle__track" aria-hidden="true">
                            <span />
                          </span>
                          <span>
                            <strong>Active</strong>
                            <small>{station.active ? "Accepting stamps" : "Currently hidden"}</small>
                          </span>
                        </label>

                        <PendingSubmitButton
                          className="btn btn-primary station-card__save"
                          pendingLabel="Saving…"
                        >
                          Save changes
                        </PendingSubmitButton>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>


      </AdminCard>
    </div>
  );
}
