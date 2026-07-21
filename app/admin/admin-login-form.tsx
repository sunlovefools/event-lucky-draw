"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { loginAdminAction } from "@/app/admin/actions";
import { LoadingOverlay } from "@/app/components/loading-overlay";

export function AdminLoginForm() {
  const [submitting, setSubmitting] = useState(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = useCallback(() => {
    setSubmitting(true);
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => setSubmitting(false), 8000);
  }, []);

  useEffect(() => () => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
  }, []);

  return (
    <>
      <form action={loginAdminAction} onSubmit={handleSubmit} className="form" style={{ marginTop: "1.25rem" }}>
        <div className="field">
          <label className="field-label" htmlFor="a-username">
            Username
          </label>
          <input id="a-username" name="username" className="input" autoComplete="username" required autoFocus />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="a-password">
            Password
          </label>
          <input id="a-password" name="password" type="password" className="input" autoComplete="current-password" required />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Signing in…" : "Log in"}
        </button>
      </form>
      <LoadingOverlay show={submitting} message="Signing you in…" />
    </>
  );
}
