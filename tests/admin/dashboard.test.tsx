import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AdminDashboard } from "@/app/admin/admin-dashboard";
import { getAdminDashboard, setParticipationState } from "@/lib/admin/dashboard";
import { createStore } from "./test-stores";

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
      participants: [],
      stationSummaries: [],
      scanAuditLogs: [],
      winnerHistory: [],
    });
  });

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

describe("dashboard aggregation", () => {
  it("includes station completion summaries and scan audit logs on the protected dashboard", async () => {
    const result = await getAdminDashboard({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async listStationSummaries() {
          return [
            { stationId: "station-1", stationName: "AI Booth", active: true, completions: 12 },
            { stationId: "station-2", stationName: "Cloud Booth", active: false, completions: 4 },
          ];
        },
        async listScanAuditLogs() {
          return [
            {
              id: "audit-1",
              delegateId: "delegate-1",
              delegateFullName: "Ada Lovelace",
              stationId: "station-1",
              stationName: "AI Booth",
              scannedAt: "2025-01-01T00:00:00.000Z",
              qrTokenId: "qr-1",
              qrToken: "secure-token",
              result: "success",
              consumed: true,
            },
          ];
        },
      }),
      sessionId: "session-1",
    });

    expect(result).toMatchObject({
      authorized: true,
      stationSummaries: [
        { stationId: "station-1", stationName: "AI Booth", active: true, completions: 12 },
        { stationId: "station-2", stationName: "Cloud Booth", active: false, completions: 4 },
      ],
      scanAuditLogs: [
        {
          id: "audit-1",
          delegateFullName: "Ada Lovelace",
          stationName: "AI Booth",
          scannedAt: "2025-01-01T00:00:00.000Z",
          qrToken: "secure-token",
          result: "success",
          consumed: true,
        },
      ],
    });
  });

  it("includes participant progress, survey status, and draw status on the protected dashboard", async () => {
    const result = await getAdminDashboard({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async listParticipants() {
          return [
            {
              id: "delegate-1",
              fullName: "Ada Lovelace",
              registrationNumber: "REG-001",
              stampsCollected: 2,
              totalActiveStations: 3,
              surveySubmitted: true,
              drawStatus: "eligible",
            },
          ];
        },
      }),
      sessionId: "session-1",
    });

    expect(result).toMatchObject({
      authorized: true,
      participants: [
        {
          id: "delegate-1",
          fullName: "Ada Lovelace",
          registrationNumber: "REG-001",
          stampsCollected: 2,
          totalActiveStations: 3,
          surveySubmitted: true,
          drawStatus: "eligible",
        },
      ],
    });
  });

  it("includes winner history on the protected dashboard", async () => {
    const result = await getAdminDashboard({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async listWinnerHistory() {
          return [
            {
              id: "winner-1",
              delegateId: "delegate-1",
              fullName: "Ada Lovelace",
              registrationNumber: "REG-001",
              drawLabel: "Grand Prize",
              wonAt: "2025-01-01T00:10:00.000Z",
            },
          ];
        },
      }),
      sessionId: "session-1",
    });

    expect(result).toMatchObject({
      authorized: true,
      winnerHistory: [
        {
          id: "winner-1",
          delegateId: "delegate-1",
          fullName: "Ada Lovelace",
          registrationNumber: "REG-001",
          drawLabel: "Grand Prize",
          wonAt: "2025-01-01T00:10:00.000Z",
        },
      ],
    });
  });
});

describe("admin dashboard UI", () => {
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
          participants: [],
          stationSummaries: [],
          scanAuditLogs: [],
          winnerHistory: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Admin dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Signed in as organizer")).toBeInTheDocument();
    expect(screen.getByText("Participation is closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open participation" })).toBeInTheDocument();
    expect(screen.getByText("Last changed by organizer at 2025-01-01T00:10:00.000Z")).toBeInTheDocument();
  });

  it("shows export links to admins", () => {
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
          stations: [],
          vendorAccounts: [],
          participants: [],
          stationSummaries: [],
          scanAuditLogs: [],
          winnerHistory: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Exports" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export participants/progress" })).toHaveAttribute("href", "/admin/exports/participants");
    expect(screen.getByRole("link", { name: "Export station completions" })).toHaveAttribute("href", "/admin/exports/station-completions");
    expect(screen.getByRole("link", { name: "Export survey responses" })).toHaveAttribute("href", "/admin/exports/survey-responses");
    expect(screen.getByRole("link", { name: "Export winner history" })).toHaveAttribute("href", "/admin/exports/winner-history");
    expect(screen.getByRole("link", { name: "Export scan audit logs" })).toHaveAttribute("href", "/admin/exports/scan-audit");
  });

  it("shows station summaries and scan audit logs to admins", () => {
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
          stations: [],
          vendorAccounts: [],
          participants: [],
          stationSummaries: [
            { stationId: "station-1", stationName: "AI Booth", active: true, completions: 12 },
            { stationId: "station-2", stationName: "Cloud Booth", active: false, completions: 4 },
          ],
          scanAuditLogs: [
            {
              id: "audit-1",
              delegateId: "delegate-1",
              delegateFullName: "Ada Lovelace",
              stationId: "station-1",
              stationName: "AI Booth",
              scannedAt: "2025-01-01T00:00:00.000Z",
              qrTokenId: "qr-1",
              qrToken: "secure-token",
              result: "success",
              consumed: true,
            },
          ],
          winnerHistory: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Station summary" })).toBeInTheDocument();
    expect(screen.getByText("AI Booth — active — 12 completions")).toBeInTheDocument();
    expect(screen.getByText("Cloud Booth — disabled — 4 completions")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scan audit log" })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace — AI Booth — 2025-01-01T00:00:00.000Z — token secure-token — success — consumed")).toBeInTheDocument();
  });

  it("shows participant progress and eligibility override controls to admins", () => {
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
          stations: [],
          vendorAccounts: [],
          participants: [
            {
              id: "delegate-1",
              fullName: "Ada Lovelace",
              registrationNumber: "REG-001",
              stampsCollected: 2,
              totalActiveStations: 3,
              surveySubmitted: true,
              drawStatus: "eligible",
            },
          ],
          stationSummaries: [],
          scanAuditLogs: [],
          winnerHistory: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Participants" })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace — REG-001 — 2/3 stamps — survey submitted — eligible")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name for Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save delegate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manually include" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disqualify" })).toBeInTheDocument();
  });
});
