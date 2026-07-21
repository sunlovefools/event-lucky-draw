import React from "react";

// Presentational branded loader. Pure markup + CSS, so it is safe to render
// from both a server component (app/loading.tsx) and a client component
// (LoadingOverlay). Animation is disabled automatically under
// prefers-reduced-motion via the global rule in globals.css.
export function BrandLoader({ message }: { message?: string }) {
  return (
    <div className="brand-loader">
      <div className="brand-loader__spinner" aria-hidden="true" />
      <p className="brand-loader__name">Event Station Quest</p>
      {message ? <p className="brand-loader__msg">{message}</p> : null}
    </div>
  );
}
