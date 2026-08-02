"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { shortDate } from "@/lib/date";
import type { SmokingStats } from "@/lib/store/selectors";

/**
 * The reduction card.
 *
 * The app's centre of gravity: for most people using this, cigarettes are the
 * thing they're actually trying to change, and everything else is bookkeeping.
 * So it gets the count, the target, and the fourteen days behind it.
 *
 * What it deliberately does NOT show is a projected annual saving. "You'd save
 * ৳58,400 a year" is a guess multiplied by 365 and presented as a fact, and it
 * measures a year that hasn't happened instead of the day that has. Days under
 * target either happened or they didn't — that's the number worth putting in
 * front of someone.
 */
export function SmokingCard({ stats }: { stats: SmokingStats }) {
  const { todayCount, targetDailyCount: target, streak, changePercent } = stats;

  const remaining = target === null ? null : target - todayCount;
  const over = remaining !== null && remaining < 0;

  return (
    <div
      className="animate-row-in mt-6 rounded-card border p-4"
      style={{ background: "var(--surf)", borderColor: "var(--line)" }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mb-2 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
            Cigarettes today
          </p>
          <p className="flex items-baseline gap-2">
            <span
              className="font-display text-hero tabular-nums"
              style={{ color: over ? "var(--amber-text)" : "var(--text)" }}
            >
              {todayCount}
            </span>
            {target !== null && (
              <span className="text-subhead font-normal" style={{ color: "var(--muted)" }}>
                of {target}
              </span>
            )}
          </p>
        </div>

        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-card"
          style={{ background: "var(--sky)", color: "var(--blue)" }}
        >
          <Icon name="cig" size={22} strokeWidth={1.6} />
        </span>
      </div>

      {target !== null && (
        <>
          {/* scaleX, not width — a bar that relayouts every frame is the
              textbook way to make a phone stutter. */}
          <div
            className="mb-2.5 h-2 overflow-hidden rounded-pill"
            style={{ background: "var(--bg)" }}
          >
            <div
              className="h-full origin-left rounded-pill"
              style={{
                background: over ? "var(--amber)" : "var(--teal)",
                transform: `scaleX(${Math.min(1, target > 0 ? todayCount / target : 0)})`,
                transition: "transform var(--dur-slow) var(--ease-out)",
              }}
            />
          </div>

          <p className="text-body" style={{ color: "var(--muted)" }}>
            {over ? (
              <>
                {-remaining!} over today&apos;s limit.{" "}
                <span style={{ color: "var(--muted)" }}>Tomorrow resets it.</span>
              </>
            ) : remaining === 0 ? (
              <>That&apos;s the limit for today.</>
            ) : (
              <>
                <span style={{ color: "var(--teal-text)" }}>{remaining} left</span> before
                you hit the limit.
              </>
            )}
          </p>
        </>
      )}

      {target === null && (
        <p className="text-body" style={{ color: "var(--muted)" }}>
          Set a daily limit and this starts tracking how often you stay under it.{" "}
          <Link href="/habits" className="font-medium" style={{ color: "var(--blue)" }}>
            Set a limit →
          </Link>
        </p>
      )}

      {/* Fourteen days, most recent last. A bar chart would need axes and a
          legend to say the same thing this says at a glance. */}
      <div className="mt-4 flex items-end gap-1" aria-hidden>
        {stats.recentDays.map((day) => {
          const peak = Math.max(
            1,
            target ?? 0,
            ...stats.recentDays.map((d) => d.count)
          );
          const height = day.count === 0 ? 3 : Math.max(3, (day.count / peak) * 34);
          const untracked = day.underTarget === null && day.count === 0;

          return (
            <span
              key={day.localDate}
              title={`${shortDate(day.localDate)} · ${day.count}`}
              className="flex-1 rounded-xs"
              style={{
                height,
                background: untracked
                  ? "var(--line)"
                  : day.underTarget === false
                    ? "var(--amber)"
                    : "var(--teal)",
                transition: "height var(--dur-base) var(--ease-out)",
              }}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {streak > 0 && (
          <p className="text-caption" style={{ color: "var(--teal-text)" }}>
            {streak} {streak === 1 ? "day" : "days"} under the limit
          </p>
        )}
        {changePercent !== null && changePercent !== 0 && (
          <p className="text-caption" style={{ color: "var(--muted)" }}>
            {changePercent < 0 ? (
              <>
                <span style={{ color: "var(--teal-text)" }}>
                  {Math.abs(changePercent)}% fewer
                </span>{" "}
                than the fortnight before
              </>
            ) : (
              <>{changePercent}% more than the fortnight before</>
            )}
          </p>
        )}
        {stats.smokeFreeDays > 0 && (
          <p className="text-caption" style={{ color: "var(--muted)" }}>
            {stats.smokeFreeDays} smoke-free {stats.smokeFreeDays === 1 ? "day" : "days"}
          </p>
        )}
      </div>
    </div>
  );
}

export default SmokingCard;
