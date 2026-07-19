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
          participants: [],
          stationSummaries: [],
          scanAuditLogs: [],
          winnerHistory: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Stations" })).toBeInTheDocument();
    expect(screen.getByLabelText("New station name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create station" })).toBeInTheDocument();
    expect(screen.getAllByText("AI Booth").length).toBeGreaterThan(0);

    
    expect(screen.getAllByText("Cloud Booth").length).toBeGreaterThan(0);
        expect(screen.getByText("ai-vendor")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Save station" })).toHaveLength(2);

    expect(screen.getByRole("heading", { name: "Vendor accounts" })).toBeInTheDocument();
    expect(screen.getByLabelText("New vendor username")).toBeInTheDocument();
    expect(screen.getByLabelText("New vendor password")).toBeInTheDocument();
    expect(screen.getByLabelText("New vendor station")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create vendor" })).toBeInTheDocument();
    expect(screen.getByText("ai-vendor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save vendor" })).toBeInTheDocument();
  });
});
