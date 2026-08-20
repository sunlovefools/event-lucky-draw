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
  displayOrder?: number;
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
  displayOrder,
  now = () => new Date(),
}: {
  store: StationsStore;
  sessionId?: string | null;
  name: string;
  active: boolean;
  displayOrder?: number;
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

  return { ok: true, station: await store.createStation({ name: validName.name, active, displayOrder }) };
}

export async function editStation({
  store,
  sessionId,
  stationId,
  name,
  active,
  displayOrder,
  now = () => new Date(),
}: {
  store: StationsStore;
  sessionId?: string | null;
  stationId: string;
  name: string;
  active: boolean;
  displayOrder?: number;
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

  if (displayOrder !== undefined) {
    if (!Number.isInteger(displayOrder) || displayOrder < 1) {
      return { ok: false, error: "Vendor position must be a positive whole number." };
    }
  }

  return {
    ok: true,
    station: await store.updateStation(normalizedStationId, {
      name: validName.name,
      active,
      ...(displayOrder === undefined ? {} : { displayOrder }),
    }),
  };
}

export async function reorderStations({
  store,
  sessionId,
  orderedStationIds,
  now = () => new Date(),
}: {
  store: StationsStore;
  sessionId?: string | null;
  orderedStationIds: string[];
  now?: () => Date;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAdminSession({ store, sessionId, nowIso: now().toISOString() });
  if (!session) {
    return { ok: false, error: "Admin login required." };
  }

  const normalizedIds = orderedStationIds
    .map((stationId) => normalizeStationId(String(stationId)))
    .filter((stationId): stationId is string => Boolean(stationId));

  if (normalizedIds.length === 0) {
    return { ok: false, error: "Choose at least one active booth for the vendor order." };
  }

  const uniqueIds = new Set(normalizedIds);
  if (uniqueIds.size !== normalizedIds.length) {
    return { ok: false, error: "Each active booth can only appear once in the vendor order." };
  }

  const allStations = await store.listStations();
  const activeStations = allStations.filter((station) => station.active && !isFinalSurveyStationName(station.name));

  if (normalizedIds.length !== activeStations.length) {
    return { ok: false, error: "All active booths must be included to update their positions." };
  }

  const activeById = new Map(activeStations.map((station) => [station.id, station]));

  for (const [positionIndex, stationId] of normalizedIds.entries()) {
    const station = activeById.get(stationId);
    if (!station) {
      return { ok: false, error: "One or more active booths were not found." };
    }

    const result = await store.updateStation(stationId, {
      name: station.name,
      active: station.active,
      displayOrder: positionIndex + 1,
    });

    if (!result) {
      return { ok: false, error: "Unable to update the booth order." };
    }
  }

  return { ok: true };
}

type SupabaseClientLike = ReturnType<typeof createSupabaseBrowserClient>;

type StationRow = {
  id: string;
  name: string;
  active: boolean;
  display_order: number;
};

export class SupabaseStationsStore implements StationsStore {
  private readonly auth = new SupabaseAdminAuthStore();

  constructor(private readonly supabase: SupabaseClientLike = createSupabaseBrowserClient()) {}

  findValidSession(sessionId: string, nowIso: string) {
    return this.auth.findValidSession(sessionId, nowIso);
  }

  async listStations(): Promise<Station[]> {
    const { data, error } = await this.supabase.from("stations").select("id, name, active, display_order").order("display_order").order("name");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(stationFromRow);
  }

  async findStationById(stationId: string): Promise<Station | null> {
    const { data, error } = await this.supabase
      .from("stations")
      .select("id, name, active, display_order")
      .eq("id", stationId)
      .maybeSingle<StationRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data ? stationFromRow(data) : null;
  }

  async createStation(station: StationInput): Promise<Station> {
    let displayOrder = station.displayOrder;
    if (!displayOrder) {
      const { data: lastStation, error: lastStationError } = await this.supabase
        .from("stations")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle<{ display_order: number }>();

      if (lastStationError) throw new Error(lastStationError.message);
      displayOrder = (lastStation?.display_order ?? 0) + 1;
    }

    const { data, error } = await this.supabase
      .from("stations")
      .insert({ name: station.name, active: station.active, display_order: displayOrder })
      .select("id, name, active, display_order")
      .single<StationRow>();

    if (error) {
      throw new Error(error.message);
    }

    return stationFromRow(data);
  }

  async updateStation(stationId: string, station: StationInput): Promise<Station> {
    const { data, error } = await this.supabase
      .from("stations")
      .update({ name: station.name, active: station.active, display_order: station.displayOrder })
      .eq("id", stationId)
      .select("id, name, active, display_order")
      .single<StationRow>();

    if (error) {
      throw new Error(error.message);
    }

    return stationFromRow(data);
  }
}
