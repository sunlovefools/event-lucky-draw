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

    expect(result).toEqual({ ok: false, error: "Vendor account must be assigned to exactly one station." });
    expect(created).toBe(false);
  });
});
