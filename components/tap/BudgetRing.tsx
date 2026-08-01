"use client";

import { useEffect, useRef, useState } from "react";
import type { RingState } from "@/lib/store/selectors";

const RADIUS = 31;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // 194.8

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

  return (
    <div
      className="relative size-[74px] shrink-0"
      style={{
        animation:
          phase === 0
            ? undefined
            : `${phase % 2 ? "ringA" : "ringB"} .42s cubic-bezier(.3,1.2,.4,1)`,
      }}
    >
      <svg width="74" height="74" viewBox="0 0 74 74" aria-hidden="true">
        <circle
          cx="37"
          cy="37"
          r={RADIUS}
          fill="none"
          stroke="var(--line)"
          strokeWidth="7"
        />
        <circle
          cx="37"
          cy="37"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 37 37)"
          style={{ transition: "stroke-dashoffset .45s cubic-bezier(.2,.85,.25,1)" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
        <span
          className="font-mono text-[15px] font-semibold tabular-nums"
          style={{ color: "var(--text)" }}
        >
          {ring.percentLabel}
        </span>
        <span
          className="text-[8px] font-medium uppercase tracking-[0.1em]"
          style={{ color: "var(--muted)" }}
        >
          Budget
        </span>
      </div>
    </div>
  );
}

export default BudgetRing;
