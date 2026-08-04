import { createSupabaseBrowserClient } from "@/lib/supabase";
import { normalizeStationId } from "@/lib/shared/normalize";
import { isFinalSurveyStationName, stationFromRow, type Station } from "@/lib/shared/station";
import { requireAdminSession, type AdminSessionStore, SupabaseAdminAuthStore } from "@/lib/auth/admin-auth";

export type StationsStore = AdminSessionStore & {
  listStations(): Promise<Station[]>;
  findStationById(stationId: string): Promise<Station | null>;
  createStation(station: StationInput): Promise<Station>;
  updateStation(stationId: string, station: StationInput): Promise<Station>;
};

type StationInput = {
  name: string;
  active: boolean;
};

function validateStationName(name: string) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return { ok: false as const, error: "Station name is required." };
  }

  return { ok: true as const, name: normalizedName };
}

export async function createStation({
  store,
  sessionId,
  name,
  active,
  now = () => new Date(),
}: {
  store: StationsStore;
  sessionId?: string | null;
  name: string;
  active: boolean;
  now?: () => Date;
}): Promise<{ ok: true; station: Station } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const validName = validateStationName(name);
  if (!validName.ok) {
    return { ok: false, error: validName.error };
  }

  if (isFinalSurveyStationName(validName.name)) {
    return { ok: false, error: "The Final Survey Station is created automatically." };
  }

  return { ok: true, station: await store.createStation({ name: validName.name, active }) };
}

export async function editStation({
  store,
  sessionId,
  stationId,
  name,
  active,
  now = () => new Date(),
}: {
  store: StationsStore;
  sessionId?: string | null;
  stationId: string;
  name: string;
  active: boolean;
  now?: () => Date;
}): Promise<{ ok: true; station: Station } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const normalizedStationId = normalizeStationId(stationId);
  if (!normalizedStationId) {
    return { ok: false, error: "Station is required." };
  }

  const existingStation = await store.findStationById(normalizedStationId);
  if (!existingStation) {
    return { ok: false, error: "Station was not found." };
  }

  if (isFinalSurveyStationName(existingStation.name)) {
    return { ok: false, error: "The Final Survey Station cannot be changed." };
  }

  const validName = validateStationName(name);
  if (!validName.ok) {
    return { ok: false, error: validName.error };
  }

  if (isFinalSurveyStationName(validName.name)) {
    return { ok: false, error: "That name is reserved for the Final Survey Station." };
  }

  return {
    ok: true,
    station: await store.updateStation(normalizedStationId, { name: validName.name, active }),
  };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type StationRow = {
  id: string;
  name: string;
  active: boolean;
};

export class SupabaseStationsStore implements StationsStore {
  private readonly auth = new SupabaseAdminAuthStore();

  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  findValidSession(sessionId: string, nowIso: string) {
    return this.auth.findValidSession(sessionId, nowIso);
  }

  async listStations(): Promise<Station[]> {
    const { data, error } = await this.supabase.from("stations").select("id, name, active").order("name");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(stationFromRow);
  }

  async findStationById(stationId: string): Promise<Station | null> {
    const { data, error } = await this.supabase
      .from("stations")
      .select("id, name, active")
      .eq("id", stationId)
      .maybeSingle<StationRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? stationFromRow(data) : null;
  }

  async createStation(station: StationInput): Promise<Station> {
    const { data, error } = await this.supabase
      .from("stations")
      .insert({ name: station.name, active: station.active })
      .select("id, name, active")
      .single<StationRow>();

    if (error) {
      throw new Error(error.message);
    }

    return stationFromRow(data);
  }

  async updateStation(stationId: string, station: StationInput): Promise<Station> {
    const { data, error } = await this.supabase
      .from("stations")
      .update({ name: station.name, active: station.active })
      .eq("id", stationId)
      .select("id, name, active")
      .single<StationRow>();

    if (error) {
      throw new Error(error.message);
    }

    return stationFromRow(data);
  }
}
