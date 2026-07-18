import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { VendorPortal } from "@/app/vendor/vendor-portal";
import {
  authenticateVendor,
  generateStationQr,
  getVendorDashboard,
  hashVendorPassword,
  type VendorStore,
} from "@/lib/vendor";

function createStore(overrides: Partial<VendorStore> = {}): VendorStore {
  const store: VendorStore = {
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

describe("vendor username/password login", () => {
  it("creates a vendor session when credentials match an active vendor account", async () => {
    const salt = "vendor-salt";
    const passwordHash = hashVendorPassword("station-secret", salt);

    const result = await authenticateVendor({
      store: createStore({
        async findActiveVendorByUsername(username) {
          expect(username).toBe("ai-vendor");
          return {
            id: "vendor-1",
            username: "ai-vendor",
            passwordHash,
            passwordSalt: salt,
            station: { id: "station-1", name: "AI Booth", active: true },
          };
        },
      }),
      username: " AI-Vendor ",
      password: "station-secret",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      session: { id: "vendor-session-1", vendorId: "vendor-1", expiresAt: "2025-01-02T00:00:00.000Z" },
    });
  });

  it("rejects invalid vendor credentials without creating a session", async () => {
    const salt = "vendor-salt";
    const passwordHash = hashVendorPassword("station-secret", salt);
    let created = false;

    const result = await authenticateVendor({
      store: createStore({
        async findActiveVendorByUsername() {
          return {
            id: "vendor-1",
            username: "ai-vendor",
            passwordHash,
            passwordSalt: salt,
            station: { id: "station-1", name: "AI Booth", active: true },
          };
        },
        async createVendorSession() {
          created = true;
          throw new Error("should not create session");
        },
      }),
      username: "ai-vendor",
      password: "wrong-password",
    });

    expect(result).toEqual({ ok: false, error: "Invalid username or password." });
    expect(created).toBe(false);
  });
});

describe("vendor portal dashboard", () => {
  it("blocks portal data without a valid vendor session", async () => {
    const result = await getVendorDashboard({ store: createStore(), sessionId: "missing" });

    expect(result).toEqual({ authorized: false });
  });

  it("lands an authenticated vendor on their assigned station", async () => {
    const result = await getVendorDashboard({
      store: createStore({
        async findValidVendorSession(sessionId) {
          expect(sessionId).toBe("vendor-session-1");
          return {
            id: "vendor-session-1",
            vendor: {
              id: "vendor-1",
              username: "ai-vendor",
              station: { id: "station-1", name: "AI Booth", active: true },
            },
          };
        },
      }),
      sessionId: "vendor-session-1",
    });

    expect(result).toEqual({
      authorized: true,
      vendor: { id: "vendor-1", username: "ai-vendor" },
      station: { id: "station-1", name: "AI Booth", active: true },
      participationOpen: true,
      currentQr: null,
      scanHistory: [],
    });
  });

  it("returns consumed QR status and full station scan history for polling", async () => {
    const result = await getVendorDashboard({
      store: createStore({
        async findValidVendorSession() {
          return {
            id: "vendor-session-1",
            vendor: {
              id: "vendor-1",
              username: "ai-vendor",
              station: { id: "station-1", name: "AI Booth", active: true },
            },
          };
        },
        async findCurrentQrForStation(stationId) {
          expect(stationId).toBe("station-1");
          return {
            id: "qr-1",
            token: "secure-token",
            stationId,
            url: "/stamp/secure-token",
            expiresAt: "2025-01-01T00:02:00.000Z",
            invalidatedAt: null,
            consumedAt: "2025-01-01T00:01:00.000Z",
            status: "consumed",
            scannedByFullName: "Ada Lovelace",
          };
        },
        async listStationScanHistory(stationId) {
          expect(stationId).toBe("station-1");
          return [
            {
              id: "stamp-1",
              delegateFullName: "Ada Lovelace",
              stationId: "station-1",
              stationName: "AI Booth",
              collectedAt: "2025-01-01T00:01:00.000Z",
            },
            {
              id: "stamp-2",
              delegateFullName: "Grace Hopper",
              stationId: "station-1",
              stationName: "AI Booth",
              collectedAt: "2025-01-01T00:03:00.000Z",
            },
          ];
        },
      }),
      sessionId: "vendor-session-1",
      now: () => new Date("2025-01-01T00:04:00.000Z"),
    });

    expect(result).toMatchObject({
      authorized: true,
      currentQr: {
        status: "consumed",
        scannedByFullName: "Ada Lovelace",
        consumedAt: "2025-01-01T00:01:00.000Z",
      },
      scanHistory: [
        { delegateFullName: "Ada Lovelace", collectedAt: "2025-01-01T00:01:00.000Z" },
        { delegateFullName: "Grace Hopper", collectedAt: "2025-01-01T00:03:00.000Z" },
      ],
    });
  });
});

describe("manual station QR generation", () => {
  it("creates a short-lived one-time QR URL for the vendor's assigned station", async () => {
    const result = await generateStationQr({
      store: createStore({
        async findValidVendorSession() {
          return {
            id: "vendor-session-1",
            vendor: {
              id: "vendor-1",
              username: "ai-vendor",
              station: { id: "station-1", name: "AI Booth", active: true },
            },
          };
        },
      }),
      sessionId: "vendor-session-1",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
      newToken: () => "secure-token",
    });

    expect(result).toEqual({
      ok: true,
      qr: {
        id: "qr-1",
        token: "secure-token",
        stationId: "station-1",
        url: "/stamp/secure-token",
        expiresAt: "2025-01-01T00:02:00.000Z",
        invalidatedAt: null,
        consumedAt: null,
        status: "active",
      },
    });
  });

  it("regeneration invalidates the previous QR before creating a replacement", async () => {
    const calls: string[] = [];

    await generateStationQr({
      store: createStore({
        async findValidVendorSession() {
          return {
            id: "vendor-session-1",
            vendor: {
              id: "vendor-1",
              username: "ai-vendor",
              station: { id: "station-1", name: "AI Booth", active: true },
            },
          };
        },
        async invalidateCurrentQrForStation(stationId, invalidatedAt) {
          calls.push(`invalidate ${stationId} ${invalidatedAt}`);
        },
        async createStationQr(qr) {
          calls.push(`create ${qr.stationId} ${qr.token}`);
          return {
            id: "qr-2",
            token: qr.token,
            stationId: qr.stationId,
            url: `/stamp/${qr.token}`,
            expiresAt: qr.expiresAt,
            invalidatedAt: null,
            consumedAt: null,
            status: "active",
          };
        },
      }),
      sessionId: "vendor-session-1",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
      newToken: () => "replacement-token",
    });

    expect(calls).toEqual([
      "invalidate station-1 2025-01-01T00:00:00.000Z",
      "create station-1 replacement-token",
    ]);
  });

  it("blocks QR generation when participation is closed", async () => {
    let created = false;

    const result = await generateStationQr({
      store: createStore({
        async findValidVendorSession() {
          return {
            id: "vendor-session-1",
            vendor: {
              id: "vendor-1",
              username: "ai-vendor",
              station: { id: "station-1", name: "AI Booth", active: true },
            },
          };
        },
        async readParticipationOpen() {
          return false;
        },
        async createStationQr() {
          created = true;
          throw new Error("should not create QR while participation is closed");
        },
      }),
      sessionId: "vendor-session-1",
    });

    expect(result).toEqual({ ok: false, error: "Participation is closed." });
    expect(created).toBe(false);
  });
});

describe("vendor portal UI", () => {
  it("shows a protected login prompt to visitors", () => {
    render(<VendorPortal dashboard={{ authorized: false }} />);

    expect(screen.getByRole("heading", { name: "Vendor login" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows the assigned station and QR generation controls to vendors", () => {
    render(
      <VendorPortal
        dashboard={{
          authorized: true,
          vendor: { id: "vendor-1", username: "ai-vendor" },
          station: { id: "station-1", name: "AI Booth", active: true },
          participationOpen: true,
          currentQr: {
            id: "qr-1",
            token: "secure-token",
            stationId: "station-1",
            url: "/stamp/secure-token",
            expiresAt: "2025-01-01T00:02:00.000Z",
            invalidatedAt: null,
            consumedAt: null,
            status: "active",
          },
          scanHistory: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "AI Booth" })).toBeInTheDocument();
    expect(screen.getByText("Signed in as ai-vendor"));
    expect(screen.getByRole("button", { name: "Generate new QR" })).toBeInTheDocument();
    expect(screen.getByText("/stamp/secure-token")).toBeInTheDocument();
    expect(screen.getByText("Status: active")).toBeInTheDocument();
    expect(screen.getByText("Expires at 2025-01-01T00:02:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("Updates every 5 seconds.")).toBeInTheDocument();
  });

  it("shows expired QR status", () => {
    render(
      <VendorPortal
        dashboard={{
          authorized: true,
          vendor: { id: "vendor-1", username: "ai-vendor" },
          station: { id: "station-1", name: "AI Booth", active: true },
          participationOpen: true,
          currentQr: {
            id: "qr-1",
            token: "expired-token",
            stationId: "station-1",
            url: "/stamp/expired-token",
            expiresAt: "2025-01-01T00:02:00.000Z",
            invalidatedAt: null,
            consumedAt: null,
            status: "expired",
          },
          scanHistory: [],
        }}
      />,
    );

    expect(screen.getByText("Status: expired")).toBeInTheDocument();
  });

  it("shows consumed status and station scan history with delegate names and timestamps", () => {
    render(
      <VendorPortal
        dashboard={{
          authorized: true,
          vendor: { id: "vendor-1", username: "ai-vendor" },
          station: { id: "station-1", name: "AI Booth", active: true },
          participationOpen: true,
          currentQr: {
            id: "qr-1",
            token: "secure-token",
            stationId: "station-1",
            url: "/stamp/secure-token",
            expiresAt: "2025-01-01T00:02:00.000Z",
            invalidatedAt: null,
            consumedAt: "2025-01-01T00:01:00.000Z",
            status: "consumed",
            scannedByFullName: "Ada Lovelace",
          },
          scanHistory: [
            {
              id: "stamp-1",
              delegateFullName: "Ada Lovelace",
              stationId: "station-1",
              stationName: "AI Booth",
              collectedAt: "2025-01-01T00:01:00.000Z",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Status: consumed")).toBeInTheDocument();
    expect(screen.getByText("Scanned by Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Station scan history" })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace — 2025-01-01T00:01:00.000Z")).toBeInTheDocument();
  });

  it("explains when QR generation is blocked because participation is closed", () => {
    render(
      <VendorPortal
        dashboard={{
          authorized: true,
          vendor: { id: "vendor-1", username: "ai-vendor" },
          station: { id: "station-1", name: "AI Booth", active: true },
          participationOpen: false,
          currentQr: null,
          scanHistory: [],
        }}
      />,
    );

    expect(screen.getByText("Participation is closed. QR generation is disabled.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate new QR" })).not.toBeInTheDocument();
  });
});
