import { createSupabaseBrowserClient } from "@/lib/supabase";
import { tryReadEnvironment } from "@/lib/env";

type HealthQuery = {
  select(columns: string): {
    limit(count: number): Promise<{ data: unknown; error: { message?: string } | null }>;
  };
};

export type HealthSupabaseClient = {
  from(table: string): HealthQuery;
};

export type HealthStatus = {
  ok: boolean;
  app: "event-lucky-draw";
  database: "reachable" | "unreachable" | "not-configured";
  checkedAt: string;
  error?: string;
};

export async function getHealthStatus(options: {
  supabase?: HealthSupabaseClient;
  now?: () => Date;
} = {}): Promise<HealthStatus> {
  const now = options.now ?? (() => new Date());
  const checkedAt = now().toISOString();

  if (!options.supabase && !tryReadEnvironment()) {
    return {
      ok: false,
      app: "event-lucky-draw",
      database: "not-configured",
      checkedAt,
      error: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  try {
    const supabase = options.supabase ?? createSupabaseBrowserClient();
    const { error } = await supabase.from("health_checks").select("id, checked_at").limit(1);

    if (error) {
      return {
        ok: false,
        app: "event-lucky-draw",
        database: "unreachable",
        checkedAt,
        error: error.message ?? "Supabase health check failed.",
      };
    }

    return {
      ok: true,
      app: "event-lucky-draw",
      database: "reachable",
      checkedAt,
    };
  } catch (error) {
    return {
      ok: false,
      app: "event-lucky-draw",
      database: "unreachable",
      checkedAt,
      error: error instanceof Error ? error.message : "Supabase health check failed.",
    };
  }
}
