// Single source of truth for the Station domain concept.
// Admin stations and vendor stations share this exact shape.

export type Station = {
  id: string;
  name: string;
  active: boolean;
};

type StationRow = {
  id: string;
  name: string;
  active: boolean;
};

export function stationFromRow(row: StationRow): Station {
  return { id: row.id, name: row.name, active: row.active };
}
