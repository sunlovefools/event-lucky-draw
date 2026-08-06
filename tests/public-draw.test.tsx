import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { AdminDrawScreen } from "@/app/admin/draw/admin-draw-display";
import { getPublicDrawState, type PublicDrawStore } from "@/lib/public-draw";

function createStore(overrides: Partial<PublicDrawStore> = {}): PublicDrawStore {
  return {
    async findLatestWinner() {
      return null;
    },
    ...overrides,
  };
}

const winner = {
  id: "winner-1",
  delegateId: "delegate-1",
  fullName: "Ada Lovelace",
  registrationNumber: "REG-001",
  roundId: "round-1",
  roundNumber: 1,
  wonAt: "2025-01-01T00:10:00.000Z",
};

describe("lucky draw state", () => {
  it("returns a waiting state before any winner is drawn", async () => {
    await expect(getPublicDrawState({ store: createStore() })).resolves.toEqual({ status: "waiting", winner: null });
  });

  it("returns the latest winner for the draw display", async () => {
    await expect(
      getPublicDrawState({
        store: createStore({
          async findLatestWinner() {
            return winner;
          },
        }),
      }),
    ).resolves.toEqual({ status: "winner", winner });
  });
});

describe("admin lucky draw display", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the admin draw control", () => {
    render(<AdminDrawScreen initialState={{ status: "waiting", winner: null }} />);

    expect(screen.getByRole("heading", { name: "Lucky Draw" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draw winner" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("polls for draw state, animates new winners, then reveals the latest winner", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "winner",
        winner: { ...winner, wonAt: new Date(Date.now() + 1000).toISOString() },
      }),
    });
    vi.stubGlobal("fetch", fetch);

    render(<AdminDrawScreen initialState={{ status: "waiting", winner: null }} pollMs={3000} minRevealMs={2000} />);

    expect(screen.getByText("Ready for the draw")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(fetch).toHaveBeenCalledWith("/api/draw-state", { cache: "no-store" });
    expect(screen.getByText("Scanning eligible participants")).toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText("✦ The lucky winner is ✦")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Congratulations !!!")).toBeInTheDocument();
    expect(screen.queryByText(/Registration #REG-001/)).not.toBeInTheDocument();
  });

  it("keeps rotating names during a draw when only three candidates are eligible", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValue(0.5);
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(
      <AdminDrawScreen
        initialState={{ status: "waiting", winner: null }}
        candidateNames={["Ada Lovelace", "Grace Hopper", "Katherine Johnson"]}
        nameDisplayDurationMs={75}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Draw winner" }));
    expect(screen.getByText("Katherine Johnson")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(75);
    });

    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("never displays the same name twice consecutively with five eligible candidates", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const candidates = Array.from({ length: 5 }, (_, index) => `Person ${index + 1}`);
    const { container } = render(
      <AdminDrawScreen
        initialState={{ status: "waiting", winner: null }}
        candidateNames={candidates}
        pollMs={60_000}
        nameDisplayDurationMs={20}
      />,
    );

    const currentName = () =>
      container.querySelectorAll<HTMLElement>(".lucky-draw-slot-name").item(1).textContent;

    fireEvent.click(screen.getByRole("button", { name: "Draw winner" }));
    const displayedNames = [currentName()];

    for (let step = 0; step < 25; step += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });
      displayedNames.push(currentName());
    }

    expect(displayedNames).toHaveLength(26);
    expect(new Set(displayedNames)).toEqual(new Set(candidates));
    for (let index = 1; index < displayedNames.length; index += 1) {
      expect(displayedNames[index]).not.toBe(displayedNames[index - 1]);
    }
  });

  it("removes a revealed winner from the next draw transition", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const personFour = {
      ...winner,
      id: "winner-4",
      delegateId: "delegate-4",
      fullName: "Person 4",
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, winner: personFour }),
      })
      .mockImplementationOnce(() => new Promise(() => undefined));
    vi.stubGlobal("fetch", fetch);

    render(
      <AdminDrawScreen
        initialState={{ status: "waiting", winner: null }}
        candidateNames={Array.from({ length: 10 }, (_, index) => `Person ${index + 1}`)}
        pollMs={60_000}
        spinDurationMs={0}
        nameDisplayDurationMs={20}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Draw winner" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Person 4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Draw winner" }));
    expect(screen.queryByText("Person 4")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.queryByText("Person 4")).not.toBeInTheDocument();
  });
});
