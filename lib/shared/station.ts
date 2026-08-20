// Single source of truth for the Station domain concept.
// Admin stations and vendor stations share this exact shape.

export const FINAL_SURVEY_STATION_NAME = "Final Survey Station";
const LEGACY_FINAL_SURVEY_STATION_NAME = "Final Survey";

export type Station = {
  id: string;
  name: string;
  active: boolean;
  displayOrder?: number;
};

function normalizeStationNameForComparison(name: string) {
  return name.trim().toLowerCase();
}

export function isFinalSurveyStationName(name: string) {
  const normalizedName = normalizeStationNameForComparison(name);
  return [FINAL_SURVEY_STATION_NAME, LEGACY_FINAL_SURVEY_STATION_NAME]
    .map(normalizeStationNameForComparison)
    .includes(normalizedName);
}

export function sortStationsWithFinalSurveyLast<T extends { name: string }>(stations: T[]): T[] {
  return [...stations].sort((a, b) => {
    const aFinal = isFinalSurveyStationName(a.name);
    const bFinal = isFinalSurveyStationName(b.name);
    if (aFinal && !bFinal) return 1;
    if (!aFinal && bFinal) return -1;
    const aOrder = "displayOrder" in a && typeof a.displayOrder === "number" ? a.displayOrder : Number.MAX_SAFE_INTEGER;
    const bOrder = "displayOrder" in b && typeof b.displayOrder === "number" ? b.displayOrder : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.name.localeCompare(b.name);
  });
}

type StationRow = {
  id: string;
  name: string;
  active: boolean;
  display_order: number;
};

export function stationFromRow(row: StationRow): Station {
  return { id: row.id, name: row.name, active: row.active, displayOrder: row.display_order };
}
