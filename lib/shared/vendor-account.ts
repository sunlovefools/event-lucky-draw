// Single source of truth for the admin-facing VendorAccount projection.
//
// Note: this is the admin's *view* of a vendor account (no secret material).
// The vendor's own auth-facing projection (with passwordHash/passwordSalt and a
// nested station) lives in lib/auth/vendor-auth.ts under the same VendorAccount
// name. They are intentionally distinct bounded-context projections, not drift.

export type VendorAccount = {
  id: string;
  username: string;
  stationId: string;
  stationName: string;
  active: boolean;
};

type VendorAccountRow = {
  id: string;
  username: string;
  station_id: string;
  active: boolean;
  stations?: { name: string } | { name: string }[] | null;
};

export function vendorAccountFromRow(row: VendorAccountRow): VendorAccount {
  const station = Array.isArray(row.stations) ? row.stations[0] : row.stations;
  return {
    id: row.id,
    username: row.username,
    stationId: row.station_id,
    stationName: station?.name ?? "Unassigned station",
    active: row.active,
  };
}
