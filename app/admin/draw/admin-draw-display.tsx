"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { Confetti } from "@/app/components/confetti";
import type { PublicDrawState } from "@/lib/public-draw";

type DisplayPhase = "waiting" | "animating" | "revealed";

type Winner = NonNullable<PublicDrawState["winner"]>;

const IDLE_MESSAGE = "Click the button to see who is the lucky one.";
const FALLBACK_SLOT_NAMES = ["Lucky delegate", "Eligible participant", "Next winner"];

function pickSlotName(names: string[], previous: string) {
  const pool = names.length > 0 ? names : FALLBACK_SLOT_NAMES;
  if (pool.length === 1) return pool[0];

  let next = previous;
  while (next === previous) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  return next;
}

export function AdminDrawScreen({
  initialState: _initialState,
  candidateNames = [],
  pollMs = 3000,
  minRevealMs = 900,
}: {
  initialState: PublicDrawState;
  candidateNames?: string[];
  pollMs?: number;
  minRevealMs?: number;
}) {
  // Fresh page loads must always start idle, regardless of any winner the server
  // may still have in history. Only draws observed after this mount are revealed.
  const mountedAt = useRef(Date.now());
  const [drawState, setDrawState] = useState<PublicDrawState>({ status: "waiting", winner: null });
  const [phase, setPhase] = useState<DisplayPhase>("waiting");
  const [slotName, setSlotName] = useState(IDLE_MESSAGE);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawPending, setDrawPending] = useState(false);
  const visibleWinnerId = useRef<string | null>(null);
  const slotTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const names = useMemo(() => candidateNames.filter(Boolean), [candidateNames]);

  function stopSlot() {
    if (slotTimer.current) {
      clearInterval(slotTimer.current);
      slotTimer.current = null;
    }
  }

  function startSlot() {
    stopSlot();
    setPhase("animating");
    setSlotName((current) => pickSlotName(names, current));
    slotTimer.current = setInterval(() => {
      setSlotName((current) => pickSlotName(names, current));
    }, 65);
  }

  function revealWinner(winner: Winner, startedAt = Date.now()) {
    const remaining = Math.max(0, minRevealMs - (Date.now() - startedAt));
    setTimeout(() => {
      stopSlot();
      visibleWinnerId.current = winner.id;
      setDrawState({ status: "winner", winner });
      setSlotName(winner.fullName);
      setPhase("revealed");
      setDrawPending(false);
    }, remaining);
  }

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (drawPending || phase === "animating") return;
      const response = await fetch("/api/draw-state", { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as PublicDrawState;
      if (cancelled) return;

      const nextWinner = next.winner;
      if (!nextWinner) return;

      const wonAfterMount = new Date(nextWinner.wonAt).getTime() >= mountedAt.current;
      if (wonAfterMount && nextWinner.id !== visibleWinnerId.current) {
        const startedAt = Date.now();
        startSlot();
        revealWinner(nextWinner, startedAt);
      }
    }

    const interval = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
      stopSlot();
    };
  }, [drawPending, phase, pollMs, minRevealMs, names]);

  useEffect(() => () => stopSlot(), []);

  async function handleDraw() {
    const startedAt = Date.now();
    setDrawError(null);
    setDrawPending(true);
    setDrawState({ status: "waiting", winner: null });
    startSlot();

    try {
      const response = await fetch("/api/draw", { method: "POST", credentials: "include" });
      const result = (await response.json()) as { ok: true; winner: Winner } | { ok: false; error: string };
      if (result.ok) {
        revealWinner(result.winner, startedAt);
      } else {
        stopSlot();
        setDrawError(result.error);
        setSlotName(IDLE_MESSAGE);
        setPhase("waiting");
        setDrawPending(false);
      }
    } catch {
      stopSlot();
      setDrawError("Could not reach the server.");
      setSlotName(IDLE_MESSAGE);
      setPhase("waiting");
      setDrawPending(false);
    }
  }

  const winner = drawState.winner;

  return (
    <main className="public-stage" id="main" aria-live="polite">
      {phase === "revealed" && winner ? <Confetti /> : null}

      <div className="draw-card draw-card--fullscreen">
        <p className="eyebrow">Admin display</p>
        <h1>Lucky Draw</h1>

        {phase === "waiting" ? (
          <div className="center draw-screen-state">
            <div className="pulse-ring" />
            <p className="draw-label">Ready</p>
            <p className="draw-idle-message">{IDLE_MESSAGE}</p>
          </div>
        ) : null}

        {phase === "animating" ? (
          <div className="center draw-screen-state">
            <p className="draw-label">Shuffling eligible participants</p>
            <p className="shuffle slot-name" aria-hidden="true">{slotName}</p>
            <p className="draw-winner-reg">Finding the lucky one…</p>
          </div>
        ) : null}

        {phase === "revealed" && winner ? (
          <div className="center reveal draw-screen-state">
            <p className="draw-label">The lucky one is</p>
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
