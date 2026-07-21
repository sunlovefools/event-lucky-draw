import { createSupabaseBrowserClient } from "@/lib/supabase";
import { hashPassword, newSalt as generateSalt } from "@/lib/password";
import { normalizeUsername, normalizeStationId } from "@/lib/shared/normalize";
import { vendorAccountFromRow, type VendorAccount } from "@/lib/shared/vendor-account";
import { requireAdminSession, type AdminSessionStore, SupabaseAdminAuthStore } from "@/lib/auth/admin-auth";

export type VendorsStore = AdminSessionStore & {
  listVendorAccounts(): Promise<VendorAccount[]>;
  createVendorAccount(vendor: VendorAccountInput): Promise<VendorAccount>;
  updateVendorAccount(vendorId: string, vendor: VendorAccountUpdate): Promise<VendorAccount>;
};

type VendorAccountInput = {
  username: string;
  stationId: string;
  passwordHash: string;
  passwordSalt: string;
  active: boolean;
};

type VendorAccountUpdate = {
  username: string;
  stationId: string;
  active: boolean;
};

function validateVendorFields(username: string, stationId: string) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    return { ok: false as const, error: "Vendor username is required." };
  }

  const normalizedStationId = normalizeStationId(stationId);
  if (!normalizedStationId) {
    return { ok: false as const, error: "Vendor account must be assigned to exactly one station." };
  }

  return { ok: true as const, username: normalizedUsername, stationId: normalizedStationId };
}

export async function createVendorAccount({
  store,
  sessionId,
  username,
  password,
  stationId,
  active,
  now = () => new Date(),
  newSalt = generateSalt,
}: {
  store: VendorsStore;
  sessionId?: string | null;
  username: string;
  password: string;
  stationId: string;
  active: boolean;
  now?: () => Date;
  newSalt?: () => string;
}): Promise<{ ok: true; vendorAccount: VendorAccount } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const validFields = validateVendorFields(username, stationId);
  if (!validFields.ok) {
    return { ok: false, error: validFields.error };
  }

  const existingVendors = await store.listVendorAccounts();
  const stationTaken = existingVendors.find((v) => v.stationId === validFields.stationId);
  if (stationTaken) {
    return { ok: false, error: "That station is already linked to another vendor account." };
  }

  if (!password) {
    return { ok: false, error: "Vendor password is required." };
  }

  const passwordSalt = newSalt();
  return {
    ok: true,
    vendorAccount: await store.createVendorAccount({
      username: validFields.username,
      stationId: validFields.stationId,
      passwordHash: hashPassword(password, passwordSalt),
      passwordSalt,
      active,
    }),
  };
}

export async function editVendorAccount({
  store,
  sessionId,
  vendorId,
  username,
  stationId,
  active,
  now = () => new Date(),
}: {
  store: VendorsStore;
  sessionId?: string | null;
  vendorId: string;
  username: string;
  stationId: string;
  active: boolean;
  now?: () => Date;
}): Promise<{ ok: true; vendorAccount: VendorAccount } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const normalizedVendorId = vendorId.trim();
  if (!normalizedVendorId) {
    return { ok: false, error: "Vendor account is required." };
  }

  const validFields = validateVendorFields(username, stationId);
  if (!validFields.ok) {
    return { ok: false, error: validFields.error };
  }

  const others = (await store.listVendorAccounts()).filter((v) => v.id !== normalizedVendorId);
  const stationTaken = others.find((v) => v.stationId === validFields.stationId);
  if (stationTaken) {
    return { ok: false, error: "That station is already linked to another vendor account." };
  }

  return {
    ok: true,
    vendorAccount: await store.updateVendorAccount(normalizedVendorId, {
      username: validFields.username,
      stationId: validFields.stationId,
      active,
    }),
  };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type VendorAccountRow = {
  id: string;
  username: string;
  station_id: string;
  active: boolean;
  stations?: { name: string } | { name: string }[] | null;
};

export class SupabaseVendorsStore implements VendorsStore {
  private readonly auth = new SupabaseAdminAuthStore();

  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  findValidSession(sessionId: string, nowIso: string) {
    return this.auth.findValidSession(sessionId, nowIso);
  }

  async listVendorAccounts(): Promise<VendorAccount[]> {
    const { data, error } = await this.supabase
      .from("vendor_accounts")
      .select("id, username, station_id, active, stations(name)")
      .order("username");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(vendorAccountFromRow);
  }

  async createVendorAccount(vendor: VendorAccountInput): Promise<VendorAccount> {
    const { data, error } = await this.supabase
      .from("vendor_accounts")
      .insert({
        username: vendor.username,
        station_id: vendor.stationId,
        password_hash: vendor.passwordHash,
        password_salt: vendor.passwordSalt,
        active: vendor.active,
      })
      .select("id, username, station_id, active, stations(name)")
      .single<VendorAccountRow>();

    if (error) {
      throw new Error(error.message);
    }

    return vendorAccountFromRow(data);
  }

  async updateVendorAccount(vendorId: string, vendor: VendorAccountUpdate): Promise<VendorAccount> {
    const { data, error } = await this.supabase
      .from("vendor_accounts")
      .update({ username: vendor.username, station_id: vendor.stationId, active: vendor.active })
      .eq("id", vendorId)
      .select("id, username, station_id, active, stations(name)")
      .single<VendorAccountRow>();

    if (error) {
      throw new Error(error.message);
    }

    return vendorAccountFromRow(data);
  }
}
