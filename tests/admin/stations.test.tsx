import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AdminDashboard } from "@/app/admin/admin-dashboard";
import { FinalSurveyStationLink } from "@/app/admin/stations/final-survey-station-link";
import { StationCard } from "@/app/admin/stations/station-card";
import { createStation, editStation } from "@/lib/admin/stations";
import { createStore } from "./test-stores";

describe("station management", () => {
  it("copies the station page URL and shows a clear success state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <StationCard
        station={{ id: "station-1", name: "AI Booth", active: true }}
        index={0}
        redirectTo="/admin/stations"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy link for AI Booth" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("http://localhost:3000/station/AI%20Booth"));
    expect(screen.getByRole("button", { name: "Copy link for AI Booth" })).toHaveTextContent("Copied!");
  });

  it("only enables saving an exhibition station after its name changes", () => {
    const { container } = render(
      <StationCard
        station={{ id: "station-1", name: "AI Booth", active: true }}
        index={0}
        redirectTo="/admin/stations"
      />,
    );

    expect(screen.queryByRole("checkbox", { name: /active/i })).not.toBeInTheDocument();
    expect(container.querySelector('input[name="active"]')).toHaveAttribute("type", "hidden");
    expect(container.querySelector('input[name="active"]')).toHaveValue("true");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Edit AI Booth name" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Exhibition station name" }), {
      target: { value: "AI Experience Booth" },
    });

    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
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

  it("reserves the system final station so admins cannot create or edit it", async () => {
    let created = false;
    let updated = false;
    const store = createStore({
      async findValidSession() {
        return { id: "session-1", adminId: "admin-1", username: "organizer" };
      },
      async findStationById() {
        return { id: "final-survey", name: "Final Survey Station", active: true };
      },
      async createStation(station) {
        created = true;
        return { id: "station-new", ...station };
      },
      async updateStation(stationId, station) {
        updated = true;
        return { id: stationId, ...station };
      },
    });

    await expect(createStation({ store, sessionId: "session-1", name: " Final Survey Station ", active: true }))
      .resolves.toEqual({ ok: false, error: "The Final Survey Station is created automatically." });
    await expect(editStation({ store, sessionId: "session-1", stationId: "final-survey", name: "Renamed", active: false }))
      .resolves.toEqual({ ok: false, error: "The Final Survey Station cannot be changed." });
    expect(created).toBe(false);
    expect(updated).toBe(false);
  });

  it("shows the protected Final Survey Station link", () => {
    render(<FinalSurveyStationLink />);

    expect(screen.getByRole("heading", { name: "Final Survey Station" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open final station/ })).toHaveAttribute(
      "href",
      "/station/Final%20Survey%20Station",
    );
    expect(screen.getByText("Protected")).toBeInTheDocument();
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

    expect(screen.getByRole("heading", { name: "Exhibition stations" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open station link" })[0]).toHaveAttribute("href", "/station/AI%20Booth");
    expect(screen.getByRole("link", { name: "Manage exhibition stations" })).toHaveAttribute("href", "/admin/stations");
  });
});
