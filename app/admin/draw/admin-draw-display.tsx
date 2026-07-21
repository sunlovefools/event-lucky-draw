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

type Winner = NonNullable<PublicDrawState["winner"]>;

export function AdminDrawScreen({
  initialState,
  roundNumber,
  pollMs = 3000,
  revealDelayMs = 2600,
}: {
  initialState: PublicDrawState;
  roundNumber: number;
  pollMs?: number;
  revealDelayMs?: number;
}) {
  const [drawState, setDrawState] = useState<PublicDrawState>(initialState);
  const [phase, setPhase] = useState<DisplayPhase>(initialState.status === "winner" ? "revealed" : "waiting");
  const [scramble, setScramble] = useState("");
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawPending, setDrawPending] = useState(false);
  const visibleWinnerId = useRef(initialState.winner?.id ?? null);

  // Poll so a draw triggered from another window still reveals here.
  useEffect(() => {
    let cancelled = false;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let scrambleTimer: ReturnType<typeof setInterval> | undefined;

    async function poll() {
      const response = await fetch("/api/draw-state", { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as PublicDrawState;
      if (cancelled) return;

      const nextId = next.winner?.id ?? null;
      if (nextId && nextId !== visibleWinnerId.current) {
        setDrawState(next);
        setPhase("animating");
        if (scrambleTimer) clearInterval(scrambleTimer);
        scrambleTimer = setInterval(() => setScramble(randomGlyphs(10)), 70);
        if (revealTimer) clearTimeout(revealTimer);
        revealTimer = setTimeout(() => {
          if (scrambleTimer) clearInterval(scrambleTimer);
          visibleWinnerId.current = nextId;
          setPhase("revealed");
        }, revealDelayMs);
      } else if (!nextId) {
        if (scrambleTimer) clearInterval(scrambleTimer);
        visibleWinnerId.current = null;
        setPhase("waiting");
      }
    }

    const interval = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (revealTimer) clearTimeout(revealTimer);
      if (scrambleTimer) clearInterval(scrambleTimer);
    };
  }, [pollMs, revealDelayMs]);

  async function handleDraw() {
    setDrawError(null);
    setDrawPending(true);
    setPhase("animating");
    const scrambleTimer = setInterval(() => setScramble(randomGlyphs(10)), 70);

    try {
      const response = await fetch("/api/draw", { method: "POST" });
      const result = (await response.json()) as { ok: true; winner: Winner } | { ok: false; error: string };
      if (result.ok) {
        setTimeout(() => {
          clearInterval(scrambleTimer);
          visibleWinnerId.current = result.winner.id;
          setDrawState({ status: "winner", winner: result.winner });
          setPhase("revealed");
          setDrawPending(false);
        }, revealDelayMs);
      } else {
        clearInterval(scrambleTimer);
        setDrawError(result.error);
        setPhase(drawState.status === "winner" ? "revealed" : "waiting");
        setDrawPending(false);
      }
    } catch {
      clearInterval(scrambleTimer);
      setDrawError("Could not reach the server.");
      setPhase(drawState.status === "winner" ? "revealed" : "waiting");
      setDrawPending(false);
    }
  }

  const winner = drawState.winner;

  return (
    <main className="public-stage" id="main" aria-live="polite">
      {phase === "revealed" && winner ? <Confetti /> : null}

      <div className="draw-card">
        <p className="eyebrow">Admin · Round {roundNumber}</p>
        <h1>Lucky Draw</h1>

        {phase === "waiting" || !winner ? (
          <div className="center" style={{ marginTop: "2rem" }}>
            <div className="pulse-ring" />
            <p className="draw-label">Waiting for the next draw</p>
            <p className="draw-winner-reg">Press “Draw winner” to pick a lucky delegate.</p>
          </div>
        ) : null}

        {phase === "animating" && winner ? (
          <div className="center" style={{ marginTop: "2rem" }}>
            <p className="draw-label">Round {roundNumber}</p>
            <p className="shuffle" aria-hidden="true">{scramble || randomGlyphs(10)}</p>
            <p className="draw-winner-reg">Shuffling eligible delegates…</p>
          </div>
        ) : null}

        {phase === "revealed" && winner ? (
          <div className="center reveal" style={{ marginTop: "1.5rem" }}>
            <p className="draw-label">Round {roundNumber}</p>
            <p className="draw-winner-name">{winner.fullName}</p>
            <p className="draw-winner-reg">Registration #{winner.registrationNumber}</p>
            <span className="draw-ticket">Winner</span>
          </div>
        ) : null}

        <div className="draw-actions" style={{ marginTop: "2rem" }}>
          <button
            type="button"
            className="btn btn-accent btn-lg"
            onClick={handleDraw}
            disabled={drawPending || phase === "animating"}
          >
            {drawPending ? "Drawing…" : "Draw winner"}
          </button>
          {drawError ? (
            <p className="alert alert-danger" style={{ marginTop: "1rem" }}>{drawError}</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
