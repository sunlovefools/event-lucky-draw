"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polls the server component tree on an interval without a full page reload.
// Replaces the previous <meta httpEquiv="refresh"> approach so the vendor
// portal updates live while preserving scroll position and any open forms.
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
