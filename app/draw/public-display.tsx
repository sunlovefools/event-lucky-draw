"use client";

import React, { useEffect, useRef, useState } from "react";

import type { PublicDrawState } from "@/lib/public-draw";

type DisplayPhase = "waiting" | "animating" | "revealed";

export function PublicDrawDisplay({
  initialState,
  pollMs = 3000,
  revealDelayMs = 2500,
}: {
  initialState: PublicDrawState;
  pollMs?: number;
  revealDelayMs?: number;
}) {
  const [drawState, setDrawState] = useState<PublicDrawState>(initialState);
  const [phase, setPhase] = useState<DisplayPhase>(initialState.status === "winner" ? "revealed" : "waiting");
  const visibleWinnerId = useRef(initialState.winner?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;

    async function pollDrawState() {
      const response = await fetch("/api/draw-state", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const nextState = (await response.json()) as PublicDrawState;
      if (cancelled) {
        return;
      }

      const nextWinnerId = nextState.winner?.id ?? null;
      const isNewWinner = nextWinnerId && nextWinnerId !== visibleWinnerId.current;
      setDrawState(nextState);

      if (isNewWinner) {
        setPhase("animating");
        if (revealTimer) {
          clearTimeout(revealTimer);
        }
        revealTimer = setTimeout(() => {
          visibleWinnerId.current = nextWinnerId;
          setPhase("revealed");
        }, revealDelayMs);
      } else if (!nextWinnerId) {
        visibleWinnerId.current = null;
        setPhase("waiting");
      }
    }

    const interval = setInterval(() => {
      void pollDrawState();
    }, pollMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (revealTimer) {
        clearTimeout(revealTimer);
      }
    };
  }, [pollMs, revealDelayMs]);

  const winner = drawState.winner;

  return (
    <main className="shell public-display" aria-live="polite">
      <section className="hero" aria-labelledby="public-draw-title">
        <p className="eyebrow">Public display</p>
        <h1 id="public-draw-title">Lucky draw</h1>
      </section>

      {phase === "waiting" || !winner ? (
        <section className="health-card" aria-labelledby="waiting-title">
          <h2 id="waiting-title">Waiting for the next draw</h2>
          <p className="lead">The next winner will appear here automatically.</p>
        </section>
      ) : null}

      {phase === "animating" && winner ? (
        <section className="health-card" aria-labelledby="drawing-title">
          <h2 id="drawing-title">Drawing now…</h2>
          <p className="eyebrow">{winner.drawLabel}</p>
          <p className="lead">Shuffling eligible delegates…</p>
        </section>
      ) : null}

      {phase === "revealed" && winner ? (
        <section className="health-card" aria-labelledby="winner-title">
          <p className="eyebrow">{winner.drawLabel}</p>
          <h2 id="winner-title">Winner revealed</h2>
          <p className="lead">{winner.fullName}</p>
          <p>{winner.registrationNumber}</p>
        </section>
      ) : null}
    </main>
  );
}
