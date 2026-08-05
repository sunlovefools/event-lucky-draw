import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DrawSettingsModal } from "@/app/admin/draw-settings-modal";
import { saveDrawSettings, type DrawSettingsStore } from "@/lib/admin/draw-settings";

function createStore(overrides: Partial<DrawSettingsStore> = {}): DrawSettingsStore {
  return {
    async findValidSession() {
      return { id: "session-1", adminId: "admin-1", username: "organizer" };
    },
    async readDrawSettings() {
      return { spinDurationMs: 10_000, nameDisplayDurationMs: 100 };
    },
    async updateDrawSettings(settings) {
      return settings;
    },
    ...overrides,
  };
}

describe("lucky draw settings", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("validates and saves animation timings for an authenticated admin", async () => {
    const updateDrawSettings = vi.fn(async (settings) => settings);
    const result = await saveDrawSettings({
      store: createStore({ updateDrawSettings }),
      sessionId: "session-1",
      settings: { spinDurationMs: 12_000, nameDisplayDurationMs: 250 },
      now: () => new Date("2026-08-05T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      settings: { spinDurationMs: 12_000, nameDisplayDurationMs: 250 },
    });
    expect(updateDrawSettings).toHaveBeenCalledWith({ spinDurationMs: 12_000, nameDisplayDurationMs: 250 });
  });

  it("rejects timings outside the supported range", async () => {
    const updateDrawSettings = vi.fn();
    const result = await saveDrawSettings({
      store: createStore({ updateDrawSettings }),
      sessionId: "session-1",
      settings: { spinDurationMs: 500, nameDisplayDurationMs: 20 },
    });

    expect(result).toEqual({ ok: false, error: "Invalid lucky draw settings." });
    expect(updateDrawSettings).not.toHaveBeenCalled();
  });

  it("previews the configured animation using current eligible candidates without drawing a winner", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(
      <DrawSettingsModal
        settings={{ spinDurationMs: 1_000, nameDisplayDurationMs: 100 }}
        candidateNames={["Ada Lovelace", "Grace Hopper"]}
        redirectTo="/admin"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("dialog", { name: "Animation settings" })).toBeInTheDocument();
    expect(screen.getByText("2 eligible candidates in the current draw pool")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preview animation" }));
    expect(screen.getByRole("button", { name: "Previewing…" })).toBeDisabled();
    expect(screen.queryByText("This preview does not select or record a winner.")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(screen.getByRole("button", { name: "Preview animation" })).toBeEnabled();
    expect(screen.getByText("This preview does not select or record a winner.")).toBeInTheDocument();
  });
});
