import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DelegateStamps } from "@/app/components/delegate-stamps";
import { GuidedTutorial } from "@/app/components/guided-tutorial";
import { Home } from "@/app/home";

describe("guided tutorial", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    document.querySelector("[data-test-tour-target]")?.remove();
    vi.restoreAllMocks();
  });

  it("opens on first visit, supports navigation, and remembers completion", async () => {
    const view = render(
      <GuidedTutorial
        id="test-tour"
        steps={[
          { title: "First instruction", message: "Start here." },
          { title: "Final instruction", message: "Finish here." },
        ]}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "First instruction" });
    expect(dialog).toBeInTheDocument();
    expect(document.querySelector(".tutorial-shade--full")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.queryByText("50%")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip Tutorial" })).not.toBeInTheDocument();
    const closeButton = screen.getByRole("button", { name: "Close tutorial" });
    expect(closeButton).toBeInTheDocument();
    expect(closeButton.closest(".tutorial-progress-row")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByRole("dialog", { name: "Final instruction" })).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.localStorage.getItem("event-quest-tutorial:test-tour:v1")).toBe("completed");

    view.unmount();
    render(
      <GuidedTutorial
        id="test-tour"
        steps={[{ title: "First instruction", message: "Start here." }]}
      />,
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "How To" }));
    expect(screen.getByRole("dialog", { name: "First instruction" })).toBeInTheDocument();
  });

  it("uses the close button to skip without blocking the page", async () => {
    render(<GuidedTutorial id="skip-tour" steps={[{ title: "Only step", message: "Optional help." }]} />);

    expect(await screen.findByRole("dialog", { name: "Only step" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close tutorial" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.localStorage.getItem("event-quest-tutorial:skip-tour:v1")).toBe("skipped");
    expect(screen.getByRole("button", { name: "How To" })).toBeInTheDocument();
  });

  it("places the tutorial panel opposite a lower-screen spotlight without a delayed jump", async () => {
    const target = document.createElement("div");
    target.dataset.testTourTarget = "true";
    target.style.borderRadius = "18px";
    target.getBoundingClientRect = vi.fn(() => ({
      top: 580,
      right: 340,
      bottom: 680,
      left: 20,
      width: 320,
      height: 100,
      x: 20,
      y: 580,
      toJSON: () => ({}),
    }));
    document.body.appendChild(target);

    render(
      <GuidedTutorial
        id="stationary-tour"
        steps={[
          { title: "Welcome", message: "No target." },
          { title: "Target", message: "Targeted step.", target: "[data-test-tour-target]" },
        ]}
      />,
    );

    expect(await screen.findByRole("dialog", { name: "Welcome" })).toHaveClass("tutorial-sheet--bottom");
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    const spotlight = document.querySelector(".tutorial-spotlight");
    expect(spotlight).toBeInTheDocument();
    expect(spotlight).toHaveStyle({ borderRadius: "18px" });
    expect(screen.getByRole("dialog", { name: "Target" })).toHaveClass("tutorial-sheet--top");
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    expect(screen.getByRole("dialog", { name: "Target" })).toHaveClass("tutorial-sheet--top");
  });

  it("keeps the spotlight attached to its element while the page scrolls", async () => {
    let targetTop = 180;
    const target = document.createElement("div");
    target.dataset.testTourTarget = "true";
    target.style.borderRadius = "16px";
    target.getBoundingClientRect = vi.fn(() => ({
      top: targetTop,
      right: 340,
      bottom: targetTop + 100,
      left: 20,
      width: 320,
      height: 100,
      x: 20,
      y: targetTop,
      toJSON: () => ({}),
    }));
    document.body.appendChild(target);

    render(
      <GuidedTutorial
        id="scroll-tour"
        steps={[{ title: "Target", message: "Follow this.", target: "[data-test-tour-target]" }]}
      />,
    );

    await screen.findByRole("dialog", { name: "Target" });
    expect(document.querySelector(".tutorial-spotlight")).toHaveStyle({ top: "172px" });
    targetTop = 80;
    fireEvent.scroll(window);
    await waitFor(() => expect(document.querySelector(".tutorial-spotlight")).toHaveStyle({ top: "72px" }));
  });

  it("positions a targeted element near the upper-center viewing area", async () => {
    const target = document.createElement("div");
    target.dataset.testTourTarget = "true";
    target.scrollIntoView = vi.fn();
    target.getBoundingClientRect = vi.fn(() => ({
      top: 350,
      right: 340,
      bottom: 450,
      left: 20,
      width: 320,
      height: 100,
      x: 20,
      y: 350,
      toJSON: () => ({}),
    }));
    document.body.appendChild(target);
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});

    render(
      <GuidedTutorial
        id="upper-center-tour"
        steps={[{ title: "Target", message: "Upper center.", target: "[data-test-tour-target]" }]}
      />,
    );

    await screen.findByRole("dialog", { name: "Target" });
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center", inline: "nearest" });
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({
      top: 400 - window.innerHeight * 0.36,
      behavior: "auto",
    }));
  });

  it("activates and clears a tutorial-only demonstration effect", async () => {
    render(
      <GuidedTutorial
        id="effect-tour"
        steps={[
          { title: "Start", message: "Start." },
          { title: "Demo", message: "Demo.", effect: "stamp-demo" },
        ]}
      />,
    );

    await screen.findByRole("dialog", { name: "Start" });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(document.body).toHaveAttribute("data-tutorial-effect", "stamp-demo");
    fireEvent.click(screen.getByRole("button", { name: "Close tutorial" }));
    await waitFor(() => expect(document.body).not.toHaveAttribute("data-tutorial-effect"));
  });
});

describe("delegate tutorial targets", () => {
  it("opens automatically when an identified delegate reaches the home page", async () => {
    window.localStorage.clear();
    render(await Home({
      delegateHomePromise: Promise.resolve({
        identified: true,
        delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
        progress: {
          stations: [
            { id: "regular-1", name: "First Booth", completed: false, isFinalSurvey: false, locked: false },
            { id: "final", name: "Final Survey Station", completed: false, isFinalSurvey: true, locked: true },
          ],
          completedCount: 0,
          totalRequired: 2,
          remainingCount: 2,
          readyForFinalSurvey: false,
        },
        finalSurvey: { available: false, submitted: false, eligible: false, eligibleAt: null },
      }),
    }));

    expect(await screen.findByRole("dialog", { name: "Welcome to the FFNM & MyBone Lucky Draw Challenge" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
  });

  it("finds the final survey by station type even when its position changes", () => {
    const { container } = render(
      <DelegateStamps
        delegateId="delegate-1"
        stations={[
          { id: "regular-1", name: "First Booth", completed: false, isFinalSurvey: false, locked: false },
          { id: "final", name: "Final Survey Station", completed: false, isFinalSurvey: true, locked: true },
          { id: "regular-2", name: "Last Booth", completed: false, isFinalSurvey: false, locked: false },
        ]}
      />,
    );

    const finalTarget = container.querySelector("[data-tutorial='delegate-final-station']");
    expect(finalTarget).toHaveTextContent("Final Survey Station");
    expect(container.querySelectorAll("[data-tutorial='delegate-station']")).toHaveLength(2);
  });
});
