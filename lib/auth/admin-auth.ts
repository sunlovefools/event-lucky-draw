import { randomUUID } from "node:crypto";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import { hashPassword } from "@/lib/password";
import { normalizeUsername } from "@/lib/shared/normalize";

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

// Every admin feature store can verify the calling admin's session.
export type AdminSessionStore = {
  findValidSession(sessionId: string, nowIso: string): Promise<ValidAdminSession | null>;
};

export type AdminAuthStore = AdminSessionStore & {
  findActiveAdminByUsername(username: string): Promise<AdminAccount | null>;
  createAdminSession(adminId: string, expiresAt: string): Promise<AdminSession>;
};

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export async function requireAdminSession({
  store,
  sessionId,
  nowIso,
}: {
  store: AdminSessionStore;
  sessionId?: string | null;
  nowIso: string;
}): Promise<ValidAdminSession | null> {
  if (!sessionId) {
    return null;
  }

  return store.findValidSession(sessionId, nowIso);
}

export async function authenticateAdmin({
  store,
  username,
  password,
  now = () => new Date(),
}: {
  store: AdminAuthStore;
  username: string;
  password: string;
  now?: () => Date;
}): Promise<{ ok: true; session: AdminSession } | { ok: false; error: string }> {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password) {
    return { ok: false, error: "Invalid username or password." };
  }

  const admin = await store.findActiveAdminByUsername(normalizedUsername);
  if (!admin) {
    return { ok: false, error: "Invalid username or password." };
  }

  const candidateHash = hashPassword(password, admin.passwordSalt);
  if (candidateHash !== admin.passwordHash) {
    return { ok: false, error: "Invalid username or password." };
  }

  const expiresAt = new Date(now().getTime() + SESSION_DURATION_MS).toISOString();
  return { ok: true, session: await store.createAdminSession(admin.id, expiresAt) };
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

export class SupabaseAdminAuthStore implements AdminAuthStore {
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
}
