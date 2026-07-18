import { createHash, randomUUID } from "node:crypto";

import { createSupabaseBrowserClient } from "@/lib/supabase";

export type AdminAccount = {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
};

export type AdminSession = {
  id: string;
  adminId: string;
  expiresAt: string;
};

export type ValidAdminSession = {
  id: string;
  adminId: string;
  username: string;
};

export type ParticipationState = {
  open: boolean;
  updatedAt: string;
  updatedByUsername: string | null;
};

export type AdminStore = {
  findActiveAdminByUsername(username: string): Promise<AdminAccount | null>;
  createAdminSession(adminId: string, expiresAt: string): Promise<AdminSession>;
  findValidSession(sessionId: string, nowIso: string): Promise<ValidAdminSession | null>;
  readParticipationState(): Promise<ParticipationState>;
  updateParticipationState(open: boolean, adminId: string, updatedAt: string): Promise<ParticipationState>;
};

export type AdminDashboardResult =
  | { authorized: false }
  | { authorized: true; admin: { id: string; username: string }; participation: ParticipationState };

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export function hashAdminPassword(password: string, salt: string) {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

export async function authenticateAdmin({
  store,
  username,
  password,
  now = () => new Date(),
}: {
  store: AdminStore;
  username: string;
  password: string;
  now?: () => Date;
}): Promise<{ ok: true; session: AdminSession } | { ok: false; error: string }> {
  const normalizedUsername = username.trim().toLowerCase();

  if (!normalizedUsername || !password) {
    return { ok: false, error: "Invalid username or password." };
  }

  const admin = await store.findActiveAdminByUsername(normalizedUsername);
  if (!admin) {
    return { ok: false, error: "Invalid username or password." };
  }

  const candidateHash = hashAdminPassword(password, admin.passwordSalt);
  if (candidateHash !== admin.passwordHash) {
    return { ok: false, error: "Invalid username or password." };
  }

  const expiresAt = new Date(now().getTime() + SESSION_DURATION_MS).toISOString();
  return { ok: true, session: await store.createAdminSession(admin.id, expiresAt) };
}

export async function getAdminDashboard({
  store,
  sessionId,
  now = () => new Date(),
}: {
  store: AdminStore;
  sessionId?: string | null;
  now?: () => Date;
}): Promise<AdminDashboardResult> {
  if (!sessionId) {
    return { authorized: false };
  }

  const session = await store.findValidSession(sessionId, now().toISOString());
  if (!session) {
    return { authorized: false };
  }

  const participation = await store.readParticipationState();

  return {
    authorized: true,
    admin: { id: session.adminId, username: session.username },
    participation,
  };
}

export async function setParticipationState({
  store,
  sessionId,
  open,
  now = () => new Date(),
}: {
  store: AdminStore;
  sessionId?: string | null;
  open: boolean;
  now?: () => Date;
}): Promise<{ ok: true; participation: ParticipationState } | { ok: false; error: string }> {
  if (!sessionId) {
    return { ok: false, error: "Admin login required." };
  }

  const updatedAt = now().toISOString();
  const session = await store.findValidSession(sessionId, updatedAt);
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  return {
    ok: true,
    participation: await store.updateParticipationState(open, session.adminId, updatedAt),
  };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type AdminAccountRow = {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
};

type SessionWithAdminRow = {
  id: string;
  admin_id: string;
  admin_accounts?: { username: string } | { username: string }[] | null;
};

type EventSettingsRow = {
  participation_open: boolean;
  updated_at: string;
  admin_accounts?: { username: string } | { username: string }[] | null;
};

export class SupabaseAdminStore implements AdminStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  async findActiveAdminByUsername(username: string): Promise<AdminAccount | null> {
    const { data, error } = await this.supabase
      .from("admin_accounts")
      .select("id, username, password_hash, password_salt")
      .eq("username", username)
      .eq("active", true)
      .maybeSingle<AdminAccountRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data
      ? {
          id: data.id,
          username: data.username,
          passwordHash: data.password_hash,
          passwordSalt: data.password_salt,
        }
      : null;
  }

  async createAdminSession(adminId: string, expiresAt: string): Promise<AdminSession> {
    const id = randomUUID();
    const { data, error } = await this.supabase
      .from("admin_sessions")
      .insert({ id, admin_id: adminId, expires_at: expiresAt })
      .select("id, admin_id, expires_at")
      .single<{ id: string; admin_id: string; expires_at: string }>();

    if (error) {
      throw new Error(error.message);
    }

    return { id: data.id, adminId: data.admin_id, expiresAt: data.expires_at };
  }

  async findValidSession(sessionId: string, nowIso: string): Promise<ValidAdminSession | null> {
    const { data, error } = await this.supabase
      .from("admin_sessions")
      .select("id, admin_id, admin_accounts!inner(username)")
      .eq("id", sessionId)
      .gt("expires_at", nowIso)
      .maybeSingle<SessionWithAdminRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    const adminAccount = Array.isArray(data.admin_accounts) ? data.admin_accounts[0] : data.admin_accounts;
    return { id: data.id, adminId: data.admin_id, username: adminAccount?.username ?? "admin" };
  }

  async readParticipationState(): Promise<ParticipationState> {
    const { data, error } = await this.supabase
      .from("event_settings")
      .select("participation_open, updated_at, admin_accounts(username)")
      .eq("id", 1)
      .single<EventSettingsRow>();

    if (error) {
      throw new Error(error.message);
    }

    const adminAccount = Array.isArray(data.admin_accounts) ? data.admin_accounts[0] : data.admin_accounts;
    return {
      open: data.participation_open,
      updatedAt: data.updated_at,
      updatedByUsername: adminAccount?.username ?? null,
    };
  }

  async updateParticipationState(open: boolean, adminId: string, updatedAt: string): Promise<ParticipationState> {
    const { data, error } = await this.supabase
      .from("event_settings")
      .update({ participation_open: open, updated_by_admin_id: adminId, updated_at: updatedAt })
      .eq("id", 1)
      .select("participation_open, updated_at, admin_accounts(username)")
      .single<EventSettingsRow>();

    if (error) {
      throw new Error(error.message);
    }

    const adminAccount = Array.isArray(data.admin_accounts) ? data.admin_accounts[0] : data.admin_accounts;
    return {
      open: data.participation_open,
      updatedAt: data.updated_at,
      updatedByUsername: adminAccount?.username ?? null,
    };
  }
}
