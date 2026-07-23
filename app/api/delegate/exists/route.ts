import { NextRequest, NextResponse } from "next/server";

import { extractRegistrationNumberFromBadgePayload, SupabaseDelegateStore } from "@/lib/delegate";

// Lightweight, read-only probe used by the delegate registration screen to
// decide whether a scanned/typed badge code maps to a pre-created delegate
// account. Returns `{ registered: boolean }`; unknown codes are rejected by the
// UI instead of self-registering.
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
    // On any lookup failure, report "not registered" so the UI can ask the
    // participant to contact admin rather than creating an account.
    return NextResponse.json({ registered: false });
  }
}
