// Single source of truth for domain normalization helpers.
// Previously duplicated across lib/admin.ts, lib/vendor.ts, and lib/delegate.ts.

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function normalizeRegistrationNumber(registrationNumber: string) {
  return registrationNumber.trim().toUpperCase();
}

// Keep `ilike` exact: these characters otherwise act as SQL pattern syntax.
export function escapePostgresLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function normalizeFullName(fullName: string) {
  return fullName.trim().replace(/\s+/g, " ");
}

export function normalizeTitle(title: string) {
  return title.trim().replace(/\s+/g, " ");
}

export function normalizeStationId(stationId: string) {
  return stationId.trim();
}
