import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AdminDashboard } from "@/app/admin/admin-dashboard";
import { drawLuckyWinner, getLuckyDrawPool } from "@/lib/admin/draw";
import { createStore } from "./test-stores";

describe("lucky draw", () => {
  it("draws a winner from the eligible, not-yet-drawn candidate pool", async () => {
    const recorded: Array<{ delegateId: string; roundId: string; wonAt: string }> = [];

    const result = await drawLuckyWinner({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async listLuckyDrawCandidates(_roundId: string) {
          return [
            { id: "delegate-1", fullName: "Ada Lovelace", registrationNumber: "REG-001", drawStatus: "eligible" },
            { id: "delegate-2", fullName: "Grace Hopper", registrationNumber: "REG-002", drawStatus: "eligible" },
          ];
        },
        async tryRecordLuckyDrawWinner(delegateId, roundId, wonAt) {
          recorded.push({ delegateId, roundId, wonAt });
          return {
            ok: true,
            winner: {
              id: "winner-1",
              delegateId,
              fullName: "Grace Hopper",
              registrationNumber: "REG-002",
              roundId,
              roundNumber: 1,
              wonAt,
            },
          };
        },
      }),
      sessionId: "session-1",
      now: () => new Date("2025-01-01T00:10:00.000Z"),
      random: () => 0.75,
    });

    expect(result).toEqual({
      ok: true,
      winner: {
        id: "winner-1",
        delegateId: "delegate-2",
        fullName: "Grace Hopper",
        registrationNumber: "REG-002",
        roundId: "round-1",
        roundNumber: 1,
        wonAt: "2025-01-01T00:10:00.000Z",
      },
    });
    expect(recorded).toEqual([{ delegateId: "delegate-2", roundId: "round-1", wonAt: "2025-01-01T00:10:00.000Z" }]);
  });

  it("only draws from the candidate pool the store supplies (already excludes previous winners and excluded delegates)", async () => {
    const recorded: string[] = [];

    const result = await drawLuckyWinner({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async listLuckyDrawCandidates(_roundId: string) {
          return [
            { id: "delegate-3", fullName: "Katherine Johnson", registrationNumber: "REG-003", drawStatus: "eligible" },
          ];
        },
        async tryRecordLuckyDrawWinner(delegateId, roundId, wonAt) {
          recorded.push(delegateId);
          return {
            ok: true,
            winner: {
              id: "winner-1",
              delegateId,
              fullName: "Katherine Johnson",
              registrationNumber: "REG-003",
              roundId,
              roundNumber: 1,
              wonAt,
            },
          };
        },
      }),
      sessionId: "session-1",
      random: () => 0,
    });

    expect(result).toMatchObject({ ok: true, winner: { delegateId: "delegate-3" } });
    expect(recorded).toEqual(["delegate-3"]);
  });

  it("does not draw when there are no eligible candidates remaining", async () => {
    const result = await drawLuckyWinner({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async listLuckyDrawCandidates(_roundId: string) {
          return [];
        },
      }),
      sessionId: "session-1",
    });

    expect(result).toEqual({ ok: false, error: "No eligible delegates remaining — reset to restore the draw pool." });
  });

  it("derives the lucky draw pool from base eligibility (all stamps + survey, with admin override)", () => {
    const participants = [
      { id: "delegate-1", fullName: "Ada Lovelace", registrationNumber: "REG-001", stampsCollected: 3, totalActiveStations: 3, surveySubmitted: true, drawStatus: "eligible" as const },
      { id: "delegate-2", fullName: "Grace Hopper", registrationNumber: "REG-002", stampsCollected: 3, totalActiveStations: 3, surveySubmitted: true, drawStatus: "auto" as const },
      { id: "delegate-3", fullName: "Alan Turing", registrationNumber: "REG-003", stampsCollected: 1, totalActiveStations: 3, surveySubmitted: true, drawStatus: "auto" as const },
      { id: "delegate-4", fullName: "Katherine Johnson", registrationNumber: "REG-004", stampsCollected: 3, totalActiveStations: 3, surveySubmitted: true, drawStatus: "excluded" as const },
    ];

    expect(getLuckyDrawPool(participants).map((participant) => participant.id)).toEqual(["delegate-1", "delegate-2"]);
  });

  it("shows the draw controls and winner history to admins", () => {
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
          drawRounds: [
            {
              id: "round-1",
              roundNumber: 1,
              openedAt: "2025-01-01T00:00:00.000Z",
              closedAt: null,
              isCurrent: true,
              winners: [
                {
                  id: "winner-1",
                  delegateId: "delegate-1",
                  fullName: "Ada Lovelace",
                  registrationNumber: "REG-001",
                  roundId: "round-1",
                  roundNumber: 1,
                  wonAt: "2025-01-01T00:10:00.000Z",
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Lucky draw" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open draw screen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset winners" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Winner history" })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.queryByText(/Round 1/)).not.toBeInTheDocument();

    expect(screen.getAllByText(/REG-001/).length).toBeGreaterThan(0);
  });
});
