import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { VendorPortal } from "@/app/vendor/vendor-portal";
import { VendorScanner } from "@/app/vendor/vendor-scanner";
import { getVendorDashboard, getStationDashboard, collectStampFromVendorScan } from "@/lib/vendor/portal";
import { createStore } from "./test-stores";

const vendorSession = {
  id: "vendor-session-1",
  vendor: { id: "vendor-1", username: "ai-vendor", station: { id: "station-1", name: "AI Booth", active: true } },
};

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
          return vendorSession;
        },
      }),
      sessionId: "vendor-session-1",
    });

    expect(result).toEqual({
      authorized: true,
      vendor: { id: "vendor-1", username: "ai-vendor" },
      station: { id: "station-1", name: "AI Booth", active: true },
      participationOpen: true,
      scanHistory: [],
    });
  });

  it("returns full station scan history for polling", async () => {
    const result = await getStationDashboard({
      store: createStore({
        async findStationByName(stationName) {
          expect(stationName).toBe("AI Booth");
          return { id: "station-1", name: "AI Booth", active: true };
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
      stationName: "AI%20Booth",
    });

    expect(result).toMatchObject({
      found: true,
      scanHistory: [
        { delegateFullName: "Ada Lovelace", collectedAt: "2025-01-01T00:01:00.000Z" },
        { delegateFullName: "Grace Hopper", collectedAt: "2025-01-01T00:03:00.000Z" },
      ],
    });
  });
});

describe("vendor stamp scan", () => {
  it("stamps a registered delegate for the vendor's station and shows the success message", async () => {
    const result = await collectStampFromVendorScan({
      store: createStore({
        async findDelegateByRegistrationNumber(reg) {
          expect(reg).toBe("REG-001");
          return { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" };
        },
        async createDelegateStampIfMissing(delegateId, stationId, collectedAt) {
          return { created: true, stamp: { id: "stamp-1", delegateId, stationId, collectedAt } };
        },
      }),
      session: vendorSession,
      badgePayload: "REG-001",
    });

    expect(result).toEqual({
      ok: true,
      delegate: { fullName: "Ada Lovelace" },
      duplicate: false,
      message: "Successful Stamped Ada Lovelace QR! Ask him/her to refresh their page to look at the stamp!",
    });
  });

  it("treats a second scan of the same delegate as a duplicate", async () => {
    const result = await collectStampFromVendorScan({
      store: createStore({
        async findDelegateByRegistrationNumber() {
          return { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" };
        },
        async createDelegateStampIfMissing() {
          return { created: false, stamp: null };
        },
      }),
      session: vendorSession,
      badgePayload: "REG-001",
    });

    expect(result).toEqual({
      ok: true,
      delegate: { fullName: "Ada Lovelace" },
      duplicate: true,
      message: "Ada Lovelace was already collected at this station.",
    });
  });

  it("locks the Final Survey station until every other station is complete", async () => {
    let stamped = false;

    const result = await collectStampFromVendorScan({
      store: createStore({
        async findDelegateByRegistrationNumber() {
          return { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" };
        },
        async listActiveStations() {
          return [
            { id: "station-1", name: "AI Booth", active: true },
            { id: "final-survey", name: "Final Survey", active: true },
          ];
        },
        async listDelegateStampStationIds() {
          return [];
        },
        async createDelegateStampIfMissing() {
          stamped = true;
          throw new Error("should not stamp a locked final station");
        },
      }),
      session: { ...vendorSession, vendor: { ...vendorSession.vendor, station: { id: "final-survey", name: "Final Survey", active: true } } },
      badgePayload: "REG-001",
    });

    expect(result).toEqual({
      ok: false,
      reason: "locked",
      error: "Final Survey is locked. Complete all other stations first, then scan this station.",
    });
    expect(stamped).toBe(false);
  });

  it("marks the delegate eligible when the unlocked Final Survey station is scanned", async () => {
    const markedEligible: Array<{ delegateId: string; eligibleAt: string }> = [];

    const result = await collectStampFromVendorScan({
      store: createStore({
        async findDelegateByRegistrationNumber() {
          return { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" };
        },
        async listActiveStations() {
          return [
            { id: "station-1", name: "AI Booth", active: true },
            { id: "final-survey", name: "Final Survey", active: true },
          ];
        },
        async listDelegateStampStationIds() {
          return ["station-1"];
        },
        async createDelegateStampIfMissing(delegateId, stationId, collectedAt) {
          return { created: true, stamp: { id: "stamp-final", delegateId, stationId, collectedAt } };
        },
        async markDelegateEligible(delegateId, eligibleAt) {
          markedEligible.push({ delegateId, eligibleAt });
        },
      }),
      session: { ...vendorSession, vendor: { ...vendorSession.vendor, station: { id: "final-survey", name: "Final Survey", active: true } } },
      badgePayload: "REG-001",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      delegate: { fullName: "Ada Lovelace" },
      duplicate: false,
      message: "Ada Lovelace completed the Final Survey station and is entered into the lucky draw.",
    });
    expect(markedEligible).toEqual([{ delegateId: "delegate-1", eligibleAt: "2025-01-01T00:00:00.000Z" }]);
  });

  it("rejects a badge for a delegate who hasn't registered yet", async () => {
    const result = await collectStampFromVendorScan({
      store: createStore({
        async findDelegateByRegistrationNumber() {
          return null;
        },
      }),
      session: vendorSession,
      badgePayload: "REG-999",
    });

    expect(result).toEqual({
      ok: false,
      reason: "not-registered",
      error: "Delegate not registered — ask them to register first.",
    });
  });

  it("rejects an invalid (empty) badge payload", async () => {
    const result = await collectStampFromVendorScan({
      store: createStore(),
      session: vendorSession,
      badgePayload: "   ",
    });

    expect(result).toEqual({
      ok: false,
      reason: "invalid",
      error: "This QR isn't a valid delegate badge.",
    });
  });

  it("blocks stamping when participation is closed", async () => {
    const result = await collectStampFromVendorScan({
      store: createStore({
        async readParticipationOpen() {
          return false;
        },
        async findDelegateByRegistrationNumber() {
          return { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" };
        },
      }),
      session: vendorSession,
      badgePayload: "REG-001",
    });

    expect(result).toEqual({
      ok: false,
      reason: "closed",
      error: "Participation is closed.",
    });
  });
});

describe("vendor portal UI", () => {
  it("shows the assigned station and a badge scanner for vendors", () => {
    render(
      <VendorPortal
        dashboard={{
          found: true,
          station: { id: "station-1", name: "AI Booth", active: true },
          participationOpen: true,
          scanHistory: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "AI Booth" })).toBeInTheDocument();
    expect(screen.getAllByText(/Use this station link to stamp delegates/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Scan the delegate's badge QR/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Allow camera access" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh list" })).toBeInTheDocument();
  });

  it("keeps the QR reader mounted while requesting camera access", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({}) },
    });

    render(<VendorScanner participationOpen={true} stationName="AI Booth" />);

    fireEvent.click(screen.getByRole("button", { name: "Allow camera access" }));

    expect(document.getElementById("vendor-qr-reader")).toBeInTheDocument();
    expect(screen.getByText("Requesting camera permission…")).toBeInTheDocument();
  });

  it("explains when stamping is blocked because participation is closed", () => {
    render(
      <VendorPortal
        dashboard={{
          found: true,
          station: { id: "station-1", name: "AI Booth", active: true },
          participationOpen: false,
          scanHistory: [],
        }}
      />,
    );

    expect(screen.getByText(/Participation is closed, so stamps can't be collected/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Allow camera access" })).not.toBeInTheDocument();
  });

  it("shows the result banner after manually stamping without changing the hook order", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({ ok: true, duplicate: false, message: "Stamped Ada Lovelace." }),
    } as Response);

    try {
      render(<VendorScanner participationOpen={true} stationName="AI Booth" />);

      fireEvent.click(screen.getByRole("button", { name: "Type code instead" }));
      fireEvent.change(screen.getByLabelText("Badge code"), { target: { value: "REG-001" } });
      fireEvent.click(screen.getByRole("button", { name: "Stamp delegate" }));

      await waitFor(() => expect(screen.getByText(/Stamped Ada Lovelace/i)).toBeInTheDocument());
      expect(fetchMock).toHaveBeenCalledWith("/station/api/scan", expect.objectContaining({ method: "POST" }));
    } finally {
      fetchMock.mockRestore();
    }
  });
});
