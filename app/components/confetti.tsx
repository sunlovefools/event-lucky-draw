"use client";

import React, { useMemo } from "react";

const COLORS = ["#2563eb", "#059669", "#f59e0b", "#ec4899", "#22d3ee", "#a855f7"];

// Lightweight CSS confetti burst for the winner reveal. Respecting
// prefers-reduced-motion is handled globally in globals.css (animations off).
export function Confetti({ count = 80 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const color = COLORS[i % COLORS.length];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.4 + Math.random() * 1.8;
        const size = 6 + Math.random() * 8;
        return { color, left, delay, duration, size, id: i };
      }),
    [count],
  );

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <i
          key={p.id}
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: `${p.size}px`,
            height: `${p.size * 1.6}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
