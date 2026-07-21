import type { AdminAuthStore } from "@/lib/auth/admin-auth";
import type { StationsStore } from "@/lib/admin/stations";
import type { VendorsStore } from "@/lib/admin/vendors";
import type { ParticipantsStore } from "@/lib/admin/participants";
import type { DrawStore } from "@/lib/admin/draw";
import type { DashboardStore } from "@/lib/admin/dashboard";

export type AdminTestStore = AdminAuthStore &
  StationsStore &
  VendorsStore &
  ParticipantsStore &
  DrawStore &
  DashboardStore;

export function createStore(overrides: Partial<AdminTestStore> = {}): AdminTestStore {
  const store: AdminTestStore = {
    async findActiveAdminByUsername() {
      return null;
    },
    async createAdminSession() {
      return {
        id: "session-1",
        adminId: "admin-1",
        expiresAt: "2025-01-02T00:00:00.000Z",
      };
    },
    async findValidSession() {
      return null;
    },
    async readParticipationState() {
      return {
        open: false,
        updatedAt: "2025-01-01T00:00:00.000Z",
        updatedByUsername: "organizer",
      };
    },
    async updateParticipationState(open, adminId, updatedAt) {
      return {
        open,
        updatedAt,
        updatedByUsername: adminId === "admin-1" ? "organizer" : null,
      };
    },
    async listStations() {
      return [];
    },
    async listVendorAccounts() {
      return [];
    },
    async listVendorSessions() {
      return [];
    },
    async createStation(station) {
      return { id: "station-1", name: station.name, active: station.active };
    },
    async updateStation(stationId, station) {
      return { id: stationId, name: station.name, active: station.active };
    },
    async createVendorAccount(vendor) {
      return {
        id: "vendor-1",
        username: vendor.username,
        stationId: vendor.stationId,
        stationName: "Demo station",
        active: vendor.active,
      };
    },
    async updateVendorAccount(vendorId, vendor) {
      return {
        id: vendorId,
        username: vendor.username,
        stationId: vendor.stationId,
        stationName: "Demo station",
        active: vendor.active,
      };
    },
    async listParticipants() {
      return [];
    },
    async listStationSummaries() {
      return [];
    },
    async listScanAuditLogs() {
      return [];
    },
    async listDrawRounds() {
      return [];
    },
    async getCurrentDrawRound() {
      return { id: "round-1", roundNumber: 1, openedAt: "2025-01-01T00:00:00.000Z", closedAt: null };
    },
    async listLuckyDrawCandidates(_roundId: string) {
      return [];
    },
    async tryRecordLuckyDrawWinner(delegateId, roundId, wonAt) {
      return {
        ok: true,
        winner: {
          id: "winner-1",
          delegateId,
          fullName: "Ada Lovelace",
          registrationNumber: "REG-001",
          roundId,
          roundNumber: 1,
          wonAt,
        },
      };
    },
    async closeCurrentRoundAndOpenNext(nowIso: string) {
      return { id: "round-2", roundNumber: 2, openedAt: nowIso, closedAt: null };
    },
    async deleteDrawRound(_roundId: string) {
      return;
    },
    async updateDelegateName(delegateId, fullName) {
      return {
        id: delegateId,
        fullName,
        registrationNumber: "REG-001",
        stampsCollected: 0,
        totalActiveStations: 0,
        surveySubmitted: false,
        drawStatus: "auto",
      };
    },
    async updateDelegateDrawStatus(delegateId, drawStatus) {
      return {
        id: delegateId,
        fullName: "Ada Lovelace",
        registrationNumber: "REG-001",
        stampsCollected: 0,
        totalActiveStations: 0,
        surveySubmitted: false,
        drawStatus,
      };
    },
    ...overrides,
  };

  return store;
}
