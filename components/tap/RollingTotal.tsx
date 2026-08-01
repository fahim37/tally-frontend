"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney, getCurrency, toTotalDigits } from "@/lib/money";
import { useReducedMotion } from "@/lib/useReducedMotion";

interface RollingTotalProps {
  totalMinor: number;
  currency: string;
}

const DURATION_MS = 420;

/**
 * The day's total, counting up to each new value.
 *
 * Each digit is a 0–9 strip translated into place, so the number rolls like a
 * mechanical counter — the point being that a tap visibly *moves* the total
 * rather than swapping it. The value itself is eased separately from the digit
 * animation so the count-up reads as arithmetic, not decoration.
 *
 * Under prefers-reduced-motion it snaps, and the accessible label always
 * carries the true figure rather than the mid-animation one.
 */
export function RollingTotal({ totalMinor, currency }: RollingTotalProps) {
  const [animated, setAnimated] = useState(totalMinor);
  const frame = useRef<number | null>(null);
  const from = useRef(totalMinor);
  const reduced = useReducedMotion();

  // Reduced motion is read during render rather than corrected afterwards, so
  // the figure never animates even for one frame.
  const shown = reduced ? totalMinor : animated;

  useEffect(() => {
    if (reduced) {
      from.current = totalMinor;
      return;
    }

    const start = performance.now();
    const origin = from.current;
    const delta = totalMinor - origin;

    if (delta === 0) return;

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(Math.round(origin + delta * eased));
      if (progress < 1) frame.current = requestAnimationFrame(step);
      else from.current = totalMinor;
    };

    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      from.current = totalMinor;
    };
  }, [totalMinor, reduced]);

  const digits = toTotalDigits(shown, currency);
  const symbol = getCurrency(currency).symbol;

  return (
    <div
      role="img"
      aria-label={`Spent today ${formatMoney(totalMinor, currency)}`}
      className="mt-3 flex items-baseline font-display text-[48px] font-semibold leading-none tracking-[-0.035em] tabular-nums"
      style={{ color: "var(--blue)" }}
    >
      <span aria-hidden="true" className="mr-0.5 text-[29px]">
        {symbol}
      </span>

      {digits.map((digit) =>
        digit.isDigit ? (
          <span
            key={digit.key}
            aria-hidden="true"
            className="relative inline-block overflow-hidden"
            style={{ height: "1em", width: "0.6em" }}
          >
            <span
              className="block"
              style={{
                transform: digit.shift,
                transition: "transform .42s cubic-bezier(.2,.85,.25,1)",
              }}
            >
              {Array.from({ length: 10 }, (_, n) => (
                <span key={n} className="block" style={{ height: "1em" }}>
                  {n}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={digit.key} aria-hidden="true" className="inline-block" style={{ width: "0.28em" }}>
            {digit.char}
          </span>
        )
      )}
    </div>
  );
}

export default RollingTotal;
