import { AdminLoginForm } from "@/app/admin/admin-login-form";
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
        <AdminLoginForm />
      </section>
      <p className="muted center" style={{ marginTop: "1.5rem", display: "flex", gap: ".5rem", justifyContent: "center", alignItems: "center" }}>
        <IconTrophy size={16} />
        Event Station Quest
      </p>
    </main>
  );
}
