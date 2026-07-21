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
                        <span className="vendor-card__avatar" aria-hidden="true">
                          {vendor.username.slice(0, 2).toUpperCase()}
                        </span>
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

        <style>{`
          .vendor-heading,
          .vendor-directory__heading,
          .vendor-card__header,
          .vendor-sessions__heading {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 1rem;
          }

          .vendor-intro {
            max-width: 760px;
            margin: 0;
            color: var(--muted, #52617a);
            line-height: 1.6;
          }

          .vendor-stats {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0.85rem;
            margin-top: 1.25rem;
          }

          .vendor-stat {
            min-height: 94px;
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 0.85rem;
            border: 1px solid #dce6f5;
            border-radius: 18px;
            background: #fff;
          }

          .vendor-stat__icon,
          .vendor-create__summary-icon,
          .vendor-session__icon {
            display: inline-grid;
            place-items: center;
            width: 42px;
            height: 42px;
            flex: 0 0 auto;
            border-radius: 13px;
            color: #2463eb;
            background: #edf4ff;
          }

          .vendor-stat__icon--devices {
            color: #6e4be7;
            background: #f0ebff;
          }

          .vendor-stat strong {
            display: block;
            color: #111a2e;
            font-size: 1.35rem;
            line-height: 1.1;
          }

          .vendor-stat span:last-child {
            display: block;
            margin-top: 0.25rem;
            color: #65738a;
            font-size: 0.82rem;
          }

          .vendor-stat__dot {
            width: 42px;
            height: 42px;
            flex: 0 0 auto;
            border: 11px solid;
            border-radius: 50%;
          }

          .vendor-stat__dot--active {
            border-color: #c9f5df;
            background: #19ad70;
          }

          .vendor-stat__dot--online {
            border-color: #dbe9ff;
            background: #3976ec;
          }

          .vendor-create,
          .vendor-directory {
            margin-top: 1rem;
            border: 1px solid #dce6f5;
            border-radius: 20px;
            background: #fff;
            overflow: hidden;
          }

          .vendor-create > summary {
            padding: 1rem 1.1rem;
            display: flex;
            align-items: center;
            gap: 0.8rem;
            cursor: pointer;
            list-style: none;
          }

          .vendor-create > summary::-webkit-details-marker {
            display: none;
          }

          .vendor-create > summary > span:nth-child(2) {
            display: grid;
            gap: 0.15rem;
          }

          .vendor-create > summary strong {
            color: #131b2d;
            font-size: 1rem;
          }

          .vendor-create > summary small,
          .vendor-toggle small {
            color: #6a7890;
          }

          .vendor-create__summary-action {
            margin-left: auto;
            color: #2463eb;
            font-weight: 700;
          }

          .vendor-create[open] > summary {
            border-bottom: 1px solid #e5ecf7;
            background: #f8fbff;
          }

          .vendor-create__body {
            padding: 1.1rem;
          }

          .vendor-create__form {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            align-items: end;
            gap: 1rem;
          }

          .vendor-create__form .vendor-toggle {
            grid-column: 1 / span 2;
          }

          .vendor-create__button {
            justify-self: end;
            min-width: 180px;
          }

          .vendor-toggle {
            min-height: 46px;
            display: flex;
            align-items: center;
            gap: 0.65rem;
            cursor: pointer;
          }

          .vendor-toggle input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
          }

          .vendor-toggle__track {
            position: relative;
            width: 42px;
            height: 24px;
            flex: 0 0 auto;
            border-radius: 999px;
            background: #cbd5e4;
            transition: 0.2s ease;
          }

          .vendor-toggle__track span {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0 1px 4px rgba(17, 26, 46, 0.2);
            transition: 0.2s ease;
          }

          .vendor-toggle input:checked + .vendor-toggle__track {
            background: #2d68eb;
          }

          .vendor-toggle input:checked + .vendor-toggle__track span {
            transform: translateX(18px);
          }

          .vendor-toggle > span:last-child {
            display: grid;
            gap: 0.1rem;
          }

          .vendor-toggle strong {
            color: #172033;
            font-size: 0.9rem;
          }

          .vendor-toggle small {
            font-size: 0.76rem;
          }

          .vendor-directory {
            padding: 1.1rem;
          }

          .vendor-directory__heading h2 {
            margin: 0;
            color: #111a2e;
            font-size: 1.25rem;
          }

          .vendor-directory__heading p {
            margin: 0.25rem 0 0;
          }

          .vendor-toolbar {
            margin-top: 1rem;
            padding: 0.85rem;
            display: flex;
            align-items: end;
            gap: 0.75rem;
            border-radius: 16px;
            background: #f7faff;
          }

          .vendor-search {
            flex: 1 1 360px;
          }

          .vendor-filter {
            flex: 0 1 210px;
          }

          .vendor-cards {
            display: grid;
            gap: 0.8rem;
            margin-top: 1rem;
          }

          .vendor-card {
            padding: 1rem;
            border: 1px solid #dfe7f3;
            border-radius: 18px;
            background: #fff;
            transition: transform 0.18s ease, box-shadow 0.18s ease;
          }

          .vendor-card:hover {
            transform: translateY(-1px);
            box-shadow: 0 10px 28px rgba(38, 72, 128, 0.08);
          }

          .vendor-card__identity {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .vendor-card__avatar {
            display: grid;
            place-items: center;
            width: 44px;
            height: 44px;
            flex: 0 0 auto;
            border-radius: 14px;
            color: #2463eb;
            background: #edf4ff;
            font-weight: 800;
            font-size: 0.82rem;
          }

          .vendor-card__identity > div {
            display: grid;
            gap: 0.18rem;
          }

          .vendor-card__identity strong {
            color: #111a2e;
            font-size: 1rem;
          }

          .vendor-card__identity span {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            color: #68778e;
            font-size: 0.82rem;
          }

          .vendor-card__badges {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 0.4rem;
          }

          .vendor-sessions {
            margin-top: 0.9rem;
            padding: 0.9rem;
            border-radius: 15px;
            background: #f8fbff;
          }

          .vendor-sessions__heading strong {
            display: block;
            color: #172033;
            font-size: 0.9rem;
          }

          .vendor-sessions__heading span {
            display: block;
            margin-top: 0.15rem;
            color: #6a7890;
            font-size: 0.78rem;
          }

          .vendor-sessions ul {
            margin: 0.7rem 0 0;
            padding: 0;
            display: grid;
            gap: 0.55rem;
            list-style: none;
          }

          .vendor-session {
            padding: 0.75rem;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: center;
            gap: 0.75rem;
            border: 1px solid #e0e8f4;
            border-radius: 13px;
            background: #fff;
          }

          .vendor-session__icon {
            width: 36px;
            height: 36px;
            border-radius: 11px;
          }

          .vendor-session__details {
            display: grid;
            gap: 0.1rem;
          }

          .vendor-session__details strong {
            color: #172033;
            font-size: 0.85rem;
          }

          .vendor-session__details span,
          .vendor-session__details small {
            color: #68778e;
            font-size: 0.76rem;
          }

          .vendor-offline {
            margin-top: 0.9rem;
            padding: 0.8rem;
            display: flex;
            align-items: center;
            gap: 0.55rem;
            border-radius: 13px;
            color: #69788f;
            background: #f7f9fc;
            font-size: 0.82rem;
          }

          .vendor-edit {
            margin-top: 0.85rem;
            border-top: 1px solid #edf1f7;
          }

          .vendor-edit > summary {
            padding-top: 0.85rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            cursor: pointer;
            list-style: none;
            color: #2463eb;
            font-weight: 700;
          }

          .vendor-edit > summary::-webkit-details-marker {
            display: none;
          }

          .vendor-edit > summary span:last-child {
            color: #7b879b;
            font-size: 0.75rem;
            font-weight: 500;
          }

          .vendor-edit__body {
            padding-top: 0.85rem;
          }

          .vendor-edit__form {
            padding: 0.85rem;
            display: grid;
            grid-template-columns: minmax(220px, 1fr) auto auto;
            align-items: end;
            gap: 0.85rem;
            border-radius: 14px;
            background: #f8fbff;
          }

          .vendor-toggle--compact {
            min-width: 170px;
          }

          .vendor-edit__save {
            min-width: 130px;
          }

          @media (max-width: 1050px) {
            .vendor-stats {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .vendor-create__form,
            .vendor-edit__form {
              grid-template-columns: 1fr;
              align-items: stretch;
            }

            .vendor-create__form .vendor-toggle {
              grid-column: auto;
            }

            .vendor-create__button,
            .vendor-edit__save {
              width: 100%;
              justify-self: stretch;
            }
          }

          @media (max-width: 720px) {
            .vendor-heading,
            .vendor-card__header {
              align-items: stretch;
              flex-direction: column;
            }

            .vendor-stats {
              grid-template-columns: 1fr;
            }

            .vendor-toolbar {
              align-items: stretch;
              flex-direction: column;
            }

            .vendor-filter {
              width: 100%;
              flex-basis: auto;
            }

            .vendor-card__badges {
              justify-content: flex-start;
            }

            .vendor-session {
              grid-template-columns: auto minmax(0, 1fr);
            }

            .vendor-session form {
              grid-column: 1 / -1;
            }

            .vendor-session .btn {
              width: 100%;
            }

            .vendor-edit > summary {
              align-items: flex-start;
              flex-direction: column;
              gap: 0.2rem;
            }
          }
        `}</style>
      </AdminCard>
    </div>
  );
}
