import { describe, expect, it } from "vitest";

import { createVendorAccount, editVendorAccount } from "@/lib/admin/vendors";
import { createStore } from "./test-stores";
import { hashPassword } from "@/lib/password";

describe("vendor account management", () => {
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
        passwordHash: hashPassword("station-secret", salt),
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

    expect(result).toEqual({ ok: false, error: "Station login must be assigned to exactly one exhibition station." });
    expect(created).toBe(false);
  });

  it("allows multiple vendor accounts, each linked to a different station", async () => {
    const created: Array<{ username: string; stationId: string }> = [];
    const store = createStore({
      async findValidSession() {
        return { id: "session-1", adminId: "admin-1", username: "organizer" };
      },
      async listVendorAccounts() {
        return [
          { id: "vendor-1", username: "ai-vendor", stationId: "station-1", stationName: "AI Booth", active: true },
        ];
      },
      async createVendorAccount(vendor) {
        created.push({ username: vendor.username, stationId: vendor.stationId });
        return { id: "vendor-2", username: vendor.username, stationId: vendor.stationId, stationName: "Cloud Booth", active: vendor.active };
      },
    });

    const result = await createVendorAccount({
      store,
      sessionId: "session-1",
      username: "cloud-vendor",
      password: "station-secret",
      stationId: "station-2",
      active: true,
    });

    expect(result).toEqual({
      ok: true,
      vendorAccount: { id: "vendor-2", username: "cloud-vendor", stationId: "station-2", stationName: "Cloud Booth", active: true },
    });
    expect(created).toEqual([{ username: "cloud-vendor", stationId: "station-2" }]);
  });

  it("prevents two vendors from sharing the same station", async () => {
    const store = createStore({
      async findValidSession() {
        return { id: "session-1", adminId: "admin-1", username: "organizer" };
      },
      async listVendorAccounts() {
        return [
          { id: "vendor-1", username: "ai-vendor", stationId: "station-1", stationName: "AI Booth", active: true },
        ];
      },
    });

    const result = await createVendorAccount({
      store,
      sessionId: "session-1",
      username: "second-vendor",
      password: "station-secret",
      stationId: "station-1",
      active: true,
    });

    expect(result).toEqual({ ok: false, error: "That exhibition station already has login credentials." });
  });

  it("lists active device sessions and can revoke one", async () => {
    const revoked: string[] = [];
    const store = createStore({
      async listActiveVendorSessions(vendorId, nowIso) {
        expect(vendorId).toBe("vendor-1");
        return [
          { id: "sess-1", vendorId: "vendor-1", createdAt: "2025-01-01T00:00:00.000Z", expiresAt: "2025-01-02T00:00:00.000Z" },
          { id: "sess-2", vendorId: "vendor-1", createdAt: "2025-01-01T00:05:00.000Z", expiresAt: "2025-01-02T00:00:00.000Z" },
        ];
      },
      async revokeVendorSession(sessionId, nowIso) {
        revoked.push(sessionId);
      },
    });

    const sessions = await store.listActiveVendorSessions("vendor-1", "2025-01-01T00:00:00.000Z");
    expect(sessions).toHaveLength(2);
    await store.revokeVendorSession("sess-1", "2025-01-01T12:00:00.000Z");
    expect(revoked).toEqual(["sess-1"]);
  });
});
