import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { type VendorDeviceSession } from "@/lib/auth/vendor-auth";
import {
  createVendorAction,
  editVendorAction,
  revokeVendorSessionAction,
} from "@/app/admin/actions";
import { AdminCard, EmptyState, formatTime } from "@/app/admin/ui";
import {
  IconPlus,
  IconDevices,
  IconScan,
  IconIdCard,
  IconList,
  IconSearch,
  IconStore,
} from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";

export const dynamic = "force-dynamic";

type VendorFilter = "all" | "active" | "disabled" | "online" | "offline";

const FILTER_OPTIONS: Array<{ value: VendorFilter; label: string }> = [
  { value: "all", label: "All accounts" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
  { value: "online", label: "Signed in" },
  { value: "offline", label: "No active devices" },
];

function StationSelect({
  stations,
  value,
}: {
  stations: Array<{ id: string; name: string }>;
  value: string | null;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor="vendor-station">
        Assign station
      </label>
      <select
        id="vendor-station"
        name="stationId"
        className="select"
        required
        defaultValue={value ?? ""}
      >
        <option value="" disabled>
          Select a station…
        </option>
        {stations.map((station) => (
          <option key={station.id} value={station.id}>
            {station.name}
          </option>
        ))}
      </select>
      <p className="hint">
        Only unassigned stations are shown, keeping one vendor linked to one station.
      </p>
    </div>
  );
}

export default async function VendorsPage({
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

  const usedStationIds = new Set(dashboard.vendorAccounts.map((vendor) => vendor.stationId));
  const availableStations = dashboard.stations.filter(
    (station) => !usedStationIds.has(station.id),
  );

  const sessionsByVendor = new Map<string, VendorDeviceSession[]>();
  for (const session of dashboard.vendorSessions ?? []) {
    const sessions = sessionsByVendor.get(session.vendorId) ?? [];
    sessions.push(session);
    sessionsByVendor.set(session.vendorId, sessions);
  }

  const q = (params?.q ?? "").trim().toLowerCase();
  const requestedFilter = params?.filter ?? "all";
  const filter: VendorFilter = FILTER_OPTIONS.some(
    (option) => option.value === requestedFilter,
  )
    ? (requestedFilter as VendorFilter)
    : "all";

  const totalAccounts = dashboard.vendorAccounts.length;
  const activeAccounts = dashboard.vendorAccounts.filter((vendor) => vendor.active).length;
  const signedInAccounts = dashboard.vendorAccounts.filter(
    (vendor) => (sessionsByVendor.get(vendor.id)?.length ?? 0) > 0,
  ).length;
  const totalDevices = [...sessionsByVendor.values()].reduce(
    (total, sessions) => total + sessions.length,
    0,
  );

  const filteredVendors = dashboard.vendorAccounts.filter((vendor) => {
    const sessions = sessionsByVendor.get(vendor.id) ?? [];
    const matchesSearch =
      !q ||
      vendor.username.toLowerCase().includes(q) ||
      vendor.stationName.toLowerCase().includes(q);

    const matchesFilter =
      filter === "all" ||
      (filter === "active" && vendor.active) ||
      (filter === "disabled" && !vendor.active) ||
      (filter === "online" && sessions.length > 0) ||
      (filter === "offline" && sessions.length === 0);

    return matchesSearch && matchesFilter;
  });

  const redirectParams = new URLSearchParams();
  if (q) redirectParams.set("q", q);
  if (filter !== "all") redirectParams.set("filter", filter);

  const redirectTo = redirectParams.size
    ? `/admin/vendors?${redirectParams.toString()}`
    : "/admin/vendors";

  return (
    <div className="module-grid">
      <AdminCard icon={IconIdCard} eyebrow="Manage" title="Vendor accounts">
        <div className="vendor-heading">
          <p className="vendor-intro">
            Manage station login accounts, account availability, and every device currently
            signed in.
          </p>
          <span className="badge badge-neutral">{totalAccounts} total</span>
        </div>

        <section className="vendor-stats" aria-label="Vendor account summary">
          <article className="vendor-stat">
            <span className="vendor-stat__icon" aria-hidden="true">
              <IconIdCard size={20} />
            </span>
            <div>
              <strong>{totalAccounts}</strong>
              <span>Total accounts</span>
            </div>
          </article>

          <article className="vendor-stat">
            <span className="vendor-stat__dot vendor-stat__dot--active" aria-hidden="true" />
            <div>
              <strong>{activeAccounts}</strong>
              <span>Active accounts</span>
            </div>
          </article>

          <article className="vendor-stat">
            <span className="vendor-stat__dot vendor-stat__dot--online" aria-hidden="true" />
            <div>
              <strong>{signedInAccounts}</strong>
              <span>Signed in now</span>
            </div>
          </article>

          <article className="vendor-stat">
            <span className="vendor-stat__icon vendor-stat__icon--devices" aria-hidden="true">
              <IconDevices size={20} />
            </span>
            <div>
              <strong>{totalDevices}</strong>
              <span>Active devices</span>
            </div>
          </article>
        </section>

        <details className="vendor-create" open={totalAccounts === 0}>
          <summary>
            <span className="vendor-create__summary-icon" aria-hidden="true">
              <IconPlus size={18} />
            </span>
            <span>
              <strong>Create vendor account</strong>
              <small>Add login access for an available station</small>
            </span>
            <span className="vendor-create__summary-action">
              {availableStations.length > 0 ? "Add account" : "No station available"}
            </span>
          </summary>

          <div className="vendor-create__body">
            {availableStations.length === 0 ? (
              <EmptyState
                icon={IconList}
                title="No available stations"
                hint="Every station already has a vendor account. Create another station before adding a new vendor."
              />
            ) : (
              <form action={createVendorAction} className="vendor-create__form">
                <input type="hidden" name="redirectTo" value={redirectTo} />

                <div className="field">
                  <label className="field-label" htmlFor="vendor-username">
                    Username
                  </label>
                  <input
                    id="vendor-username"
                    name="username"
                    className="input"
                    placeholder="e.g. vendor01"
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="vendor-password">
                    Password
                  </label>
                  <input
                    id="vendor-password"
                    name="password"
                    type="password"
                    className="input"
                    placeholder="Create a strong password"
                    required
                  />
                </div>

                <StationSelect stations={availableStations} value={null} />

                <label className="vendor-toggle">
                  <input type="checkbox" name="active" value="true" defaultChecked />
                  <span className="vendor-toggle__track" aria-hidden="true">
                    <span />
                  </span>
                  <span>
                    <strong>Active immediately</strong>
                    <small>The vendor can sign in after the account is created.</small>
                  </span>
                </label>

                <PendingSubmitButton
                  className="btn btn-primary vendor-create__button"
                  pendingLabel="Creating…"
                >
                  <IconPlus size={17} />
                  Create account
                </PendingSubmitButton>
              </form>
            )}
          </div>
        </details>

        <section className="vendor-directory">
          <div className="vendor-directory__heading">
            <div>
              <h2>Vendor directory</h2>
              <p className="muted">
                {filteredVendors.length === totalAccounts
                  ? `${totalAccounts} accounts`
                  : `${filteredVendors.length} of ${totalAccounts} accounts`}
              </p>
            </div>
          </div>

          <form method="get" action="/admin/vendors" className="vendor-toolbar">
            <div className="search-box vendor-search">
              <IconSearch size={18} />
              <input
                type="search"
                name="q"
                className="input"
                placeholder="Search username or station"
                defaultValue={q}
                aria-label="Search vendor accounts"
              />
            </div>

            <div className="field vendor-filter">
              <label className="field-label" htmlFor="vendor-filter">
                Show
              </label>
              <select
                id="vendor-filter"
                name="filter"
                className="select"
                defaultValue={filter}
              >
                {FILTER_OPTIONS.map((option) => (
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
              <Link href="/admin/vendors" className="icon-btn">
                Clear
              </Link>
            )}
          </form>

          {filteredVendors.length === 0 ? (
            <EmptyState
              icon={IconIdCard}
              title={totalAccounts === 0 ? "No vendor accounts yet" : "No matching accounts"}
              hint={
                totalAccounts === 0
                  ? "Create an account above and assign it to a station."
                  : "Try a different search term or change the selected filter."
              }
            />
          ) : (
            <div className="vendor-cards">
              {filteredVendors.map((vendor) => {
                const sessions = sessionsByVendor.get(vendor.id) ?? [];

                return (
                  <article key={vendor.id} className="vendor-card">
                    <div className="vendor-card__header">
                      <div className="vendor-card__identity">
                        <div>
                          <strong>{vendor.username}</strong>
                          <span>
                            <IconStore size={14} /> {vendor.stationName}
                          </span>
                        </div>
                      </div>

                      <div className="vendor-card__badges">
                        <span
                          className={`badge ${
                            vendor.active ? "badge-success" : "badge-neutral"
                          }`}
                        >
                          {vendor.active ? "Active" : "Disabled"}
                        </span>
                        <span className={`badge ${sessions.length > 0 ? "badge-info" : "badge-neutral"}`}>
                          <IconDevices size={14} />
                          {sessions.length} {sessions.length === 1 ? "device" : "devices"}
                        </span>
                      </div>
                    </div>

                    {sessions.length > 0 ? (
                      <div className="vendor-sessions">
                        <div className="vendor-sessions__heading">
                          <div>
                            <strong>Signed-in devices</strong>
                            <span>Revoke one device without affecting the others.</span>
                          </div>
                        </div>

                        <ul>
                          {sessions.map((session, index) => (
                            <li key={session.id} className="vendor-session">
                              <span className="vendor-session__icon" aria-hidden="true">
                                <IconScan size={16} />
                              </span>

                              <div className="vendor-session__details">
                                <strong>Device {index + 1}</strong>
                                <span>Signed in {formatTime(session.createdAt)}</span>
                                <small>Expires {formatTime(session.expiresAt)}</small>
                              </div>

                              <form action={revokeVendorSessionAction}>
                                <input type="hidden" name="redirectTo" value={redirectTo} />
                                <input type="hidden" name="sessionId" value={session.id} />
                                <PendingSubmitButton
                                  className="btn btn-ghost btn-sm"
                                  pendingLabel="Signing out…"
                                >
                                  Sign out
                                </PendingSubmitButton>
                              </form>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="vendor-offline">
                        <IconDevices size={17} />
                        <span>No device is currently signed in.</span>
                      </div>
                    )}

                    <details className="vendor-edit">
                      <summary>
                        <span>Edit account</span>
                        <span>Username and account status</span>
                      </summary>

                      <div className="vendor-edit__body">
                        <form action={editVendorAction} className="vendor-edit__form">
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <input type="hidden" name="vendorId" value={vendor.id} />
                          <input type="hidden" name="stationId" value={vendor.stationId} />

                          <div className="field">
                            <label
                              className="field-label"
                              htmlFor={`vendor-${vendor.id}-username`}
                            >
                              Username
                            </label>
                            <input
                              id={`vendor-${vendor.id}-username`}
                              name="username"
                              className="input"
                              defaultValue={vendor.username}
                              required
                            />
                          </div>

                          <label className="vendor-toggle vendor-toggle--compact">
                            <input
                              type="checkbox"
                              name="active"
                              value="true"
                              defaultChecked={vendor.active}
                            />
                            <span className="vendor-toggle__track" aria-hidden="true">
                              <span />
                            </span>
                            <span>
                              <strong>Active account</strong>
                              <small>
                                {vendor.active
                                  ? "Vendor login is enabled."
                                  : "Vendor login is disabled."}
                              </small>
                            </span>
                          </label>

                          <PendingSubmitButton
                            className="btn btn-primary vendor-edit__save"
                            pendingLabel="Saving…"
                          >
                            Save changes
                          </PendingSubmitButton>
                        </form>
                      </div>
                    </details>
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
