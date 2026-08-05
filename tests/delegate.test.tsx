import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { Home } from "@/app/home";
import {
  getDelegateHome,
  identifyDelegate,
  registerOrResumeDelegate,
  type ActiveStation,
  type Delegate,
  type DelegateHomeSnapshot,
  type DelegateStore,
} from "@/lib/delegate";

const ada: Delegate = { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" };

function createHomeSnapshot({
  stations = [],
  completedStationIds = [],
  delegate = ada,
}: {
  stations?: ActiveStation[];
  completedStationIds?: string[];
  delegate?: Delegate;
} = {}): DelegateHomeSnapshot {
  const completed = new Set(completedStationIds);
  return {
    delegate,
    stations: stations.map((station) => ({ ...station, completed: completed.has(station.id) })),
    finalSurveyStatus: { submitted: false, eligible: false, eligibleAt: null },
  };
}

function createStore(overrides: Partial<DelegateStore> = {}): DelegateStore {
  const store: DelegateStore = {
    async findDelegateByRegistrationNumber() {
      return null;
    },
    async createDelegateSession(delegateId, expiresAt) {
      return { id: "delegate-session-1", delegateId, expiresAt };
    },
    async readDelegateHome() {
      return null;
    },
    ...overrides,
  };

  return store;
}

describe("delegate registration and resume", () => {
  it("creates a delegate session for a pre-created account from a scanned badge QR payload", async () => {
    const result = await identifyDelegate({
      store: createStore({
        async findDelegateByRegistrationNumber(registrationNumber) {
          expect(registrationNumber).toBe("REG-001");
          return { id: "delegate-1", registrationNumber, title: "Dr", fullName: "Ada Lovelace" };
        },
      }),
      badgePayload: "https://event.example/register?registrationNumber= REG-001 ",
      fullName: "",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      delegate: { id: "delegate-1", registrationNumber: "REG-001", title: "Dr", fullName: "Ada Lovelace" },
      session: {
        id: "delegate-session-1",
        delegateId: "delegate-1",
        expiresAt: "2025-01-31T00:00:00.000Z",
      },
      resumed: true,
    });
  });

  it("creates a delegate session from manual registration number fallback when the account exists", async () => {
    const result = await registerOrResumeDelegate({
      store: createStore({
        async findDelegateByRegistrationNumber(registrationNumber) {
          return { id: "delegate-1", registrationNumber, fullName: "Grace Hopper" };
        },
      }),
      registrationNumber: " manual-42 ",
      fullName: "",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      ok: true,
      delegate: { id: "delegate-1", registrationNumber: "MANUAL-42", fullName: "Grace Hopper" },
      session: { id: "delegate-session-1", delegateId: "delegate-1" },
      resumed: true,
    });
  });

  it("matches typed and scanned delegate codes without regard to letter case", async () => {
    const lookedUpRegistrationNumbers: string[] = [];
    const store = createStore({
      async findDelegateByRegistrationNumber(registrationNumber) {
        lookedUpRegistrationNumbers.push(registrationNumber);
        return { id: "delegate-1", registrationNumber: "ABCD", fullName: "Ada Lovelace" };
      },
    });

    await registerOrResumeDelegate({ store, registrationNumber: "abcd", fullName: "" });
    await identifyDelegate({ store, badgePayload: "https://event.example/badge?reg=AbCd", fullName: "" });

    expect(lookedUpRegistrationNumbers).toEqual(["ABCD", "ABCD"]);
  });

  it("rejects unknown delegate IDs without creating a session", async () => {
    let sessionCreated = false;

    const result = await registerOrResumeDelegate({
      store: createStore({
        async createDelegateSession() {
          sessionCreated = true;
          throw new Error("should not create session");
        },
      }),
      registrationNumber: "REG-001",
      fullName: "",
    });

    expect(result).toEqual({ ok: false, error: "Delegate account was not found." });
    expect(sessionCreated).toBe(false);
  });

  it("same browser resumes the delegate session", async () => {
    const result = await getDelegateHome({
      store: createStore({
        async readDelegateHome(sessionId, nowIso) {
          expect(sessionId).toBe("delegate-session-1");
          expect(nowIso).toBe("2025-01-02T00:00:00.000Z");
          return createHomeSnapshot();
        },
      }),
      sessionId: "delegate-session-1",
      now: () => new Date("2025-01-02T00:00:00.000Z"),
    });

    expect(result).toEqual({
      identified: true,
      delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
      progress: { stations: [], completedCount: 0, totalRequired: 0, remainingCount: 0, readyForFinalSurvey: false },
      finalSurvey: { available: false, submitted: false, eligible: false, eligibleAt: null },
    });
  });

  it("retries a transient Supabase fetch failure before restoring the delegate home", async () => {
    let attempts = 0;

    const result = await getDelegateHome({
      store: createStore({
        async readDelegateHome() {
          attempts += 1;
          if (attempts === 1) {
            throw new Error("TypeError: fetch failed");
          }

          return createHomeSnapshot();
        },
      }),
      sessionId: "delegate-session-1",
    });

    expect(attempts).toBe(2);
    expect(result).toMatchObject({ identified: true, delegate: ada });
  });

  it("same registration number resumes existing progress without requiring full name", async () => {
    const result = await registerOrResumeDelegate({
      store: createStore({
        async findDelegateByRegistrationNumber(registrationNumber) {
          expect(registrationNumber).toBe("REG-001");
          return { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" };
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
  });
});

describe("delegate station progress", () => {
  it("locks and lists the final station last before the first stamp", async () => {
    const result = await getDelegateHome({
      store: createStore({
        async readDelegateHome() {
          return createHomeSnapshot({
            stations: [
              { id: "final-survey", name: "Final Survey Station" },
              { id: "station-1", name: "AI Booth" },
            ],
          });
        },
      }),
      sessionId: "delegate-session-1",
    });

    expect(result).toMatchObject({
      identified: true,
      progress: {
        stations: [
          { id: "station-1", name: "AI Booth", completed: false, locked: false },
          {
            id: "final-survey",
            name: "Final Survey Station",
            completed: false,
            locked: true,
            lockReason: "Collect every stamp above to unlock this final station.",
          },
        ],
        readyForFinalSurvey: false,
      },
    });
  });

  it("shows active stations as completed or uncompleted with remaining count", async () => {
    const result = await getDelegateHome({
      store: createStore({
        async readDelegateHome() {
          return createHomeSnapshot({
            stations: [
            { id: "station-1", name: "AI Booth" },
            { id: "station-2", name: "Cloud Booth" },
            { id: "station-3", name: "Security Booth" },
            ],
            completedStationIds: ["station-1", "station-3"],
          });
        },
      }),
      sessionId: "delegate-session-1",
    });

    expect(result).toEqual({
      identified: true,
      delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
      progress: {
        stations: [
          { id: "station-1", name: "AI Booth", completed: true, isFinalSurvey: false, locked: false, lockReason: undefined },
          { id: "station-2", name: "Cloud Booth", completed: false, isFinalSurvey: false, locked: false, lockReason: undefined },
          { id: "station-3", name: "Security Booth", completed: true, isFinalSurvey: false, locked: false, lockReason: undefined },
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
        async readDelegateHome() {
          return createHomeSnapshot({
            stations: [{ id: "station-1", name: "AI Booth" }, { id: "station-2", name: "Cloud Booth" }, { id: "final-survey", name: "Final Survey Station" }],
            completedStationIds: ["station-1"],
          });
        },
      }),
      sessionId: "delegate-session-1",
    });
    const complete = await getDelegateHome({
      store: createStore({
        async readDelegateHome() {
          return createHomeSnapshot({
            stations: [{ id: "station-1", name: "AI Booth" }, { id: "final-survey", name: "Final Survey Station" }],
            completedStationIds: ["station-1"],
          });
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
        async readDelegateHome() {
          return createHomeSnapshot({
            stations: [{ id: "station-1", name: "AI Booth" }, { id: "final-survey", name: "Final Survey Station" }],
            completedStationIds: ["station-1", "disabled-station"],
          });
        },
      }),
      sessionId: "delegate-session-1",
    });

    expect(result).toMatchObject({
      identified: true,
      progress: {
        stations: [
          { id: "station-1", name: "AI Booth", completed: true, isFinalSurvey: false, locked: false },
          { id: "final-survey", name: "Final Survey Station", completed: false, isFinalSurvey: true, locked: false },
        ],
        completedCount: 1,
        totalRequired: 2,
        remainingCount: 1,
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
    expect(screen.getByText("Scan Your Conference Badge QR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type code instead" })).toBeInTheDocument();
  });

  it("keeps the QR reader mounted while requesting camera access", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({}) },
    });

    render(await Home({
      delegateHomePromise: Promise.resolve({ identified: false }),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Allow camera access" }));

    expect(document.getElementById("delegate-qr-reader")).toBeInTheDocument();
    expect(screen.getByText("Requesting camera permission...")).toBeInTheDocument();
  });

  it("shows a contact-admin message when a badge code has no pre-created account", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({ registered: false }),
    } as Response);

    render(await Home({
      delegateHomePromise: Promise.resolve({ identified: false }),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Type code instead" }));
    fireEvent.change(screen.getByLabelText("Badge code"), { target: { value: "DLGT0224" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByText("We couldn't find that badge. Please contact admin to create your account.")).toBeInTheDocument());
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();

    fetchMock.mockRestore();
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

    expect(screen.getByRole("heading", { name: "Welcome Ada Lovelace!" })).toBeInTheDocument();
    expect(screen.getByText("#REG-001")).toBeInTheDocument();
    expect(screen.getByText("stations complete")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("stamp remaining")).toBeInTheDocument();
    expect(screen.getByText("AI Booth")).toBeInTheDocument();
    expect(screen.getByText("Cloud Booth")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Final survey" })).not.toBeInTheDocument();
  });

  it("welcomes delegates with their title when one exists", async () => {
    render(await Home({
      delegateHomePromise: Promise.resolve({
        identified: true,
        delegate: { id: "delegate-1", registrationNumber: "REG-001", title: "Dr", fullName: "Ada Lovelace" },
        progress: {
          stations: [],
          completedCount: 0,
          totalRequired: 0,
          remainingCount: 0,
          readyForFinalSurvey: false,
        },
        finalSurvey: { available: false, submitted: false, eligible: false, eligibleAt: null },
      }),
    }));

    expect(screen.getByRole("heading", { name: "Welcome Dr Ada Lovelace!" })).toBeInTheDocument();
  });

  it("shows the locked Final Survey Station before any stamps are collected", async () => {
    render(await Home({
      delegateHomePromise: Promise.resolve({
        identified: true,
        delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
        progress: {
          stations: [
            { id: "station-1", name: "AI Booth", completed: false, isFinalSurvey: false, locked: false },
            {
              id: "final-survey",
              name: "Final Survey Station",
              completed: false,
              isFinalSurvey: true,
              locked: true,
              lockReason: "Collect every stamp above to unlock this final station.",
            },
          ],
          completedCount: 0,
          totalRequired: 2,
          remainingCount: 2,
          readyForFinalSurvey: false,
        },
        finalSurvey: { available: false, submitted: false, eligible: false, eligibleAt: null },
      }),
    }));

    expect(screen.getByLabelText("Final Survey Station, locked")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();

    const lockedStamp = screen.getByLabelText("Final Survey Station, locked");
    const unlockHelp = screen.getByRole("note", { name: "How to unlock the Final Survey Station" });
    expect(lockedStamp).not.toContainElement(unlockHelp);
    expect(unlockHelp).toHaveTextContent("Final Survey Station is locked");
    expect(unlockHelp).toHaveTextContent("Collect every other station stamp first");
  });

  it("shows the Final Survey station unlocked after all regular stations are complete", async () => {
    render(await Home({
      delegateHomePromise: Promise.resolve({
        identified: true,
        delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
        progress: {
          stations: [
            { id: "station-1", name: "AI Booth", completed: true, isFinalSurvey: false, locked: false },
            { id: "final-survey", name: "Final Survey Station", completed: false, isFinalSurvey: true, locked: false },
          ],
          completedCount: 1,
          totalRequired: 2,
          remainingCount: 1,
          readyForFinalSurvey: true,
        },
        finalSurvey: { available: true, submitted: false, eligible: false, eligibleAt: null },
      }),
    }));

    expect(screen.getByText(/Final Survey Station unlocked/)).toBeInTheDocument();
    expect(screen.getByText("Final Survey Station")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit/ })).not.toBeInTheDocument();
  });

  it("shows eligible confirmation instead of the survey after submission", async () => {
    render(await Home({
      delegateHomePromise: Promise.resolve({
        identified: true,
        delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
        progress: {
          stations: [{ id: "final-survey", name: "Final Survey Station", completed: true, isFinalSurvey: true, locked: false }],
          completedCount: 1,
          totalRequired: 1,
          remainingCount: 0,
          readyForFinalSurvey: true,
        },
        finalSurvey: { available: false, submitted: true, eligible: true, eligibleAt: "2025-01-01T00:00:00.000Z" },
      }),
    }));

    expect(screen.getByRole("heading", { name: "You're entered into the lucky draw" })).toBeInTheDocument();
    expect(screen.getByText(/Thanks for completing the quest, Ada Lovelace/)).toBeInTheDocument();
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
