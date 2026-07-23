import type { VendorAuthStore } from "@/lib/auth/vendor-auth";
import type { VendorPortalStore } from "@/lib/vendor/portal";

export type VendorTestStore = VendorAuthStore & VendorPortalStore;

export function createStore(overrides: Partial<VendorTestStore> = {}): VendorTestStore {
  const store: VendorTestStore = {
    async findActiveVendorByUsername() {
      return null;
    },
    async createVendorSession(vendorId, expiresAt) {
      return { id: "vendor-session-1", vendorId, expiresAt };
    },
    async listActiveVendorSessions() {
      return [];
    },
    async revokeVendorSession() {},
    async findValidVendorSession() {
      return null;
    },
    async readParticipationOpen() {
      return true;
    },
    async findStationByName(stationName) {
      return { id: "station-1", name: stationName, active: true };
    },
    async listActiveStations() {
      return [{ id: "station-1", name: "AI Booth", active: true }];
    },
    async listStationScanHistory() {
      return [];
    },
    async findDelegateByRegistrationNumber() {
      return null;
    },
    async listDelegateStampStationIds() {
      return [];
    },
    async createDelegateStampIfMissing(delegateId, stationId, collectedAt) {
      return { created: true, stamp: { id: "stamp-1", delegateId, stationId, collectedAt } };
    },
    async markDelegateEligible() {},
    async recordScanAuditLog() {},
    ...overrides,
  };

  return store;
}
