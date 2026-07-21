import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AdminDashboard } from "@/app/admin/admin-dashboard";
import { createStation, editStation } from "@/lib/admin/stations";
import { createStore } from "./test-stores";

describe("station management", () => {
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

  it("allows multiple stations for the event", async () => {
    let created: { name: string; active: boolean } | null = null;
    const store = createStore({
      async findValidSession() {
        return { id: "session-1", adminId: "admin-1", username: "organizer" };
      },
      async listStations() {
        return [{ id: "station-1", name: "AI Booth", active: true }];
      },
      async createStation(station) {
        created = station;
        return { id: "station-2", ...station };
      },
    });

    const result = await createStation({ store, sessionId: "session-1", name: "Second Booth", active: true });

    expect(result).toEqual({ ok: true, station: { id: "station-2", name: "Second Booth", active: true } });
    expect(created).toEqual({ name: "Second Booth", active: true });
  });

  it("shows the vendors & stations summary to admins", () => {
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
          vendorSessions: [
            { id: "sess-1", vendorId: "vendor-1", createdAt: "2025-01-01T00:00:00.000Z", expiresAt: "2025-01-02T00:00:00.000Z" },
            { id: "sess-2", vendorId: "vendor-1", createdAt: "2025-01-01T00:05:00.000Z", expiresAt: "2025-01-02T00:00:00.000Z" },
          ],
          participants: [],
          stationSummaries: [],
          scanAuditLogs: [],
          drawRounds: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Vendors & stations" })).toBeInTheDocument();
    expect(screen.getByText("Station: AI Booth · 2 device(s)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage vendors & stations" })).toHaveAttribute("href", "/admin/vendors");
  });
});
