import { createClient } from "@supabase/supabase-js";

import { readEnvironment } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const env = readEnvironment();

  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
