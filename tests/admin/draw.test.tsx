import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AdminDashboard } from "@/app/admin/admin-dashboard";
import { drawLuckyWinner, getLuckyDrawPool } from "@/lib/admin/draw";
import { createStore } from "./test-stores";

describe("lucky draw", () => {
  it("draws a labeled winner from eligible and manually included non-winners", async () => {
    const recorded: Array<{ delegateId: string; drawLabel: string; wonAt: string }> = [];

    const result = await drawLuckyWinner({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async listLuckyDrawCandidates() {
          return [
            { id: "delegate-1", fullName: "Ada Lovelace", registrationNumber: "REG-001", drawStatus: "eligible" },
            { id: "delegate-2", fullName: "Grace Hopper", registrationNumber: "REG-002", drawStatus: "manual_include" },
          ];
        },
        async recordLuckyDrawWinner(delegateId, drawLabel, wonAt) {
          recorded.push({ delegateId, drawLabel, wonAt });
          return {
            id: "winner-1",
            delegateId,
            fullName: "Grace Hopper",
            registrationNumber: "REG-002",
            drawLabel,
            wonAt,
          };
        },
      }),
      sessionId: "session-1",
      drawLabel: " Grand Prize ",
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
        drawLabel: "Grand Prize",
        wonAt: "2025-01-01T00:10:00.000Z",
      },
    });
    expect(recorded).toEqual([{ delegateId: "delegate-2", drawLabel: "Grand Prize", wonAt: "2025-01-01T00:10:00.000Z" }]);
  });

  it("excludes previous winners and disqualified delegates from the draw", async () => {
    const recorded: string[] = [];

    const result = await drawLuckyWinner({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async listLuckyDrawCandidates() {
          return [
            { id: "delegate-1", fullName: "Ada Lovelace", registrationNumber: "REG-001", drawStatus: "winner" },
            { id: "delegate-2", fullName: "Grace Hopper", registrationNumber: "REG-002", drawStatus: "disqualified" },
            { id: "delegate-3", fullName: "Katherine Johnson", registrationNumber: "REG-003", drawStatus: "eligible" },
          ];
        },
        async recordLuckyDrawWinner(delegateId, drawLabel, wonAt) {
          recorded.push(delegateId);
          return {
            id: "winner-1",
            delegateId,
            fullName: "Katherine Johnson",
            registrationNumber: "REG-003",
            drawLabel,
            wonAt,
          };
        },
      }),
      sessionId: "session-1",
      drawLabel: "Bonus Draw",
      random: () => 0,
    });

    expect(result).toMatchObject({ ok: true, winner: { delegateId: "delegate-3" } });
    expect(recorded).toEqual(["delegate-3"]);
  });

  it("does not draw when there are no eligible non-winners", async () => {
    const result = await drawLuckyWinner({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async listLuckyDrawCandidates() {
          return [];
        },
      }),
      sessionId: "session-1",
      drawLabel: "Bonus Draw",
    });

    expect(result).toEqual({ ok: false, error: "No eligible delegates are available for this draw." });
  });

  it("derives the lucky draw pool from delegate draw status", () => {
    const participants = [
      { id: "delegate-1", fullName: "Ada Lovelace", registrationNumber: "REG-001", stampsCollected: 3, totalActiveStations: 3, surveySubmitted: true, drawStatus: "eligible" as const },
      { id: "delegate-2", fullName: "Grace Hopper", registrationNumber: "REG-002", stampsCollected: 1, totalActiveStations: 3, surveySubmitted: false, drawStatus: "manual_include" as const },
      { id: "delegate-3", fullName: "Alan Turing", registrationNumber: "REG-003", stampsCollected: 3, totalActiveStations: 3, surveySubmitted: true, drawStatus: "disqualified" as const },
      { id: "delegate-4", fullName: "Katherine Johnson", registrationNumber: "REG-004", stampsCollected: 3, totalActiveStations: 3, surveySubmitted: true, drawStatus: "winner" as const },
    ];

    expect(getLuckyDrawPool(participants).map((participant) => participant.id)).toEqual(["delegate-1", "delegate-2"]);
  });

  it("shows lucky draw control and winner history to admins", () => {
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
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Lucky draw" })).toBeInTheDocument();
    expect(screen.getByLabelText("Draw label")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draw winner" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Winner history" })).toBeInTheDocument();
    expect(screen.getByText("Grand Prize — Ada Lovelace — REG-001 — 2025-01-01T00:10:00.000Z")).toBeInTheDocument();
  });
});
