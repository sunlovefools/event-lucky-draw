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
    async listStationScanHistory() {
      return [];
    },
    async findDelegateByRegistrationNumber() {
      return null;
    },
    async createDelegateStampIfMissing(delegateId, stationId, collectedAt) {
      return { created: true, stamp: { id: "stamp-1", delegateId, stationId, collectedAt } };
    },
    async recordScanAuditLog() {},
    ...overrides,
  };

  return store;
}
