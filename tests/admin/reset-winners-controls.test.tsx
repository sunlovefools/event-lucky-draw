import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { ResetWinnersControls } from "@/app/admin/reset-winners-controls";

describe("reset winner controls", () => {
  it("confirms before submitting a winner reset", () => {
    const { container } = render(<ResetWinnersControls />);

    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("Reset confirmation dialog is missing");
    expect(dialog).not.toHaveAttribute("open");

    fireEvent.click(screen.getByRole("button", { name: "Reset winners" }));
    expect(screen.getByRole("dialog", { name: "Reset winner history?" })).toBe(dialog);
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByText(/returns them to the eligible draw pool/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog).not.toHaveAttribute("open");
  });

  it("refreshes the overview to show the latest winner", () => {
    render(<ResetWinnersControls />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(refresh).toHaveBeenCalledOnce();
  });
});
