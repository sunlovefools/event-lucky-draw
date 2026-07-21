import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { createStationAction, editStationAction } from "@/app/admin/actions";
import { AdminCard, EmptyState } from "@/app/admin/ui";
import { IconPlus, IconStore, IconList } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";

export const dynamic = "force-dynamic";

export default async function StationsPage() {
  const cookieStore = await cookies();
  const dashboard = await getAdminDashboard({
    store: new SupabaseDashboardStore(),
    sessionId: cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  });
  if (!dashboard.authorized) redirect("/admin?error=login-required");

  const linkedStationIds = new Set(dashboard.vendorAccounts.map((v) => v.stationId));

  return (
    <div className="module-grid">
      <AdminCard icon={IconStore} eyebrow="Manage" title="Stations">
        <p className="muted">
          Each station is a booth. Every vendor account is the login for exactly one station, so a station is linked to at most one vendor account.
        </p>

        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>
            <IconPlus /> New station
          </h2>
          <form action={createStationAction} className="form">
            <input type="hidden" name="redirectTo" value="/admin/stations" />
            <div className="field">
              <label className="field-label" htmlFor="station-name">
                Station name
              </label>
              <input id="station-name" name="name" className="input" placeholder="Main stage" required />
              <p className="hint">Use the booth or location name that vendors will recognize immediately.</p>
            </div>
            <label className="checkbox">
              <input type="checkbox" name="active" value="true" defaultChecked />
              Start as active
            </label>
            <PendingSubmitButton className="btn btn-primary" pendingLabel="Creating…">Create station</PendingSubmitButton>
          </form>
        </section>

        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>Stations ({dashboard.stations.length})</h2>
          {dashboard.stations.length === 0 ? (
            <EmptyState icon={IconList} title="No stations yet" hint="Create a booth above to get started." />
          ) : (
            <ul className="list">
              {dashboard.stations.map((st) => (
                <li key={st.id} className="list-item">
                  <form action={editStationAction} className="row">
                    <input type="hidden" name="redirectTo" value="/admin/stations" />
                    <input type="hidden" name="stationId" value={st.id} />
                    <div className="field" style={{ flex: "1 1 240px" }}>
                      <label className="field-label" htmlFor={`station-${st.id}`}>
                        Station name
                      </label>
                      <input id={`station-${st.id}`} name="name" className="input" defaultValue={st.name} required />
                    </div>
                    <label className="checkbox">
                      <input type="checkbox" name="active" value="true" defaultChecked={st.active} />
                      Active
                    </label>
                    <PendingSubmitButton className="btn btn-primary" pendingLabel="Saving…">Save changes</PendingSubmitButton>
                  </form>
                  <span className="muted">
                    {linkedStationIds.has(st.id) ? "Linked to a vendor account" : "Not linked to any vendor yet"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </AdminCard>
    </div>
  );
}
