import { createSupabaseBrowserClient } from "@/lib/supabase";

export type SessionDelegate = {
  id: string;
  registrationNumber: string;
  fullName: string;
  title?: string;
};

export type ValidDelegateSession = {
  id: string;
  delegate: SessionDelegate;
};

export type DelegateSessionStore = {
  findValidDelegateSession(sessionId: string, nowIso: string): Promise<ValidDelegateSession | null>;
};

export function delegateFromRow(row: { id: string; registration_number: string; full_name: string; title?: string | null }): SessionDelegate {
  return { id: row.id, registrationNumber: row.registration_number, fullName: row.full_name, title: row.title ?? "" };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

export type DelegateRow = { id: string; registration_number: string; full_name: string; title?: string | null };

export type DelegateSessionRow = {
  id: string;
  delegates?: DelegateRow | DelegateRow[] | null;
};

export async function findValidDelegateSession(
  supabase: SupabaseClientLike,
  sessionId: string,
  nowIso: string,
): Promise<ValidDelegateSession | null> {
  const { data, error } = await supabase
    .from("delegate_sessions")
    .select("id, delegates!inner(id, registration_number, full_name, title)")
    .eq("id", sessionId)
    .gt("expires_at", nowIso)
    .maybeSingle<DelegateSessionRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const delegate = Array.isArray(data.delegates) ? data.delegates[0] : data.delegates;
  if (!delegate) {
    return null;
  }

  return { id: data.id, delegate: delegateFromRow(delegate) };
}

export class SupabaseDelegateSessionStore implements DelegateSessionStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  findValidDelegateSession(sessionId: string, nowIso: string): Promise<ValidDelegateSession | null> {
    return findValidDelegateSession(this.supabase, sessionId, nowIso);
  }
}
