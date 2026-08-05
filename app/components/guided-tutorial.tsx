"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type TutorialStep = {
  title: string;
  message: string;
  target?: string;
  effect?: string;
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: string;
};

type GuidedTutorialProps = {
  id: string;
  steps: TutorialStep[];
  label?: string;
  launcherClassName?: string;
  version?: number;
};

const SPOTLIGHT_GAP = 8;

function completionKey(id: string, version: number) {
  return `event-quest-tutorial:${id}:v${version}`;
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.4 2.4 0 0 1 4.65.8c0 1.6-2.45 1.7-2.45 3.2" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

export function GuidedTutorial({ id, steps, label = "How To", launcherClassName = "", version = 1 }: GuidedTutorialProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const step = steps[stepIndex];
  const key = completionKey(id, version);

  useEffect(() => {
    setMounted(true);
    try {
      if (!window.localStorage.getItem(key)) setOpen(true);
    } catch {
      // Storage can be unavailable in privacy modes; the tutorial still works.
      setOpen(true);
    }
  }, [key]);

  const measureTarget = useCallback(() => {
    if (!open || !step?.target) {
      setSpotlight(null);
      return;
    }

    const target = document.querySelector<HTMLElement>(step.target);
    if (!target) {
      setSpotlight(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      setSpotlight(null);
      return;
    }

    const top = Math.max(8, rect.top - SPOTLIGHT_GAP);
    const left = Math.max(8, rect.left - SPOTLIGHT_GAP);
    const right = Math.min(window.innerWidth - 8, rect.right + SPOTLIGHT_GAP);
    const bottom = Math.min(window.innerHeight - 8, rect.bottom + SPOTLIGHT_GAP);
    const nextSpotlight = {
      top,
      left,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
      borderRadius: getComputedStyle(target).borderRadius || "16px",
    };
    setSpotlight((current) => (
      current
      && current.top === nextSpotlight.top
      && current.left === nextSpotlight.left
      && current.width === nextSpotlight.width
      && current.height === nextSpotlight.height
      && current.borderRadius === nextSpotlight.borderRadius
        ? current
        : nextSpotlight
    ));
  }, [open, step?.target]);

  useLayoutEffect(() => {
    if (!open) return;

    if (step?.effect) document.body.dataset.tutorialEffect = step.effect;
    else delete document.body.dataset.tutorialEffect;

    const target = step?.target ? document.querySelector<HTMLElement>(step.target) : null;

    setSpotlight(null);

    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
      const rect = target.getBoundingClientRect();
      const desiredCenter = window.innerHeight * 0.36;
      const currentCenter = rect.top + rect.height / 2;
      const scrollAdjustment = currentCenter - desiredCenter;
      if (Math.abs(scrollAdjustment) > 1 && typeof window.scrollBy === "function") {
        window.scrollBy({ top: scrollAdjustment, left: 0, behavior: "auto" });
      }
    }

    measureTarget();
    const focusTimer = window.setTimeout(() => titleRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      if (step?.effect && document.body.dataset.tutorialEffect === step.effect) {
        delete document.body.dataset.tutorialEffect;
      }
    };
  }, [measureTarget, open, step?.effect, step?.target, stepIndex]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const queueResizeMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureTarget);
    };
    window.addEventListener("resize", queueResizeMeasure);
    window.addEventListener("scroll", queueResizeMeasure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", queueResizeMeasure);
      window.removeEventListener("scroll", queueResizeMeasure, true);
    };
  }, [measureTarget, open]);

  const close = useCallback((outcome: "completed" | "skipped") => {
    try {
      window.localStorage.setItem(key, outcome);
    } catch {
      // Closing must always remain available, even if storage is unavailable.
    }
    setOpen(false);
    setSpotlight(null);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, [key]);

  const next = useCallback(() => {
    if (stepIndex >= steps.length - 1) close("completed");
    else setStepIndex((current) => current + 1);
  }, [close, stepIndex, steps.length]);

  const back = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close("skipped");
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") back();
      if (event.key === "Tab" && sheetRef.current) {
        const controls = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])"),
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [back, close, next, open]);

  const openTutorial = () => {
    setStepIndex(0);
    setOpen(true);
  };

  const sheetPosition = (() => {
    if (mounted && window.innerWidth > window.innerHeight && window.innerHeight <= 600) {
      return "tutorial-sheet--side-right";
    }
    if (spotlight && spotlight.top + spotlight.height / 2 > window.innerHeight / 2) {
      return "tutorial-sheet--top";
    }
    return "tutorial-sheet--bottom";
  })();

  return (
    <>
      <button ref={launcherRef} type="button" className={`btn btn-sm btn-ghost tutorial-launcher ${launcherClassName}`.trim()} onClick={openTutorial}>
        <HelpIcon />
        {label}
      </button>

      {mounted && open && step ? createPortal(
        <div className="tutorial-layer">
          {spotlight ? (
            <div
              className="tutorial-spotlight"
              style={{
                top: spotlight.top,
                left: spotlight.left,
                width: spotlight.width,
                height: spotlight.height,
                borderRadius: spotlight.borderRadius,
              }}
            />
          ) : (
            <div className="tutorial-shade tutorial-shade--full" />
          )}

          <section
            ref={sheetRef}
            className={`tutorial-sheet ${sheetPosition}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-tutorial-title`}
            aria-describedby={`${id}-tutorial-message`}
            onTouchStart={(event) => {
              const touch = event.changedTouches[0];
              touchStart.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchEnd={(event) => {
              const start = touchStart.current;
              const touch = event.changedTouches[0];
              touchStart.current = null;
              if (!start) return;
              const dx = touch.clientX - start.x;
              const dy = touch.clientY - start.y;
              if (Math.abs(dx) < 52 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
              if (dx < 0) next();
              else back();
            }}
          >
            <div className="tutorial-progress-row">
              <span>Step {stepIndex + 1} of {steps.length}</span>
              <button type="button" className="tutorial-close" aria-label="Close tutorial" onClick={() => close("skipped")}>
                <CloseIcon />
              </button>
            </div>
            <div className="tutorial-progress" aria-hidden="true">
              <span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
            </div>

            <div className="tutorial-copy" aria-live="polite">
              <h2 id={`${id}-tutorial-title`} ref={titleRef} tabIndex={-1}>{step.title}</h2>
              <p id={`${id}-tutorial-message`}>{step.message}</p>
            </div>

            <div className="tutorial-actions">
              <button type="button" className="btn btn-ghost" disabled={stepIndex === 0} onClick={back}>
                <ChevronIcon direction="left" />
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={next}>
                {stepIndex === steps.length - 1 ? "Done" : "Next"}
                {stepIndex < steps.length - 1 ? <ChevronIcon direction="right" /> : null}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
