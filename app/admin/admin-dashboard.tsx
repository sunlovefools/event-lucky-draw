import React from "react";

import { loginAdminAction, setParticipationAction } from "@/app/admin/actions";
import type { AdminDashboardResult } from "@/lib/admin";

export function AdminDashboard({ dashboard, error }: { dashboard: AdminDashboardResult; error?: string }) {
  if (!dashboard.authorized) {
    return (
      <main className="shell">
        <section className="hero" aria-labelledby="admin-login-title">
          <p className="eyebrow">Admin</p>
          <h1 id="admin-login-title">Admin login</h1>
          <p className="lead">Sign in to control event participation.</p>
          {error ? <p role="alert" className="health-error">{error}</p> : null}
          <form action={loginAdminAction} className="control-form">
            <label>
              Username
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit">Log in</button>
          </form>
        </section>
      </main>
    );
  }

  const { participation } = dashboard;
  const nextOpenValue = participation.open ? "false" : "true";
  const buttonLabel = participation.open ? "Close participation" : "Open participation";
  const changedBy = participation.updatedByUsername ?? "unknown admin";

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="admin-dashboard-title">
        <p className="eyebrow">Admin</p>
        <h1 id="admin-dashboard-title">Admin dashboard</h1>
        <p className="lead">Signed in as {dashboard.admin.username}</p>
      </section>

      <section className="health-card" aria-labelledby="participation-title">
        <h2 id="participation-title">Participation control</h2>
        <p className={participation.open ? "status-open" : "health-error"}>
          Participation is {participation.open ? "open" : "closed"}
        </p>
        <p>Last changed by {changedBy} at {participation.updatedAt}</p>
        <form action={setParticipationAction} className="control-form">
          <input type="hidden" name="open" value={nextOpenValue} />
          <button type="submit">{buttonLabel}</button>
        </form>
      </section>
    </main>
  );
}
