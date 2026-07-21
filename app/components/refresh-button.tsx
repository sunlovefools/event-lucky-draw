"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";

// Manual trigger to re-fetch the server component tree (replacing the old
// 5s AutoRefresh polling). Lets the vendor pull the latest station scan
// history / participation state on demand instead of on a timer.
export function RefreshButton({ label = "Refresh list" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Refreshing…" : label}
    </button>
  );
}
