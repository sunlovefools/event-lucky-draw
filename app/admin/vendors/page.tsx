import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { type VendorDeviceSession } from "@/lib/auth/vendor-auth";
import { createVendorAction, editVendorAction, revokeVendorSessionAction } from "@/app/admin/actions";
import { AdminCard, EmptyState, formatTime } from "@/app/admin/ui";
import { IconPlus, IconStore, IconDevices, IconScan, IconIdCard, IconList } from "@/app/admin/icons";

export const dynamic = "force-dynamic";

function StationSelect({
  stations,
  value,
}: {
  stations: Array<{ id: string; name: string }>;
  value: string | null;
}) {
  return (
    <label>
      Station
      <select name="stationId" required defaultValue={value ?? ""}>
        <option value="" disabled>
          Select a station…
        </option>
        {stations.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function VendorsPage() {
  const cookieStore = await cookies();
  const dashboard = await getAdminDashboard({
    store: new SupabaseDashboardStore(),
    sessionId: cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  });
  if (!dashboard.authorized) redirect("/admin?error=login-required");

  const usedStationIds = new Set(dashboard.vendorAccounts.map((v) => v.stationId));
  const availableStations = dashboard.stations.filter((s) => !usedStationIds.has(s.id));

  const sessionsByVendor = new Map<string, VendorDeviceSession[]>();
  for (const sessionRow of dashboard.vendorSessions ?? []) {
    const arr = sessionsByVendor.get(sessionRow.vendorId) ?? [];
    arr.push(sessionRow);
    sessionsByVendor.set(sessionRow.vendorId, arr);
  }

  return (
    <div className="module-grid">
      <AdminCard icon={IconIdCard} eyebrow="Manage" title="Vendor accounts">
        <p className="muted">
          Each vendor account is the login for exactly one station and can be signed in on multiple devices at once. Sign out a device below without affecting the others.
        </p>

        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>
            <IconPlus /> New vendor account
          </h2>
          {availableStations.length === 0 ? (
            <EmptyState
              icon={IconList}
              title="No available stations"
              hint="Every station is already linked to a vendor account. Create a station first — a station can only belong to one vendor."
            />
          ) : (
            <form action={createVendorAction} className="form">
              <input type="hidden" name="redirectTo" value="/admin/vendors" />
              <label>
                Username
                <input name="username" required />
              </label>
              <label>
                Password
                <input name="password" type="password" required />
              </label>
              <StationSelect stations={availableStations} value={null} />
              <label className="checkbox">
                <input type="checkbox" name="active" value="true" defaultChecked />
                Active
              </label>
              <button type="submit">Create account</button>
            </form>
          )}
        </section>

        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>Vendor accounts ({dashboard.vendorAccounts.length})</h2>
          {dashboard.vendorAccounts.length === 0 ? (
            <EmptyState
              icon={IconIdCard}
              title="No vendor accounts yet"
              hint="Create a vendor account above and link it to a station."
            />
          ) : (
            <ul className="list">
              {dashboard.vendorAccounts.map((v) => {
                const sessions = sessionsByVendor.get(v.id) ?? [];
                return (
                  <li key={v.id} className="list-item">
                    <div className="row-between">
                      <div>
                        <span className="list-item-title">{v.username}</span>
                        <div className="muted">
                          Station: {v.stationName} · {v.active ? "Active" : "Disabled"}
                        </div>
                      </div>
                      <span className="badge badge-neutral">
                        <IconDevices size={14} /> {sessions.length} device(s)
                      </span>
                    </div>

                    {sessions.length > 0 ? (
                      <ul className="list list-tight">
                        {sessions.map((s) => (
                          <li key={s.id} className="list-item row-between">
                            <span className="muted">
                              <IconScan size={14} /> Signed in {formatTime(s.createdAt)} · expires {formatTime(s.expiresAt)}
                            </span>
                            <form action={revokeVendorSessionAction}>
                              <input type="hidden" name="redirectTo" value="/admin/vendors" />
                              <input type="hidden" name="sessionId" value={s.id} />
                              <button type="submit" className="btn btn-ghost btn-sm">
                                Sign out device
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <details className="disclosure">
                      <summary>Edit account</summary>
                      <div className="disclosure-body">
                        <form action={editVendorAction} className="form">
                          <input type="hidden" name="redirectTo" value="/admin/vendors" />
                          <input type="hidden" name="vendorId" value={v.id} />
                          <input type="hidden" name="stationId" value={v.stationId} />
                          <label>
                            Username
                            <input name="username" defaultValue={v.username} required />
                          </label>
                          <label className="checkbox">
                            <input type="checkbox" name="active" value="true" defaultChecked={v.active} />
                            Active
                          </label>
                          <button type="submit">Save</button>
                        </form>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </AdminCard>
    </div>
  );
}
