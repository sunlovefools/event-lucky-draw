import { loginAdminAction } from "@/app/admin/actions";
import { IconTrophy } from "@/app/admin/icons";

export function LoginScreen({ error }: { error?: string }) {
  return (
    <main className="shell" id="main">
      <section className="hero" aria-labelledby="admin-login-title">
        <p className="eyebrow">Admin</p>
        <h1 id="admin-login-title">Admin login</h1>
        <p className="lead">Sign in to control the event.</p>
        {error ? (
          <p className="alert alert-danger" role="alert">
            {error}
          </p>
        ) : null}
        <form action={loginAdminAction} className="form" style={{ marginTop: "1.25rem" }}>
          <div className="field">
            <label className="field-label" htmlFor="a-username">
              Username
            </label>
            <input
              id="a-username"
              name="username"
              className="input"
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="a-password">
              Password
            </label>
            <input
              id="a-password"
              name="password"
              type="password"
              className="input"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            Log in
          </button>
        </form>
      </section>
      <p className="muted center" style={{ marginTop: "1.5rem", display: "flex", gap: ".5rem", justifyContent: "center", alignItems: "center" }}>
        <IconTrophy size={16} />
        Event Station Quest
      </p>
    </main>
  );
}
