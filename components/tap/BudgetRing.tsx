"use client";

import { useEffect, useRef, useState } from "react";
import type { RingState } from "@/lib/store/selectors";

const SIZE = 84;
const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Today's spend against the daily allowance.
 *
 * The arc is clamped at full — past the allowance it stops growing and turns
 * amber, because a ring that wrapped around twice would read as "nearly
 * there" at 200%. The exact percentage stays in the centre label.
 */
export function BudgetRing({ ring, pulseKey }: { ring: RingState; pulseKey: number }) {
  // Alternating animation names so a repeated tap restarts the pulse — the
  // same name on the same element would be ignored mid-run.
  const [phase, setPhase] = useState(0);
  const previous = useRef(pulseKey);

  useEffect(() => {
    if (pulseKey === previous.current) return;
    previous.current = pulseKey;
    setPhase((n) => n + 1);
  }, [pulseKey]);

  const color = ring.isOver ? "var(--amber)" : "var(--blue)";
  const offset = CIRCUMFERENCE * (1 - ring.ratio);

  const centre = SIZE / 2;

  /**
   * Past 999% the figure stops being information and starts being a layout
   * problem — four characters is what fits inside the ring.
   */
  const label = ring.rawRatio >= 10 ? "999%" : ring.percentLabel;

  return (
    <div
      className="relative shrink-0"
      style={{
        width: SIZE,
        height: SIZE,
        animation:
          phase === 0
            ? undefined
            : `${phase % 2 ? "ringA" : "ringB"} .42s cubic-bezier(.3,1.2,.4,1)`,
      }}
      role="img"
      aria-label={`${ring.percentLabel} of today's budget used`}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle
          cx={centre}
          cy={centre}
          r={RADIUS}
          fill="none"
          stroke="var(--line)"
          strokeWidth="7"
        />
        <circle
          cx={centre}
          cy={centre}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${centre} ${centre})`}
          style={{ transition: "stroke-dashoffset var(--dur-slow) var(--ease-out)" }}
        />
      </svg>

      {/* Just the number. "100%" over "BUDGET" needed more width than the ring
          has interior, so the percentage wrapped and spilled over the stroke —
          and the word was redundant anyway, with the allowance spelled out in
          full immediately to its left. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-mono text-subhead tabular-nums"
          style={{ color: ring.isOver ? "var(--amber-text)" : "var(--text)" }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export default BudgetRing;
