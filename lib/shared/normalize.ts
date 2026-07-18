// Single source of truth for domain normalization helpers.
// Previously duplicated across lib/admin.ts, lib/vendor.ts, and lib/delegate.ts.

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function normalizeRegistrationNumber(registrationNumber: string) {
  return registrationNumber.trim();
}

export function normalizeFullName(fullName: string) {
  return fullName.trim().replace(/\s+/g, " ");
}

export function normalizeStationId(stationId: string) {
  return stationId.trim();
}
