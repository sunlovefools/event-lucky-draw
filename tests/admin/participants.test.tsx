import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  createParticipantAccount,
  importParticipantAccounts,
  updateDelegateName,
  setDelegateDrawStatus,
} from "@/lib/admin/participants";
import { createStore } from "./test-stores";

describe("participant management", () => {
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

    const included = await setDelegateDrawStatus({ store, sessionId: "session-1", delegateId: "delegate-1", drawStatus: "manual_include" });
    const removed = await setDelegateDrawStatus({ store, sessionId: "session-1", delegateId: "delegate-1", drawStatus: "disqualified" });

    expect(included).toMatchObject({ ok: true, participant: { id: "delegate-1", drawStatus: "manual_include" } });
    expect(removed).toMatchObject({ ok: true, participant: { id: "delegate-1", drawStatus: "disqualified" } });
    expect(statuses).toEqual([
      { delegateId: "delegate-1", drawStatus: "manual_include" },
      { delegateId: "delegate-1", drawStatus: "disqualified" },
    ]);
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
