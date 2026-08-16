"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import type { PublicDrawState } from "@/lib/public-draw";
import { createShuffledNameDeck } from "@/lib/shared/name-deck";

type DisplayPhase = "waiting" | "animating" | "revealed";
type Winner = NonNullable<PublicDrawState["winner"]>;

const IDLE_MESSAGE = "READY";
const FALLBACK_SLOT_NAMES = ["Lucky delegate", "Eligible participant", "Next winner"];

function Celebration() {
  return (
    <div className="draw-confetti" aria-hidden="true">
      {Array.from({ length: 54 }, (_, index) => (
        <i
          key={index}
          style={{
            "--x": `${(index * 37) % 101}%`,
            "--delay": `${(index % 9) * 0.11}s`,
            "--duration": `${2.6 + (index % 7) * 0.23}s`,
            "--drift": `${((index * 29) % 240) - 120}px`,
            "--spin": `${360 + (index % 4) * 180}deg`,
            "--tone": index % 6,
          } as React.CSSProperties}
        >
          {index % 3 === 0 ? "✦" : "◆"}
        </i>
      ))}
    </div>
  );
}

export function AdminDrawScreen({
  initialState: _initialState,
  candidateNames = [],
  pollMs = 3000,
  spinDurationMs = 10_000,
  nameDisplayDurationMs = 100,
  minRevealMs,
}: {
  initialState: PublicDrawState;
  candidateNames?: string[];
  pollMs?: number;
  spinDurationMs?: number;
  nameDisplayDurationMs?: number;
  minRevealMs?: number;
}) {
  const mountedAt = useRef(Date.now());
  const [drawState, setDrawState] = useState<PublicDrawState>({ status: "waiting", winner: null });
  const [phase, setPhase] = useState<DisplayPhase>("waiting");
  const [slotName, setSlotName] = useState(IDLE_MESSAGE);
  const [previousSlotName, setPreviousSlotName] = useState(IDLE_MESSAGE);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawPending, setDrawPending] = useState(false);
  const [drawnNames, setDrawnNames] = useState<string[]>([]);
  const visibleWinnerId = useRef<string | null>(null);
  const lastSlotName = useRef(IDLE_MESSAGE);
  const slotTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nameDeck = useRef<ReturnType<typeof createShuffledNameDeck> | null>(null);
  const names = useMemo(() => Array.from(new Set(candidateNames.filter(Boolean))), [candidateNames]);
  const transitionNames = useMemo(
    () => names.filter((name) => !drawnNames.includes(name)),
    [drawnNames, names],
  );
  const revealDelayMs = minRevealMs ?? spinDurationMs;

  function stopSlot() {
    if (slotTimer.current) {
      clearInterval(slotTimer.current);
      slotTimer.current = null;
    }
  }

  function setNextSlotName(next: string) {
    setPreviousSlotName(lastSlotName.current);
    setSlotName(next);
    lastSlotName.current = next;
  }

  function startSlot() {
    stopSlot();
    setPhase("animating");
    const slotNames = transitionNames.length > 0 ? transitionNames : FALLBACK_SLOT_NAMES;
    nameDeck.current = createShuffledNameDeck(slotNames, lastSlotName.current);

    function takeNextDistinctName(previous: string) {
      const attempts = Math.max(1, slotNames.length);
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const next = nameDeck.current?.() ?? previous;
        if (slotNames.length === 1 || next !== previous) return next;
      }
      return slotNames.find((name) => name !== previous) ?? previous;
    }

    const first = takeNextDistinctName(lastSlotName.current);
    const second = takeNextDistinctName(first);
    setPreviousSlotName(first);
    setSlotName(second);
    lastSlotName.current = second;
    slotTimer.current = setInterval(() => {
      setSlotName((current) => {
        const next = takeNextDistinctName(current);
        setPreviousSlotName(current);
        lastSlotName.current = next;
        return next;
      });
    }, nameDisplayDurationMs);
  }

  function revealWinner(winner: Winner, startedAt = Date.now()) {
    const remaining = Math.max(0, revealDelayMs - (Date.now() - startedAt));
    setTimeout(() => {
      stopSlot();
      visibleWinnerId.current = winner.id;
      setDrawnNames((current) =>
        current.includes(winner.fullName) ? current : [...current, winner.fullName],
      );
      setDrawState({ status: "winner", winner });
      setNextSlotName(winner.fullName);
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
      if (cancelled || !next.winner) return;
      if (new Date(next.winner.wonAt).getTime() >= mountedAt.current && next.winner.id !== visibleWinnerId.current) {
        const startedAt = Date.now();
        startSlot();
        revealWinner(next.winner, startedAt);
      }
    }
    const interval = setInterval(poll, pollMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [drawPending, phase, pollMs, revealDelayMs, nameDisplayDurationMs, transitionNames]);

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
      if (result.ok) revealWinner(result.winner, startedAt);
      else {
        stopSlot(); setDrawError(result.error); setNextSlotName(IDLE_MESSAGE); setPhase("waiting"); setDrawPending(false);
      }
    } catch {
      stopSlot(); setDrawError("Could not reach the server."); setNextSlotName(IDLE_MESSAGE); setPhase("waiting"); setDrawPending(false);
    }
  }

  const winner = drawState.winner;
  const status = drawError ?? (phase === "animating" ? "Scanning eligible participants" : phase === "revealed" ? "Congratulations !!!" : "Ready for the draw");

  return (
    <main className={`lucky-draw-screen lucky-draw-screen--${phase}`} id="main" aria-live="polite">
      {phase === "revealed" && winner ? <Celebration /> : null}
      <div className="lucky-draw-grid" aria-hidden="true" />
      <div className="lucky-draw-orb lucky-draw-orb--cyan" aria-hidden="true" />
      <div className="lucky-draw-orb lucky-draw-orb--magenta" aria-hidden="true" />
      <div className="lucky-draw-ring" aria-hidden="true"><svg viewBox="0 0 200 200" fill="none"><circle cx="100" cy="100" r="70" /><circle cx="100" cy="100" r="55" /><circle cx="100" cy="100" r="85" /><circle cx="100" cy="100" r="40" /></svg></div>

      <section className="lucky-draw-console">
        <h1 className="visually-hidden">Lucky Draw</h1>
        <header className="lucky-draw-header">
          <p className="lucky-draw-kicker">5th FFNM x 1st MyBONe ASM 2026</p>
          <p className="lucky-draw-title">5th FFNM x 1st MyBONe ASM 2026 <span>Lucky Draw</span></p>
        </header>

        <div className="lucky-draw-stage">
          <p className="lucky-draw-winner-label">{phase === "revealed" ? "✦ The lucky winner is ✦" : "✦ And the winner is … ✦"}</p>
          <div className="lucky-draw-slot-machine">
            <div className="lucky-draw-slot-window">
              <div className={`lucky-draw-slot-track ${phase === "animating" ? "is-spinning" : ""}`}>
                <div className="lucky-draw-slot-name">{previousSlotName}</div>
                <div className="lucky-draw-slot-name">{slotName}</div>
              </div>
            </div>
          </div>
          <div className="lucky-draw-indicators" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => <span className={`lucky-draw-dot ${phase === "animating" && index % 3 === 0 ? "is-active" : ""}`} key={index} />)}
          </div>
        </div>

        {status ? <p className={`lucky-draw-status ${drawError ? "is-error" : ""}`}>{status}</p> : null}
        <button type="button" className={`lucky-draw-button ${drawPending ? "is-spinning" : ""}`} onClick={handleDraw} disabled={drawPending || phase === "animating"} aria-label="Draw winner">
          <span aria-hidden="true">✦</span>{drawPending ? "DRAWING…" : "START DRAW"}✦
        </button>
      </section>
    </main>
  );
}
