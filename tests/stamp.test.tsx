import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StampResult } from "@/app/stamp/[token]/stamp-result";
import {
  collectStationStamp,
  prepareStampCollectionRequest,
  type StampCollectionStore,
} from "@/lib/stamp";

function createStore(overrides: Partial<StampCollectionStore> = {}): StampCollectionStore {
  const store: StampCollectionStore = {
    async findValidDelegateSession() {
      return {
        id: "delegate-session-1",
        delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
      };
    },
    async readParticipationOpen() {
      return true;
    },
    async consumeStationQrToken(token, consumedAt) {
      return { id: "qr-1", token, stationId: "station-1", stationName: "AI Booth", consumedAt };
    },
    async hasDelegateStamp() {
      return false;
    },
    async createDelegateStamp(delegateId, stationId, collectedAt) {
      return { id: "stamp-1", delegateId, stationId, collectedAt };
    },
    ...overrides,
  };

  return store;
}

describe("pending stamp after registration", () => {
  it("sends an unregistered station QR visitor to registration with the token preserved", async () => {
    const result = await prepareStampCollectionRequest({
      store: createStore(),
      sessionId: undefined,
      token: "pending-token",
    });

    expect(result).toEqual({ registrationRequired: true, pendingStampToken: "pending-token" });
  });

  it("applies a valid pending QR after registration creates a delegate session", async () => {
    const result = await prepareStampCollectionRequest({
      store: createStore(),
      sessionId: "delegate-session-1",
      token: "pending-token",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({
      registrationRequired: false,
      result: {
        ok: true,
        station: { id: "station-1", name: "AI Booth" },
        duplicate: false,
        message: "AI Booth stamp collected.",
      },
    });
  });

  it("shows the normal QR error when a pending QR expires before registration completes", async () => {
    const result = await prepareStampCollectionRequest({
      store: createStore({
        async consumeStationQrToken() {
          return null;
        },
      }),
      sessionId: "delegate-session-1",
      token: "expired-pending-token",
    });

    expect(result).toEqual({
      registrationRequired: false,
      result: {
        ok: false,
        error: "This station QR is expired, used, or invalid. Please ask the station staff for a new QR.",
      },
    });
  });
});

describe("delegate station stamp collection", () => {
  it("awards a station stamp from a valid QR and names the collected station", async () => {
    const stamps: Array<{ delegateId: string; stationId: string; collectedAt: string }> = [];

    const result = await collectStationStamp({
      store: createStore({
        async createDelegateStamp(delegateId, stationId, collectedAt) {
          stamps.push({ delegateId, stationId, collectedAt });
          return { id: "stamp-1", delegateId, stationId, collectedAt };
        },
      }),
      sessionId: "delegate-session-1",
      token: "secure-token",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      station: { id: "station-1", name: "AI Booth" },
      duplicate: false,
      message: "AI Booth stamp collected.",
    });
    expect(stamps).toEqual([{ delegateId: "delegate-1", stationId: "station-1", collectedAt: "2025-01-01T00:00:00.000Z" }]);
  });

  it("shows a clear error when the QR is expired, used, or invalid", async () => {
    let stampCreated = false;

    const result = await collectStationStamp({
      store: createStore({
        async consumeStationQrToken() {
          return null;
        },
        async createDelegateStamp() {
          stampCreated = true;
          throw new Error("should not award stamp");
        },
      }),
      sessionId: "delegate-session-1",
      token: "bad-token",
    });

    expect(result).toEqual({
      ok: false,
      error: "This station QR is expired, used, or invalid. Please ask the station staff for a new QR.",
    });
    expect(stampCreated).toBe(false);
  });

  it("consumes a duplicate station QR scan without awarding a duplicate stamp", async () => {
    const consumedTokens: string[] = [];
    let stampCreated = false;

    const result = await collectStationStamp({
      store: createStore({
        async consumeStationQrToken(token) {
          consumedTokens.push(token);
          return { id: "qr-1", token, stationId: "station-1", stationName: "AI Booth", consumedAt: "2025-01-01T00:00:00.000Z" };
        },
        async hasDelegateStamp(delegateId, stationId) {
          expect({ delegateId, stationId }).toEqual({ delegateId: "delegate-1", stationId: "station-1" });
          return true;
        },
        async createDelegateStamp() {
          stampCreated = true;
          throw new Error("should not create duplicate stamp");
        },
      }),
      sessionId: "delegate-session-1",
      token: "duplicate-token",
    });

    expect(result).toEqual({
      ok: true,
      station: { id: "station-1", name: "AI Booth" },
      duplicate: true,
      message: "AI Booth was already collected.",
    });
    expect(consumedTokens).toEqual(["duplicate-token"]);
    expect(stampCreated).toBe(false);
  });

  it("uses atomic QR consumption so concurrent scans are first-successful-request-wins", async () => {
    let consumed = false;
    const store = createStore({
      async findValidDelegateSession(sessionId) {
        return {
          id: sessionId,
          delegate: {
            id: sessionId === "delegate-session-1" ? "delegate-1" : "delegate-2",
            registrationNumber: sessionId,
            fullName: sessionId,
          },
        };
      },
      async consumeStationQrToken(token, consumedAt) {
        if (consumed) {
          return null;
        }
        consumed = true;
        return { id: "qr-1", token, stationId: "station-1", stationName: "AI Booth", consumedAt };
      },
    });

    const first = await collectStationStamp({ store, sessionId: "delegate-session-1", token: "race-token" });
    const second = await collectStationStamp({ store, sessionId: "delegate-session-2", token: "race-token" });

    expect(first).toMatchObject({ ok: true, station: { id: "station-1", name: "AI Booth" }, duplicate: false });
    expect(second).toEqual({
      ok: false,
      error: "This station QR is expired, used, or invalid. Please ask the station staff for a new QR.",
    });
  });

  it("blocks stamp collection when participation is closed", async () => {
    let consumed = false;

    const result = await collectStationStamp({
      store: createStore({
        async readParticipationOpen() {
          return false;
        },
        async consumeStationQrToken() {
          consumed = true;
          throw new Error("should not consume QR while participation is closed");
        },
      }),
      sessionId: "delegate-session-1",
      token: "secure-token",
    });

    expect(result).toEqual({ ok: false, error: "Participation is closed." });
    expect(consumed).toBe(false);
  });
});

describe("stamp collection UI", () => {
  it("shows the station success message", () => {
    render(<StampResult result={{ ok: true, station: { id: "station-1", name: "AI Booth" }, duplicate: false, message: "AI Booth stamp collected." }} />);

    expect(screen.getByRole("heading", { name: "Stamp collected" })).toBeInTheDocument();
    expect(screen.getByText("AI Booth stamp collected.")).toBeInTheDocument();
  });

  it("shows the QR error message", () => {
    render(<StampResult result={{ ok: false, error: "This station QR is expired, used, or invalid. Please ask the station staff for a new QR." }} />);

    expect(screen.getByRole("heading", { name: "Stamp not collected" })).toBeInTheDocument();
    expect(screen.getByText("This station QR is expired, used, or invalid. Please ask the station staff for a new QR.")).toBeInTheDocument();
  });
});
