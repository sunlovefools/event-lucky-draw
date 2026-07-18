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
    async findValidVendorSession() {
      return null;
    },
    async readParticipationOpen() {
      return true;
    },
    async findCurrentQrForStation() {
      return null;
    },
    async listStationScanHistory() {
      return [];
    },
    async invalidateCurrentQrForStation() {},
    async createStationQr(qr) {
      return {
        id: "qr-1",
        token: qr.token,
        stationId: qr.stationId,
        url: `/stamp/${qr.token}`,
        expiresAt: qr.expiresAt,
        invalidatedAt: null,
        consumedAt: null,
        status: "active",
      };
    },
    ...overrides,
  };

  return store;
}
