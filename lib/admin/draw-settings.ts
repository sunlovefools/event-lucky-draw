import { createSupabaseBrowserClient } from "@/lib/supabase";
import { requireAdminSession, SupabaseAdminAuthStore, type AdminSessionStore } from "@/lib/auth/admin-auth";

export type DrawSettings = {
  spinDurationMs: number;
  nameDisplayDurationMs: number;
};

export const DEFAULT_DRAW_SETTINGS: DrawSettings = {
  spinDurationMs: 10_000,
  nameDisplayDurationMs: 100,
};

export const DRAW_SETTINGS_LIMITS = {
  spinDurationMs: { min: 1_000, max: 60_000 },
  nameDisplayDurationMs: { min: 50, max: 2_000 },
} as const;

export type DrawSettingsStore = AdminSessionStore & {
  readDrawSettings(): Promise<DrawSettings>;
  updateDrawSettings(settings: DrawSettings): Promise<DrawSettings>;
};

export async function getDrawSettings({ store }: { store: Pick<DrawSettingsStore, "readDrawSettings"> }) {
  return store.readDrawSettings();
}

export async function saveDrawSettings({
  store,
  sessionId,
  settings,
  now = () => new Date(),
}: {
  store: DrawSettingsStore;
  sessionId?: string | null;
  settings: DrawSettings;
  now?: () => Date;
}): Promise<{ ok: true; settings: DrawSettings } | { ok: false; error: string }> {
  const updatedAt = now().toISOString();
  const session = await requireAdminSession({ store, sessionId, nowIso: updatedAt });
  if (!session) return { ok: false, error: "Admin login required." };

  const spinDurationMs = Math.round(settings.spinDurationMs);
  const nameDisplayDurationMs = Math.round(settings.nameDisplayDurationMs);
  const spinLimits = DRAW_SETTINGS_LIMITS.spinDurationMs;
  const nameLimits = DRAW_SETTINGS_LIMITS.nameDisplayDurationMs;

  if (
    !Number.isFinite(spinDurationMs)
    || spinDurationMs < spinLimits.min
    || spinDurationMs > spinLimits.max
    || !Number.isFinite(nameDisplayDurationMs)
    || nameDisplayDurationMs < nameLimits.min
    || nameDisplayDurationMs > nameLimits.max
  ) {
    return { ok: false, error: "Invalid lucky draw settings." };
  }

  return {
    ok: true,
    settings: await store.updateDrawSettings({ spinDurationMs, nameDisplayDurationMs }),
  };
}

type DrawSettingsRow = {
  draw_spin_duration_ms: number;
  draw_name_interval_ms: number;
};

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

export class SupabaseDrawSettingsStore implements DrawSettingsStore {
  private readonly auth = new SupabaseAdminAuthStore();

  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  findValidSession(sessionId: string, nowIso: string) {
    return this.auth.findValidSession(sessionId, nowIso);
  }

  async readDrawSettings(): Promise<DrawSettings> {
    const { data, error } = await this.supabase
      .from("event_settings")
      .select("draw_spin_duration_ms, draw_name_interval_ms")
      .eq("id", 1)
      .single<DrawSettingsRow>();

    if (error) throw new Error(error.message);
    return {
      spinDurationMs: data.draw_spin_duration_ms,
      nameDisplayDurationMs: data.draw_name_interval_ms,
    };
  }

  async updateDrawSettings(settings: DrawSettings): Promise<DrawSettings> {
    const { data, error } = await this.supabase
      .from("event_settings")
      .update({
        draw_spin_duration_ms: settings.spinDurationMs,
        draw_name_interval_ms: settings.nameDisplayDurationMs,
      })
      .eq("id", 1)
      .select("draw_spin_duration_ms, draw_name_interval_ms")
      .single<DrawSettingsRow>();

    if (error) throw new Error(error.message);
    return {
      spinDurationMs: data.draw_spin_duration_ms,
      nameDisplayDurationMs: data.draw_name_interval_ms,
    };
  }
}
