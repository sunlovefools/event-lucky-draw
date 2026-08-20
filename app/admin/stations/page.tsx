import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { AdminCard, EmptyState } from "@/app/admin/ui";
import { IconStore, IconList, IconSearch } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";
import { CreateStationModal } from "@/app/admin/stations/create-station-modal";
import { ReorderStationsModal } from "@/app/admin/stations/reorder-stations-modal";
import { StationCard } from "@/app/admin/stations/station-card";
import { FinalSurveyStationLink } from "@/app/admin/stations/final-survey-station-link";
import { isFinalSurveyStationName } from "@/lib/shared/station";

export const dynamic = "force-dynamic";

type StationFilter = "all" | "active" | "inactive";

const FILTERS: Array<{ value: StationFilter; label: string }> = [
  { value: "all", label: "All exhibition stations" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
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

  const q = (params?.q ?? "").trim().toLowerCase();
  const requestedFilter = params?.filter ?? "all";
  const filter: StationFilter = FILTERS.some((item) => item.value === requestedFilter)
    ? (requestedFilter as StationFilter)
    : "all";

  const finalSurveyStation = dashboard.stations.find((station) => isFinalSurveyStationName(station.name));
  const exhibitionStations = dashboard.stations.filter((station) => !isFinalSurveyStationName(station.name));
  const totalStations = exhibitionStations.length;
  const activeStations = exhibitionStations.filter((station) => station.active);
  const activeStationCount = activeStations.length;

  const filteredStations = exhibitionStations.filter((station) => {
    const matchesSearch = !q || station.name.toLowerCase().includes(q);

    const matchesFilter =
      filter === "all" ||
      (filter === "active" && station.active) ||
      (filter === "inactive" && !station.active);

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
      <AdminCard
        icon={IconStore}
        eyebrow="Manage"
        title="Exhibition stations"
      >
        <div className="stations-heading">
          <div>
            <p className="stations-intro">
              Create and manage exhibition stations. Each station is accessible directly from its station link; no password is required.
            </p>
          </div>
          <span className="badge badge-neutral">{totalStations} total</span>
        </div>

        <FinalSurveyStationLink stationName={finalSurveyStation?.name} />

        <section className="stations-stats" aria-label="Station summary">
          <article className="station-stat">
            <span className="station-stat__icon" aria-hidden="true">
              <IconStore size={20} />
            </span>
            <div>
              <strong>{totalStations}</strong>
              <span>Total exhibition stations</span>
            </div>
          </article>

          <article className="station-stat">
            <span className="station-stat__dot station-stat__dot--active" aria-hidden="true" />
            <div>
              <strong>{activeStationCount}</strong>
              <span>Active</span>
            </div>
          </article>

        </section>

        <section className="stations-list-section">
          <div className="stations-list-heading">
            <div>
              <h2>Exhibition station directory</h2>
              <p className="muted">
                {filteredStations.length === totalStations
                  ? `${totalStations} stations`
                  : `${filteredStations.length} of ${totalStations} stations`}
              </p>
            </div>
            <div className="stations-list-actions">
              {activeStations.length > 1 && (
                <ReorderStationsModal
                  activeStations={activeStations}
                  redirectTo={redirectTo}
                />
              )}
              <CreateStationModal redirectTo={redirectTo} />
            </div>
          </div>

          <form method="get" action="/admin/stations" className="stations-toolbar">
            <div className="search-box stations-search">
              <IconSearch size={18} />
              <input
                type="search"
                name="q"
                className="input"
                placeholder="Search exhibition station name"
                defaultValue={q}
                aria-label="Search exhibition stations"
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
                  ? "Use Add Station to create your first booth."
                  : "Try another search term or change the filter."
              }
            />
          ) : (
            <div className="station-cards">
              {filteredStations.map((station, index) => (
                <StationCard
                  key={station.id}
                  station={station}
                  index={index}
                  redirectTo={redirectTo}
                />
              ))}
            </div>
          )}
        </section>


      </AdminCard>
    </div>
  );
}
