import { z } from "zod";

const environmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type AppEnvironment = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type EnvironmentSource = Record<string, string | undefined>;

export function readEnvironment(source: EnvironmentSource = process.env): AppEnvironment {
  const parsed = environmentSchema.parse(source);

  return {
    supabaseUrl: parsed.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function tryReadEnvironment(source: EnvironmentSource = process.env): AppEnvironment | null {
  const parsed = environmentSchema.safeParse(source);

  if (!parsed.success) {
    return null;
  }

  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
