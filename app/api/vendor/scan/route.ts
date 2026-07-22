import { NextResponse } from "next/server";

import { collectStampForStationScan, SupabaseVendorStore } from "@/lib/vendor/portal";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let badgePayload = "";
  let stationName = "";
  try {
    const body = (await request.json()) as { badgePayload?: unknown; stationName?: unknown };
    if (typeof body.badgePayload === "string") {
      badgePayload = body.badgePayload;
    }
    if (typeof body.stationName === "string") {
      stationName = body.stationName;
    }
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid", error: "Invalid request body." },
      { status: 400 },
    );
  }

  const store = new SupabaseVendorStore(createSupabaseBrowserClient());
  const station = stationName.trim() ? await store.findStationByName(stationName.trim()) : null;
  if (!station) {
    return NextResponse.json(
      { ok: false, reason: "invalid", error: "Station not found." },
      { status: 404 },
    );
  }

  const result = await collectStampForStationScan({
    store,
    station,
    badgePayload,
  });

  return NextResponse.json(result);
}
