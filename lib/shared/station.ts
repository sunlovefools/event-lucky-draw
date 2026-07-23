// Single source of truth for the Station domain concept.
// Admin stations and vendor stations share this exact shape.

export const FINAL_SURVEY_STATION_NAME = "Final Survey";

export type Station = {
  id: string;
  name: string;
  active: boolean;
};

function normalizeStationNameForComparison(name: string) {
  return name.trim().toLowerCase();
}

export function isFinalSurveyStationName(name: string) {
  return normalizeStationNameForComparison(name) === normalizeStationNameForComparison(FINAL_SURVEY_STATION_NAME);
}

export function sortStationsWithFinalSurveyLast<T extends { name: string }>(stations: T[]): T[] {
  return [...stations].sort((a, b) => {
    const aFinal = isFinalSurveyStationName(a.name);
    const bFinal = isFinalSurveyStationName(b.name);
    if (aFinal && !bFinal) return 1;
    if (!aFinal && bFinal) return -1;
    return a.name.localeCompare(b.name);
  });
}

type StationRow = {
  id: string;
  name: string;
  active: boolean;
};

export function stationFromRow(row: StationRow): Station {
  return { id: row.id, name: row.name, active: row.active };
}
