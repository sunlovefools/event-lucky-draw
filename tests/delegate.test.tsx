import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Home } from "@/app/home";
import {
  getDelegateHome,
  identifyDelegate,
  registerOrResumeDelegate,
  type DelegateStore,
} from "@/lib/delegate";

function createStore(overrides: Partial<DelegateStore> = {}): DelegateStore {
  const store: DelegateStore = {
    async findDelegateByRegistrationNumber() {
      return null;
    },
    async createDelegate(delegate) {
      return { id: "delegate-1", registrationNumber: delegate.registrationNumber, fullName: delegate.fullName };
    },
    async createDelegateSession(delegateId, expiresAt) {
      return { id: "delegate-session-1", delegateId, expiresAt };
    },
    async findValidDelegateSession() {
      return null;
    },
    async readParticipationOpen() {
      return true;
    },
    async listActiveStations() {
      return [];
    },
    async listDelegateStampStationIds() {
      return [];
    },
    async readFinalSurveyStatus() {
      return { submitted: false, eligible: false, eligibleAt: null };
    },
    ...overrides,
  };

  return store;
}

describe("delegate registration and resume", () => {
  it("creates a delegate session from a scanned badge QR payload", async () => {
    const createdDelegates: Array<{ registrationNumber: string; fullName: string }> = [];
    const result = await identifyDelegate({
      store: createStore({
        async createDelegate(delegate) {
          createdDelegates.push(delegate);
          return { id: "delegate-1", ...delegate };
        },
      }),
      badgePayload: "https://event.example/register?registrationNumber= REG-001 ",
      fullName: " Ada Lovelace ",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
      session: {
        id: "delegate-session-1",
        delegateId: "delegate-1",
        expiresAt: "2025-01-31T00:00:00.000Z",
      },
      resumed: false,
    });
    expect(createdDelegates).toEqual([{ registrationNumber: "REG-001", fullName: "Ada Lovelace" }]);
  });

  it("creates a delegate session from manual registration number fallback", async () => {
    const result = await registerOrResumeDelegate({
      store: createStore(),
      registrationNumber: " manual-42 ",
      fullName: " Grace Hopper ",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      ok: true,
      delegate: { id: "delegate-1", registrationNumber: "manual-42", fullName: "Grace Hopper" },
      session: { id: "delegate-session-1", delegateId: "delegate-1" },
      resumed: false,
    });
  });

  it("requires full name on first registration", async () => {
    let created = false;

    const result = await registerOrResumeDelegate({
      store: createStore({
        async createDelegate() {
          created = true;
          throw new Error("should not create delegate");
        },
      }),
      registrationNumber: "REG-001",
      fullName: " ",
    });

    expect(result).toEqual({ ok: false, error: "Full name is required for first registration." });
    expect(created).toBe(false);
  });

  it("same browser resumes the delegate session", async () => {
    const result = await getDelegateHome({
      store: createStore({
        async findValidDelegateSession(sessionId) {
          expect(sessionId).toBe("delegate-session-1");
          return { id: "delegate-session-1", delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" } };
        },
      }),
      sessionId: "delegate-session-1",
      now: () => new Date("2025-01-02T00:00:00.000Z"),
    });

    expect(result).toEqual({
      identified: true,
      delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
      progress: { stations: [], completedCount: 0, totalRequired: 0, remainingCount: 0, readyForFinalSurvey: true },
      finalSurvey: { available: true, submitted: false, eligible: false, eligibleAt: null },
    });
  });

  it("same registration number resumes existing progress without requiring full name", async () => {
    let created = false;

    const result = await registerOrResumeDelegate({
      store: createStore({
        async findDelegateByRegistrationNumber(registrationNumber) {
          expect(registrationNumber).toBe("REG-001");
          return { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" };
        },
        async createDelegate() {
          created = true;
          throw new Error("should not create a duplicate delegate");
        },
      }),
      registrationNumber: "REG-001",
      fullName: "",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      ok: true,
      delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
      resumed: true,
    });
    expect(created).toBe(false);
  });

  it("blocks new registration when participation is closed", async () => {
    let created = false;

    const result = await registerOrResumeDelegate({
      store: createStore({
        async readParticipationOpen() {
          return false;
        },
        async createDelegate() {
          created = true;
          throw new Error("should not create delegate while closed");
        },
      }),
      registrationNumber: "REG-001",
      fullName: "Ada Lovelace",
    });

    expect(result).toEqual({ ok: false, error: "Registration is closed." });
    expect(created).toBe(false);
  });
});

describe("delegate station progress", () => {
  it("shows active stations as completed or uncompleted with remaining count", async () => {
    const result = await getDelegateHome({
      store: createStore({
        async findValidDelegateSession() {
          return { id: "delegate-session-1", delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" } };
        },
        async listActiveStations() {
          return [
            { id: "station-1", name: "AI Booth" },
            { id: "station-2", name: "Cloud Booth" },
            { id: "station-3", name: "Security Booth" },
          ];
        },
        async listDelegateStampStationIds(delegateId) {
          expect(delegateId).toBe("delegate-1");
          return ["station-1", "station-3"];
        },
      }),
      sessionId: "delegate-session-1",
    });

    expect(result).toEqual({
      identified: true,
      delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
      progress: {
        stations: [
          { id: "station-1", name: "AI Booth", completed: true },
          { id: "station-2", name: "Cloud Booth", completed: false },
          { id: "station-3", name: "Security Booth", completed: true },
        ],
        completedCount: 2,
        totalRequired: 3,
        remainingCount: 1,
        readyForFinalSurvey: false,
      },
      finalSurvey: { available: false, submitted: false, eligible: false, eligibleAt: null },
    });
  });

  it("makes the final survey available only after all active stations are complete", async () => {
    const incomplete = await getDelegateHome({
      store: createStore({
        async findValidDelegateSession() {
          return { id: "delegate-session-1", delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" } };
        },
        async listActiveStations() {
          return [{ id: "station-1", name: "AI Booth" }, { id: "station-2", name: "Cloud Booth" }];
        },
        async listDelegateStampStationIds() {
          return ["station-1"];
        },
      }),
      sessionId: "delegate-session-1",
    });
    const complete = await getDelegateHome({
      store: createStore({
        async findValidDelegateSession() {
          return { id: "delegate-session-1", delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" } };
        },
        async listActiveStations() {
          return [{ id: "station-1", name: "AI Booth" }];
        },
        async listDelegateStampStationIds() {
          return ["station-1"];
        },
      }),
      sessionId: "delegate-session-1",
    });

    expect(incomplete).toMatchObject({ identified: true, finalSurvey: { available: false, submitted: false, eligible: false } });
    expect(complete).toMatchObject({ identified: true, finalSurvey: { available: true, submitted: false, eligible: false } });
  });

  it("does not count disabled stations as required progress", async () => {
    const result = await getDelegateHome({
      store: createStore({
        async findValidDelegateSession() {
          return { id: "delegate-session-1", delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" } };
        },
        async listActiveStations() {
          return [{ id: "station-1", name: "AI Booth" }];
        },
        async listDelegateStampStationIds() {
          return ["station-1", "disabled-station"];
        },
      }),
      sessionId: "delegate-session-1",
    });

    expect(result).toMatchObject({
      identified: true,
      progress: {
        stations: [{ id: "station-1", name: "AI Booth", completed: true }],
        completedCount: 1,
        totalRequired: 1,
        remainingCount: 0,
        readyForFinalSurvey: true,
      },
      finalSurvey: { available: true, submitted: false, eligible: false, eligibleAt: null },
    });
  });
});

describe("delegate home UI", () => {
  it("shows the badge QR scanner with a manual entry fallback for unidentified delegates", async () => {
    render(await Home({
      delegateHomePromise: Promise.resolve({ identified: false }),
    }));

    expect(screen.getByRole("heading", { name: "Join the lucky draw" })).toBeInTheDocument();
    expect(screen.getByText("Scan your badge QR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type code instead" })).toBeInTheDocument();
  });


  it("welcomes back remembered delegates", async () => {
    render(await Home({
      delegateHomePromise: Promise.resolve({
        identified: true,
        delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
        progress: {
          stations: [
            { id: "station-1", name: "AI Booth", completed: true },
            { id: "station-2", name: "Cloud Booth", completed: false },
          ],
          completedCount: 1,
          totalRequired: 2,
          remainingCount: 1,
          readyForFinalSurvey: false,
        },
        finalSurvey: { available: false, submitted: false, eligible: false, eligibleAt: null },
      }),
    }));

    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByText("#REG-001")).toBeInTheDocument();
    expect(screen.getByText("stations complete")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("stamp remaining")).toBeInTheDocument();
    expect(screen.getByText("AI Booth")).toBeInTheDocument();
    expect(screen.getByText("Cloud Booth")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Final survey" })).not.toBeInTheDocument();
  });

  it("shows the final survey after all active stations are complete", async () => {
    render(await Home({
      delegateHomePromise: Promise.resolve({
        identified: true,
        delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
        progress: {
          stations: [{ id: "station-1", name: "AI Booth", completed: true }],
          completedCount: 1,
          totalRequired: 1,
          remainingCount: 0,
          readyForFinalSurvey: true,
        },
        finalSurvey: { available: true, submitted: false, eligible: false, eligibleAt: null },
      }),
    }));

    expect(screen.getByRole("heading", { name: "Final survey" })).toBeInTheDocument();
    expect(screen.getByLabelText("How was the event?"));
    expect(screen.getByLabelText("Favorite station"));
    expect(screen.getByRole("button", { name: /Submit/ })).toBeInTheDocument();
  });

  it("shows eligible confirmation instead of the survey after submission", async () => {
    render(await Home({
      delegateHomePromise: Promise.resolve({
        identified: true,
        delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
        progress: { stations: [], completedCount: 0, totalRequired: 0, remainingCount: 0, readyForFinalSurvey: true },
        finalSurvey: { available: false, submitted: true, eligible: true, eligibleAt: "2025-01-01T00:00:00.000Z" },
      }),
    }));

    expect(screen.getByRole("heading", { name: "You're entered into the lucky draw" })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("does not show 'You're in' for a delegate missing stamps, even if a survey exists", async () => {
    render(await Home({
      delegateHomePromise: Promise.resolve({
        identified: true,
        delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
        progress: {
          stations: [
            { id: "station-1", name: "AI Booth", completed: false },
            { id: "station-2", name: "Cloud Booth", completed: false },
          ],
          completedCount: 0,
          totalRequired: 2,
          remainingCount: 2,
          readyForFinalSurvey: false,
        },
        finalSurvey: { available: false, submitted: true, eligible: false, eligibleAt: null },
      }),
    }));

    expect(screen.queryByRole("heading", { name: "You're entered into the lucky draw" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Get all the stamps to enter the lucky draw!" })).toBeInTheDocument();
  });
});
