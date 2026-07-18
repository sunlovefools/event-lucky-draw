import { randomUUID } from "node:crypto";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import { hashPassword } from "@/lib/password";
import { normalizeUsername } from "@/lib/shared/normalize";
import { type Station } from "@/lib/shared/station";

// A vendor station is the same domain concept as an admin station.
export type VendorStation = Station;

// The vendor's own view of its account: includes the secret material needed to
// verify a login and the assigned station. This is a distinct projection from
// the admin-facing VendorAccount in lib/shared/vendor-account.ts.
export type VendorAccount = {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  station: VendorStation;
};

export type VendorSession = {
  id: string;
  vendorId: string;
  expiresAt: string;
};

export type ValidVendorSession = {
  id: string;
  vendor: {
    id: string;
    username: string;
    station: VendorStation;
  };
};

export type VendorSessionStore = {
  findValidVendorSession(sessionId: string, nowIso: string): Promise<ValidVendorSession | null>;
};

export type VendorAuthStore = VendorSessionStore & {
  findActiveVendorByUsername(username: string): Promise<VendorAccount | null>;
  createVendorSession(vendorId: string, expiresAt: string): Promise<VendorSession>;
};

const VENDOR_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export async function requireVendorSession({
  store,
  sessionId,
  nowIso,
}: {
  store: VendorSessionStore;
  sessionId?: string | null;
  nowIso: string;
}) {
  if (!sessionId) {
    return null;
  }

  return store.findValidVendorSession(sessionId, nowIso);
}

export async function authenticateVendor({
  store,
  username,
  password,
  now = () => new Date(),
}: {
  store: VendorAuthStore;
  username: string;
  password: string;
  now?: () => Date;
}): Promise<{ ok: true; session: VendorSession } | { ok: false; error: string }> {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !password) {
    return { ok: false, error: "Invalid username or password." };
  }

  const vendor = await store.findActiveVendorByUsername(normalizedUsername);
  if (!vendor) {
    return { ok: false, error: "Invalid username or password." };
  }

  const candidateHash = hashPassword(password, vendor.passwordSalt);
  if (candidateHash !== vendor.passwordHash) {
    return { ok: false, error: "Invalid username or password." };
  }

  const expiresAt = new Date(now().getTime() + VENDOR_SESSION_DURATION_MS).toISOString();
  return { ok: true, session: await store.createVendorSession(vendor.id, expiresAt) };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type VendorAccountRow = {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  stations?: { id: string; name: string; active: boolean } | { id: string; name: string; active: boolean }[] | null;
};

type VendorSessionRow = {
  id: string;
  vendor_accounts?: {
    id: string;
    username: string;
    stations?: { id: string; name: string; active: boolean } | { id: string; name: string; active: boolean }[] | null;
  } | Array<{
    id: string;
    username: string;
    stations?: { id: string; name: string; active: boolean } | { id: string; name: string; active: boolean }[] | null;
  }> | null;
};

function stationFromJoin(
  station: { id: string; name: string; active: boolean } | { id: string; name: string; active: boolean }[] | null | undefined,
): VendorStation {
  const row = Array.isArray(station) ? station[0] : station;
  if (!row) {
    throw new Error("Vendor account is missing an assigned station.");
  }

  return { id: row.id, name: row.name, active: row.active };
}

export class SupabaseVendorAuthStore implements VendorAuthStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  async findActiveVendorByUsername(username: string): Promise<VendorAccount | null> {
    const { data, error } = await this.supabase
      .from("vendor_accounts")
      .select("id, username, password_hash, password_salt, stations!inner(id, name, active)")
      .eq("username", username)
      .eq("active", true)
      .maybeSingle<VendorAccountRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      username: data.username,
      passwordHash: data.password_hash,
      passwordSalt: data.password_salt,
      station: stationFromJoin(data.stations),
    };
  }

  async createVendorSession(vendorId: string, expiresAt: string): Promise<VendorSession> {
    const id = randomUUID();
    const { data, error } = await this.supabase
      .from("vendor_sessions")
      .insert({ id, vendor_id: vendorId, expires_at: expiresAt })
      .select("id, vendor_id, expires_at")
      .single<{ id: string; vendor_id: string; expires_at: string }>();

    if (error) {
      throw new Error(error.message);
    }

    return { id: data.id, vendorId: data.vendor_id, expiresAt: data.expires_at };
  }

  async findValidVendorSession(sessionId: string, nowIso: string): Promise<ValidVendorSession | null> {
    const { data, error } = await this.supabase
      .from("vendor_sessions")
      .select("id, vendor_accounts!inner(id, username, stations!inner(id, name, active))")
      .eq("id", sessionId)
      .gt("expires_at", nowIso)
      .maybeSingle<VendorSessionRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    const vendor = Array.isArray(data.vendor_accounts) ? data.vendor_accounts[0] : data.vendor_accounts;
    if (!vendor) {
      return null;
    }

    return {
      id: data.id,
      vendor: {
        id: vendor.id,
        username: vendor.username,
        station: stationFromJoin(vendor.stations),
      },
    };
  }
}
