import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AdminDashboard } from "@/app/admin/admin-dashboard";
import {
  authenticateAdmin,
  createStation,
  createVendorAccount,
  editStation,
  editVendorAccount,
  getAdminDashboard,
  hashAdminPassword,
  setParticipationState,
  type AdminStore,
} from "@/lib/admin";

function createStore(overrides: Partial<AdminStore> = {}): AdminStore {
  const store: AdminStore = {
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
    ...overrides,
  };

  return store;
}

describe("admin username/password login", () => {
  it("creates an admin session when the username and password match an active admin account", async () => {
    const salt = "login-salt";
    const passwordHash = hashAdminPassword("correct horse battery staple", salt);

    const result = await authenticateAdmin({
      store: createStore({
        async findActiveAdminByUsername(username) {
          expect(username).toBe("organizer");
          return { id: "admin-1", username: "organizer", passwordHash, passwordSalt: salt };
        },
      }),
      username: " organizer ",
      password: "correct horse battery staple",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      session: {
        id: "session-1",
        adminId: "admin-1",
        expiresAt: "2025-01-02T00:00:00.000Z",
      },
    });
  });

  it("rejects invalid credentials without creating a session", async () => {
    const salt = "login-salt";
    const passwordHash = hashAdminPassword("expected-password", salt);
    let createdSession = false;

    const result = await authenticateAdmin({
      store: createStore({
        async findActiveAdminByUsername() {
          return { id: "admin-1", username: "organizer", passwordHash, passwordSalt: salt };
        },
        async createAdminSession() {
          createdSession = true;
          throw new Error("should not create a session");
        },
      }),
      username: "organizer",
      password: "wrong-password",
    });

    expect(result).toEqual({ ok: false, error: "Invalid username or password." });
    expect(createdSession).toBe(false);
  });
});

describe("protected admin dashboard", () => {
  it("blocks dashboard data when there is no valid admin session", async () => {
    const result = await getAdminDashboard({ store: createStore(), sessionId: "missing" });

    expect(result).toEqual({ authorized: false });
  });

  it("returns the visible participation state for a valid admin session", async () => {
    const result = await getAdminDashboard({
      store: createStore({
        async findValidSession(sessionId) {
          expect(sessionId).toBe("session-1");
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async readParticipationState() {
          return {
            open: true,
            updatedAt: "2025-01-01T00:00:00.000Z",
            updatedByUsername: "organizer",
          };
        },
      }),
      sessionId: "session-1",
    });

    expect(result).toEqual({
      authorized: true,
      admin: { id: "admin-1", username: "organizer" },
      participation: {
        open: true,
        updatedAt: "2025-01-01T00:00:00.000Z",
        updatedByUsername: "organizer",
      },
      stations: [],
      vendorAccounts: [],
    });
  });
});

describe("station and vendor management", () => {
  it("includes stations and vendor account assignments on the protected dashboard", async () => {
    const result = await getAdminDashboard({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async listStations() {
          return [
            { id: "station-1", name: "AI Booth", active: true },
            { id: "station-2", name: "Cloud Booth", active: false },
          ];
        },
        async listVendorAccounts() {
          return [
            {
              id: "vendor-1",
              username: "ai-vendor",
              stationId: "station-1",
              stationName: "AI Booth",
              active: true,
            },
          ];
        },
      }),
      sessionId: "session-1",
    });

    expect(result).toMatchObject({
      authorized: true,
      stations: [
        { id: "station-1", name: "AI Booth", active: true },
        { id: "station-2", name: "Cloud Booth", active: false },
      ],
      vendorAccounts: [
        {
          id: "vendor-1",
          username: "ai-vendor",
          stationId: "station-1",
          stationName: "AI Booth",
          active: true,
        },
      ],
    });
  });

  it("lets an authenticated admin create and edit active or disabled stations", async () => {
    const createdStations: Array<{ name: string; active: boolean }> = [];
    const updatedStations: Array<{ stationId: string; name: string; active: boolean }> = [];
    const store = createStore({
      async findValidSession() {
        return { id: "session-1", adminId: "admin-1", username: "organizer" };
      },
      async createStation(station) {
        createdStations.push(station);
        return { id: "station-1", ...station };
      },
      async updateStation(stationId, station) {
        updatedStations.push({ stationId, ...station });
        return { id: stationId, ...station };
      },
    });

    const created = await createStation({ store, sessionId: "session-1", name: " AI Booth ", active: true });
    const edited = await editStation({
      store,
      sessionId: "session-1",
      stationId: "station-1",
      name: "AI Experience Booth",
      active: false,
    });

    expect(created).toEqual({ ok: true, station: { id: "station-1", name: "AI Booth", active: true } });
    expect(edited).toEqual({
      ok: true,
      station: { id: "station-1", name: "AI Experience Booth", active: false },
    });
    expect(createdStations).toEqual([{ name: "AI Booth", active: true }]);
    expect(updatedStations).toEqual([{ stationId: "station-1", name: "AI Experience Booth", active: false }]);
  });

  it("lets an authenticated admin create and edit vendor accounts assigned to exactly one station", async () => {
    const salt = "vendor-salt";
    const createdVendors: Array<{
      username: string;
      stationId: string;
      passwordHash: string;
      passwordSalt: string;
      active: boolean;
    }> = [];
    const updatedVendors: Array<{ vendorId: string; username: string; stationId: string; active: boolean }> = [];
    const store = createStore({
      async findValidSession() {
        return { id: "session-1", adminId: "admin-1", username: "organizer" };
      },
      async createVendorAccount(vendor) {
        createdVendors.push(vendor);
        return {
          id: "vendor-1",
          username: vendor.username,
          stationId: vendor.stationId,
          stationName: "AI Booth",
          active: vendor.active,
        };
      },
      async updateVendorAccount(vendorId, vendor) {
        updatedVendors.push({ vendorId, username: vendor.username, stationId: vendor.stationId, active: vendor.active });
        return {
          id: vendorId,
          username: vendor.username,
          stationId: vendor.stationId,
          stationName: "Cloud Booth",
          active: vendor.active,
        };
      },
    });

    const created = await createVendorAccount({
      store,
      sessionId: "session-1",
      username: " AI-Vendor ",
      password: "station-secret",
      stationId: "station-1",
      active: true,
      newSalt: () => salt,
    });
    const edited = await editVendorAccount({
      store,
      sessionId: "session-1",
      vendorId: "vendor-1",
      username: "cloud-vendor",
      stationId: "station-2",
      active: false,
    });

    expect(created).toEqual({
      ok: true,
      vendorAccount: {
        id: "vendor-1",
        username: "ai-vendor",
        stationId: "station-1",
        stationName: "AI Booth",
        active: true,
      },
    });
    expect(edited).toEqual({
      ok: true,
      vendorAccount: {
        id: "vendor-1",
        username: "cloud-vendor",
        stationId: "station-2",
        stationName: "Cloud Booth",
        active: false,
      },
    });
    expect(createdVendors).toEqual([
      {
        username: "ai-vendor",
        stationId: "station-1",
        passwordHash: hashAdminPassword("station-secret", salt),
        passwordSalt: salt,
        active: true,
      },
    ]);
    expect(updatedVendors).toEqual([
      { vendorId: "vendor-1", username: "cloud-vendor", stationId: "station-2", active: false },
    ]);
  });

  it("rejects vendor accounts without one station assignment", async () => {
    let created = false;

    const result = await createVendorAccount({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async createVendorAccount() {
          created = true;
          throw new Error("should not create vendor");
        },
      }),
      sessionId: "session-1",
      username: "vendor",
      password: "station-secret",
      stationId: "",
      active: true,
    });

    expect(result).toEqual({ ok: false, error: "Vendor account must be assigned to exactly one station." });
    expect(created).toBe(false);
  });
});

describe("participation control", () => {
  it("lets an authenticated admin close and reopen participation", async () => {
    const store = createStore({
      async findValidSession() {
        return { id: "session-1", adminId: "admin-1", username: "organizer" };
      },
    });

    const closed = await setParticipationState({
      store,
      sessionId: "session-1",
      open: false,
      now: () => new Date("2025-01-01T00:10:00.000Z"),
    });
    const reopened = await setParticipationState({
      store,
      sessionId: "session-1",
      open: true,
      now: () => new Date("2025-01-01T00:11:00.000Z"),
    });

    expect(closed).toEqual({
      ok: true,
      participation: {
        open: false,
        updatedAt: "2025-01-01T00:10:00.000Z",
        updatedByUsername: "organizer",
      },
    });
    expect(reopened).toEqual({
      ok: true,
      participation: {
        open: true,
        updatedAt: "2025-01-01T00:11:00.000Z",
        updatedByUsername: "organizer",
      },
    });
  });

  it("does not let an unauthenticated request change participation", async () => {
    let updated = false;

    const result = await setParticipationState({
      store: createStore({
        async updateParticipationState() {
          updated = true;
          throw new Error("should not update");
        },
      }),
      sessionId: "missing",
      open: false,
    });

    expect(result).toEqual({ ok: false, error: "Admin login required." });
    expect(updated).toBe(false);
  });
});

describe("admin dashboard UI", () => {
  it("shows a protected login prompt to visitors", () => {
    render(<AdminDashboard dashboard={{ authorized: false }} />);

    expect(screen.getByRole("heading", { name: "Admin login" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows participation controls and persisted closed state to admins", () => {
    render(
      <AdminDashboard
        dashboard={{
          authorized: true,
          admin: { id: "admin-1", username: "organizer" },
          participation: {
            open: false,
            updatedAt: "2025-01-01T00:10:00.000Z",
            updatedByUsername: "organizer",
          },
          stations: [],
          vendorAccounts: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Admin dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Signed in as organizer")).toBeInTheDocument();
    expect(screen.getByText("Participation is closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open participation" })).toBeInTheDocument();
    expect(screen.getByText("Last changed by organizer at 2025-01-01T00:10:00.000Z")).toBeInTheDocument();
  });

  it("shows station and vendor management to admins", () => {
    render(
      <AdminDashboard
        dashboard={{
          authorized: true,
          admin: { id: "admin-1", username: "organizer" },
          participation: {
            open: true,
            updatedAt: "2025-01-01T00:10:00.000Z",
            updatedByUsername: "organizer",
          },
          stations: [
            { id: "station-1", name: "AI Booth", active: true },
            { id: "station-2", name: "Cloud Booth", active: false },
          ],
          vendorAccounts: [
            {
              id: "vendor-1",
              username: "ai-vendor",
              stationId: "station-1",
              stationName: "AI Booth",
              active: true,
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Stations" })).toBeInTheDocument();
    expect(screen.getByLabelText("New station name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create station" })).toBeInTheDocument();
    expect(screen.getByText("AI Booth — active")).toBeInTheDocument();
    expect(screen.getByText("Cloud Booth — disabled")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Save station" })).toHaveLength(2);

    expect(screen.getByRole("heading", { name: "Vendor accounts" })).toBeInTheDocument();
    expect(screen.getByLabelText("New vendor username")).toBeInTheDocument();
    expect(screen.getByLabelText("New vendor password")).toBeInTheDocument();
    expect(screen.getByLabelText("New vendor station")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create vendor" })).toBeInTheDocument();
    expect(screen.getByText("ai-vendor — AI Booth — active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save vendor" })).toBeInTheDocument();
  });
});
