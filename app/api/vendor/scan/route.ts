import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { VENDOR_SESSION_COOKIE } from "@/app/vendor/session";
import { requireVendorSession, SupabaseVendorAuthStore } from "@/lib/auth/vendor-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { collectStampFromVendorScan, SupabaseVendorStore } from "@/lib/vendor/portal";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(VENDOR_SESSION_COOKIE)?.value;
  const supabase = createSupabaseBrowserClient();
  const session = await requireVendorSession({
    store: new SupabaseVendorAuthStore(supabase),
    sessionId,
    nowIso: new Date().toISOString(),
  });

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "unauthorized", error: "Vendor login required." },
      { status: 401 },
    );
  }

  let badgePayload = "";
  try {
    const body = (await request.json()) as { badgePayload?: unknown };
    if (typeof body.badgePayload === "string") {
      badgePayload = body.badgePayload;
    }
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid", error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await collectStampFromVendorScan({
    store: new SupabaseVendorStore(supabase),
    session,
    badgePayload,
  });

  return NextResponse.json(result);
}
