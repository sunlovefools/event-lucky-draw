import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

import { PublicDrawDisplay } from "@/app/draw/public-display";
import { getPublicDrawState, type PublicDrawStore } from "@/lib/public-draw";

function createStore(overrides: Partial<PublicDrawStore> = {}): PublicDrawStore {
  return {
    async findLatestWinner() {
      return null;
    },
    ...overrides,
  };
}

describe("public lucky draw state", () => {
  it("returns a waiting state before any winner is drawn", async () => {
    await expect(getPublicDrawState({ store: createStore() })).resolves.toEqual({ status: "waiting", winner: null });
  });

  it("returns the latest winner for the public display", async () => {
    await expect(
      getPublicDrawState({
        store: createStore({
          async findLatestWinner() {
            return {
              id: "winner-1",
              delegateId: "delegate-1",
              fullName: "Ada Lovelace",
              registrationNumber: "REG-001",
              drawLabel: "Grand Prize",
              wonAt: "2025-01-01T00:10:00.000Z",
            };
          },
        }),
      }),
    ).resolves.toEqual({
      status: "winner",
      winner: {
        id: "winner-1",
        delegateId: "delegate-1",
        fullName: "Ada Lovelace",
        registrationNumber: "REG-001",
        drawLabel: "Grand Prize",
        wonAt: "2025-01-01T00:10:00.000Z",
      },
    });
  });
});

describe("passive public lucky draw display", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("has no public controls", () => {
    render(<PublicDrawDisplay initialState={{ status: "waiting", winner: null }} />);

    expect(screen.getByRole("heading", { name: "Lucky Draw" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("polls for draw state, animates new winners, then reveals the latest winner", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "winner",
        winner: {
          id: "winner-1",
          delegateId: "delegate-1",
          fullName: "Ada Lovelace",
          registrationNumber: "REG-001",
          drawLabel: "Grand Prize",
          wonAt: "2025-01-01T00:10:00.000Z",
        },
      }),
    });
    vi.stubGlobal("fetch", fetch);

    render(<PublicDrawDisplay initialState={{ status: "waiting", winner: null }} pollMs={3000} revealDelayMs={2000} />);

    expect(screen.getByText("Waiting for the next draw")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(fetch).toHaveBeenCalledWith("/api/draw-state", { cache: "no-store" });
    expect(screen.getByText("Shuffling eligible delegates…")).toBeInTheDocument();
    expect(screen.getByText("Grand Prize")).toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText("Winner")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getAllByText(/REG-001/).length).toBeGreaterThan(0);
  });
});
