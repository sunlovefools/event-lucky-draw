import { createSupabaseBrowserClient } from "@/lib/supabase";

export type ParticipationStore = {
  readParticipationOpen(): Promise<boolean>;
};

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type EventSettingsRow = {
  participation_open: boolean;
};

export async function readParticipationOpen(supabase: SupabaseClientLike): Promise<boolean> {
  const { data, error } = await supabase
    .from("event_settings")
    .select("participation_open")
    .eq("id", 1)
    .single<EventSettingsRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data.participation_open;
}

export class SupabaseParticipationStore implements ParticipationStore {
  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  readParticipationOpen(): Promise<boolean> {
    return readParticipationOpen(this.supabase);
  }
}
