"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { formatMoney } from "@/lib/money";
import type { RingState } from "@/lib/store/selectors";
import { BudgetRing } from "./BudgetRing";
import { RollingTotal } from "./RollingTotal";

/**
 * The day's total, as a surface rather than as loose text on the page.
 *
 * This used to be an unboxed block at the top of the Tap Pad: an eyebrow, the
 * figure, and — with no budget set — a bare blue sentence that read as body
 * copy rather than as the one thing the screen wanted you to do. Boxing it does
 * three things. The figure gets a surface to sit on instead of floating over
 * the page background, the ring gets an edge to be aligned to, and the
 * budget prompt can become an actual control.
 *
 * The wash behind it is generated artwork (see scripts/generate-art.mjs), and
 * it is the one asset that ships in two versions, because it is the only one
 * with text on top of it. It blends rather than covers — multiply in light,
 * screen in dark — so it tints the card's own surface colour instead of
 * replacing it, and a missing file leaves a plain card rather than a hole.
 */
export function SpendCard({
  ring,
  currency,
  pulseKey,
}: {
  ring: RingState;
  currency: string;
  pulseKey: number;
}) {
  const hasBudget = ring.allowanceMinor > 0;

  return (
    <section
      className="relative overflow-hidden rounded-tile border"
      style={{
        background: "var(--surf)",
        borderColor: "var(--line)",
        boxShadow: "var(--lift)",
        // The wash blends rather than covers, and a blend reaches down through
        // whatever shares its stacking context. Isolating pins it to this
        // card's own surface instead of letting it pick up the page behind it.
        isolation: "isolate",
      }}
    >
      <span className="art-wash" aria-hidden="true" />

      {/* The 1px catch of light along the top edge that makes a flat rectangle
          read as a raised one. Inside the radius, so it follows the corners. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-tile"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.55)" }}
      />

      <div className="relative flex items-start justify-between gap-4 p-5">
        {/* min-w-0 so a large total shrinks instead of shoving the ring off the
            right edge — RollingTotal is a non-wrapping row of fixed cells. */}
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
            Spent today
          </p>

          <RollingTotal totalMinor={ring.spentMinor} currency={currency} />

          {hasBudget ? (
            <p className="mt-3 text-meta" style={{ color: "var(--muted)" }}>
              <span className="font-mono tabular-nums">
                {formatMoney(ring.allowanceMinor, currency)}
              </span>{" "}
              a day ·{" "}
              <span
                className="font-mono tabular-nums"
                style={{ color: ring.isOver ? "var(--amber-text)" : "var(--teal-text)" }}
              >
                {ring.remainingMinor >= 0
                  ? `${formatMoney(ring.remainingMinor, currency)} left`
                  : `${formatMoney(-ring.remainingMinor, currency)} over`}
              </span>
            </p>
          ) : (
            // Setting a budget is what makes half this screen work, so it gets
            // the shape of something you press rather than the shape of a
            // sentence you read.
            <Link
              href="/budgets"
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-pill py-2 pr-3 pl-3.5 text-meta font-medium"
              style={{
                background: "var(--sky)",
                color: "var(--blue)",
                transition: "background var(--dur-fast) ease",
              }}
            >
              Set a monthly budget
              <Icon name="arrowRight" size={15} strokeWidth={2} />
            </Link>
          )}
        </div>

        {hasBudget && <BudgetRing ring={ring} pulseKey={pulseKey} />}
      </div>
    </section>
  );
}

export default SpendCard;
