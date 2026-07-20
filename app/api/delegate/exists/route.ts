import { NextRequest, NextResponse } from "next/server";

import { extractRegistrationNumberFromBadgePayload, SupabaseDelegateStore } from "@/lib/delegate";

// Lightweight, read-only probe used by the delegate registration screen to
// decide whether a scanned/typed badge code already maps to a registered
// delegate. Returns `{ registered: boolean }`. This lets the UI skip the
// full-name step for returning attendees.
export async function GET(request: NextRequest) {
  const registrationNumber = extractRegistrationNumberFromBadgePayload(
    request.nextUrl.searchParams.get("registrationNumber") ?? "",
  );

  if (!registrationNumber) {
    return NextResponse.json({ registered: false }, { status: 400 });
  }

  try {
    const delegate = await new SupabaseDelegateStore().findDelegateByRegistrationNumber(registrationNumber);
    return NextResponse.json({ registered: Boolean(delegate) });
  } catch {
    // On any lookup failure, report "not registered" so the UI falls back to
    // asking for a name; the real identify flow will surface the actual error.
    return NextResponse.json({ registered: false });
  }
}
