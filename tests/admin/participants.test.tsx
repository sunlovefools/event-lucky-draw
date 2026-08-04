import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import * as XLSX from "xlsx";

import { ParticipantActions } from "@/app/admin/participants/participant-controls";
import {
  createParticipantAccount,
  deleteAllDelegates,
  importParticipantAccounts,
  updateDelegateName,
  setDelegateDrawStatus,
  setDelegateStationStamp,
} from "@/lib/admin/participants";
import { DELETE_ALL_DELEGATES_CONFIRMATION } from "@/lib/shared/delegate-deletion";
import { createStore } from "./test-stores";

const { getAdminDashboardMock } = vi.hoisted(() => ({
  getAdminDashboardMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session-1" }) }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/admin/dashboard", () => ({
  getAdminDashboard: getAdminDashboardMock,
  SupabaseDashboardStore: class SupabaseDashboardStore {},
}));

import ParticipantsPage from "@/app/admin/participants/page";

describe("participant management", () => {
  it("counts a manually eligible participant in the Participants summary even when winner history exists", async () => {
    getAdminDashboardMock.mockResolvedValueOnce({
      authorized: true,
      admin: { id: "admin-1", username: "organizer" },
      participation: { open: true, updatedAt: "2026-08-04T00:00:00.000Z", updatedByUsername: "organizer" },
      stations: [],
      vendorAccounts: [],
      vendorSessions: [],
      participants: [{
        id: "delegate-1",
        fullName: "Ada Lovelace",
        registrationNumber: "REG-001",
        stampsCollected: 0,
        totalActiveStations: 3,
        surveySubmitted: false,
        drawStatus: "eligible",
      }],
      stationSummaries: [],
      scanAuditLogs: [],
      drawRounds: [{
        id: "round-1",
        roundNumber: 1,
        openedAt: "2026-08-04T00:00:00.000Z",
        closedAt: null,
        isCurrent: true,
        winners: [{
          id: "winner-1",
          delegateId: "delegate-1",
          fullName: "Ada Lovelace",
          registrationNumber: "REG-001",
          roundId: "round-1",
          roundNumber: 1,
          wonAt: "2026-08-04T01:00:00.000Z",
        }],
      }],
    });

    render(await ParticipantsPage({ searchParams: Promise.resolve({}) }));

    const eligibleCard = screen.getByText("Draw eligible").closest(".summary-card");
    expect(eligibleCard).toHaveTextContent("1");
  });

  it("submits the canonical eligible status from the participant controls", () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value() {
        this.setAttribute("open", "");
      },
    });

    render(
      <ParticipantActions
        participant={{
          id: "delegate-1",
          fullName: "Ada Lovelace",
          registrationNumber: "REG-001",
          stampsCollected: 0,
          totalActiveStations: 3,
          surveySubmitted: false,
          drawStatus: "auto",
        }}
        stations={[]}
        redirectTo="/admin/participants"
      />,
    );

    fireEvent.click(screen.getByLabelText("Show actions for Ada Lovelace"));
    fireEvent.click(screen.getByRole("button", { name: "Include in draw" }));

    expect(document.querySelector<HTMLInputElement>('input[name="drawStatus"]')).toHaveValue("eligible");
  });

  it("permanently deletes every delegate only after exact confirmation from an authenticated admin", async () => {
    const sessionIds: string[] = [];
    const store = createStore({
      async findValidSession() {
        return { id: "session-1", adminId: "admin-1", username: "organizer" };
      },
      async deleteAllDelegates(sessionId) {
        sessionIds.push(sessionId);
        return 3;
      },
    });

    const rejected = await deleteAllDelegates({
      store,
      sessionId: "session-1",
      confirmationPhrase: "delete all delegates",
    });
    const deleted = await deleteAllDelegates({
      store,
      sessionId: "session-1",
      confirmationPhrase: DELETE_ALL_DELEGATES_CONFIRMATION,
    });

    expect(rejected).toEqual({ ok: false, error: "Type DELETE ALL DELEGATES to confirm." });
    expect(deleted).toEqual({ ok: true, deleted: 3 });
    expect(sessionIds).toEqual(["session-1"]);
  });

  it("lets an authenticated admin edit delegate names", async () => {
    const updates: Array<{ delegateId: string; fullName: string }> = [];
    const result = await updateDelegateName({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async updateDelegateName(delegateId, fullName) {
          updates.push({ delegateId, fullName });
          return {
            id: delegateId,
            title: "Dr",
            fullName,
            registrationNumber: "REG-001",
            stampsCollected: 2,
            totalActiveStations: 3,
            surveySubmitted: true,
            drawStatus: "eligible",
          };
        },
      }),
      sessionId: "session-1",
      delegateId: "delegate-1",
      fullName: " Ada L. Lovelace ",
    });

    expect(result).toEqual({
      ok: true,
      participant: {
        id: "delegate-1",
        title: "Dr",
        fullName: "Ada L. Lovelace",
        registrationNumber: "REG-001",
        stampsCollected: 2,
        totalActiveStations: 3,
        surveySubmitted: true,
        drawStatus: "eligible",
      },
    });
    expect(updates).toEqual([{ delegateId: "delegate-1", fullName: "Ada L. Lovelace" }]);
  });

  it("lets an authenticated admin manually include or disqualify delegates", async () => {
    const statuses: Array<{ delegateId: string; drawStatus: string }> = [];
    const store = createStore({
      async findValidSession() {
        return { id: "session-1", adminId: "admin-1", username: "organizer" };
      },
      async updateDelegateDrawStatus(delegateId, drawStatus) {
        statuses.push({ delegateId, drawStatus });
        return {
          id: delegateId,
          title: "",
          fullName: "Ada Lovelace",
          registrationNumber: "REG-001",
          stampsCollected: 1,
          totalActiveStations: 3,
          surveySubmitted: false,
          drawStatus,
        };
      },
    });

    const included = await setDelegateDrawStatus({ store, sessionId: "session-1", delegateId: "delegate-1", drawStatus: "eligible" });
    const removed = await setDelegateDrawStatus({ store, sessionId: "session-1", delegateId: "delegate-1", drawStatus: "excluded" });

    expect(included).toMatchObject({ ok: true, participant: { id: "delegate-1", drawStatus: "eligible" } });
    expect(removed).toMatchObject({ ok: true, participant: { id: "delegate-1", drawStatus: "excluded" } });
    expect(statuses).toEqual([
      { delegateId: "delegate-1", drawStatus: "eligible" },
      { delegateId: "delegate-1", drawStatus: "excluded" },
    ]);
  });

  it("rejects legacy or unknown draw statuses on write", async () => {
    let updated = false;
    const result = await setDelegateDrawStatus({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async updateDelegateDrawStatus() {
          updated = true;
          throw new Error("should not update");
        },
      }),
      sessionId: "session-1",
      delegateId: "delegate-1",
      drawStatus: "manual_include",
    });

    expect(result).toEqual({ ok: false, error: "Draw status is invalid." });
    expect(updated).toBe(false);
  });

  it("lets an authenticated admin stamp or unstamp a participant station", async () => {
    const changes: Array<{ delegateId: string; stationId: string; stamped: boolean; changedAt: string }> = [];
    const store = createStore({
      async findValidSession() {
        return { id: "session-1", adminId: "admin-1", username: "organizer" };
      },
      async setDelegateStationStamp(delegateId, stationId, stamped, changedAt) {
        changes.push({ delegateId, stationId, stamped, changedAt });
      },
    });
    const now = () => new Date("2026-07-23T08:00:00.000Z");

    const stamped = await setDelegateStationStamp({
      store,
      sessionId: "session-1",
      delegateId: " delegate-1 ",
      stationId: " station-1 ",
      stamped: true,
      now,
    });
    const unstamped = await setDelegateStationStamp({
      store,
      sessionId: "session-1",
      delegateId: "delegate-1",
      stationId: "station-1",
      stamped: false,
      now,
    });

    expect(stamped).toEqual({ ok: true });
    expect(unstamped).toEqual({ ok: true });
    expect(changes).toEqual([
      { delegateId: "delegate-1", stationId: "station-1", stamped: true, changedAt: "2026-07-23T08:00:00.000Z" },
      { delegateId: "delegate-1", stationId: "station-1", stamped: false, changedAt: "2026-07-23T08:00:00.000Z" },
    ]);
  });

  it("does not let an unauthenticated admin change station stamps", async () => {
    const result = await setDelegateStationStamp({
      store: createStore(),
      sessionId: "missing",
      delegateId: "delegate-1",
      stationId: "station-1",
      stamped: true,
    });

    expect(result).toEqual({ ok: false, error: "Admin login required." });
  });

  it("lets an authenticated admin create or update one participant account", async () => {
    const saved: Array<{ registrationNumber: string; title: string; fullName: string }> = [];
    const result = await createParticipantAccount({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async createOrUpdateParticipant(participant) {
          saved.push(participant);
          return {
            id: "delegate-1",
            title: participant.title,
            fullName: participant.fullName,
            registrationNumber: participant.registrationNumber,
            stampsCollected: 0,
            totalActiveStations: 0,
            surveySubmitted: false,
            drawStatus: "auto",
          };
        },
      }),
      sessionId: "session-1",
      registrationNumber: " REG-001 ",
      title: " Dr ",
      fullName: " Ada Lovelace ",
    });

    expect(result).toMatchObject({
      ok: true,
      participant: {
        title: "Dr",
        fullName: "Ada Lovelace",
        registrationNumber: "REG-001",
      },
    });
    expect(saved).toEqual([{ registrationNumber: "REG-001", title: "Dr", fullName: "Ada Lovelace" }]);
  });

  it("imports participants from the first Excel worksheet and reports created, updated, and skipped counts", async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      { "Delegate ID": "REG-001", Title: "Dr", Name: "Ada Lovelace" },
      { "Delegate ID": "REG-002", Title: "", Name: "Grace Hopper" },
      { "Delegate ID": "REG-002", Title: "Prof", Name: "Grace H." },
      { "Delegate ID": "", Title: "Ms", Name: "Missing Id" },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Delegates");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const imported: Array<{ registrationNumber: string; title: string; fullName: string }> = [];

    const result = await importParticipantAccounts({
      store: createStore({
        async findValidSession() {
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async upsertParticipants(participants) {
          imported.push(...participants);
          return { created: 1, updated: 1 };
        },
      }),
      sessionId: "session-1",
      file: { size: buffer.byteLength, arrayBuffer: async () => buffer } as File,
    });

    expect(result).toEqual({
      ok: true,
      result: { created: 1, updated: 1, skipped: 2 },
    });
    expect(imported).toEqual([
      { registrationNumber: "REG-001", title: "Dr", fullName: "Ada Lovelace" },
      { registrationNumber: "REG-002", title: "Prof", fullName: "Grace H." },
    ]);
  });

  it("does not let an unauthenticated admin import or add participants", async () => {
    const created = await createParticipantAccount({
      store: createStore(),
      sessionId: "missing",
      registrationNumber: "REG-001",
      title: "Dr",
      fullName: "Ada Lovelace",
    });
    const imported = await importParticipantAccounts({
      store: createStore(),
      sessionId: "missing",
      file: new File([""], "delegates.xlsx"),
    });

    expect(created).toEqual({ ok: false, error: "Admin login required." });
    expect(imported).toEqual({ ok: false, error: "Admin login required." });
  });
});
