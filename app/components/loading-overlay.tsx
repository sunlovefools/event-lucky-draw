"use client";

import React from "react";

import { BrandLoader } from "./brand-loader";

// Full-screen branded loading screen. The caller toggles `show` to fade it
// in/out; when the route navigates away the whole owning component unmounts,
// so the overlay disappears with it — there is never a frozen/blank frame.
export function LoadingOverlay({ show, message }: { show: boolean; message?: string }) {
  return (
    <div
      className={`loading-overlay ${show ? "is-visible" : ""}`}
      role="status"
      aria-live="polite"
      aria-hidden={!show}
    >
      <BrandLoader message={message} />
    </div>
  );
}
