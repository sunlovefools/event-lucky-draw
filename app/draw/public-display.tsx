"use client";

import React, { useEffect, useRef, useState } from "react";

import { Confetti } from "@/app/components/confetti";
import type { PublicDrawState } from "@/lib/public-draw";

type DisplayPhase = "waiting" | "animating" | "revealed";

const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomGlyphs(len: number) {
  let s = "";
  for (let i = 0; i < len; i++) s += SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
  return s;
}

export function PublicDrawDisplay({
  initialState,
  pollMs = 3000,
  revealDelayMs = 2600,
}: {
  initialState: PublicDrawState;
  pollMs?: number;
  revealDelayMs?: number;
}) {
  const [drawState, setDrawState] = useState<PublicDrawState>(initialState);
  const [phase, setPhase] = useState<DisplayPhase>(initialState.status === "winner" ? "revealed" : "waiting");
  const [scramble, setScramble] = useState("");
  const visibleWinnerId = useRef(initialState.winner?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let scrambleTimer: ReturnType<typeof setInterval> | undefined;

    async function pollDrawState() {
      const response = await fetch("/api/draw-state", { cache: "no-store" });
      if (!response.ok) return;
      const nextState = (await response.json()) as PublicDrawState;
      if (cancelled) return;

      const nextWinnerId = nextState.winner?.id ?? null;
      const isNewWinner = nextWinnerId && nextWinnerId !== visibleWinnerId.current;
      setDrawState(nextState);

      if (isNewWinner) {
        setPhase("animating");
        if (scrambleTimer) clearInterval(scrambleTimer);
        scrambleTimer = setInterval(() => setScramble(randomGlyphs(10)), 70);
        if (revealTimer) clearTimeout(revealTimer);
        revealTimer = setTimeout(() => {
          if (scrambleTimer) clearInterval(scrambleTimer);
          visibleWinnerId.current = nextWinnerId;
          setPhase("revealed");
        }, revealDelayMs);
      } else if (!nextWinnerId) {
        if (scrambleTimer) clearInterval(scrambleTimer);
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
      if (revealTimer) clearTimeout(revealTimer);
      if (scrambleTimer) clearInterval(scrambleTimer);
    };
  }, [pollMs, revealDelayMs]);

  const winner = drawState.winner;

  return (
    <main className="public-stage" id="main" aria-live="polite">
      {phase === "revealed" && winner ? <Confetti /> : null}

      <div className="draw-card">
        <p className="eyebrow">Public display</p>
        <h1>Lucky Draw</h1>

        {phase === "waiting" || !winner ? (
          <div className="center" style={{ marginTop: "2rem" }}>
            <div className="pulse-ring" />
            <p className="draw-label">Waiting for the next draw</p>
            <p className="draw-winner-reg">The next winner will appear here automatically.</p>
          </div>
        ) : null}

        {phase === "animating" && winner ? (
          <div className="center" style={{ marginTop: "2rem" }}>
            <p className="draw-label">{winner.drawLabel}</p>
            <p className="shuffle" aria-hidden="true">{scramble || randomGlyphs(10)}</p>
            <p className="draw-winner-reg">Shuffling eligible delegates…</p>
          </div>
        ) : null}

        {phase === "revealed" && winner ? (
          <div className="center reveal" style={{ marginTop: "1.5rem" }}>
            <p className="draw-label">{winner.drawLabel}</p>
            <p className="draw-winner-name">{winner.fullName}</p>
            <p className="draw-winner-reg">Registration #{winner.registrationNumber}</p>
            <span className="draw-ticket">Winner</span>
          </div>
        ) : null}
      </div>
    </main>
  );
}
