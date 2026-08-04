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
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Draw winner" }));
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(75);
    });

    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });
});
