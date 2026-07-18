import { describe, expect, it } from "vitest";

import { updateDelegateName, setDelegateDrawStatus } from "@/lib/admin/participants";
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
});
