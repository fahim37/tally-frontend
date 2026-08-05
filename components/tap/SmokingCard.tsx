"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { dayLabel, longDate, shortDate } from "@/lib/date";
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
  const [selectedDate, setSelectedDate] = useState(
    () => stats.recentDays.at(-1)?.localDate ?? null
  );

  const remaining = target === null ? null : target - todayCount;
  const over = remaining !== null && remaining < 0;
  const peak = Math.max(1, target ?? 0, ...stats.recentDays.map((day) => day.count));
  const selectedDay =
    stats.recentDays.find((day) => day.localDate === selectedDate) ??
    stats.recentDays.at(-1) ??
    null;

  const selectedWasTracked = Boolean(
    selectedDay && (selectedDay.count > 0 || selectedDay.underTarget !== null)
  );
  const selectedStatus = (() => {
    if (!selectedDay || !selectedWasTracked) return "Nothing logged for this day.";
    if (target === null) return "No daily limit was set.";
    if (selectedDay.count > target) {
      const difference = selectedDay.count - target;
      return `${difference} ${difference === 1 ? "cigarette" : "cigarettes"} over the limit.`;
    }
    if (selectedDay.count === target) return "Right on the daily limit.";
    const difference = target - selectedDay.count;
    return `${difference} ${difference === 1 ? "cigarette" : "cigarettes"} under the limit.`;
  })();

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

      {/* Fourteen days, most recent last. Each day is a real button so the
          chart works with touch, a mouse, and a keyboard. */}
      <div
        className="mt-4 flex h-12 items-end gap-1"
        role="group"
        aria-label="Cigarettes logged over the last 14 days"
      >
        {stats.recentDays.map((day) => {
          const height = day.count === 0 ? 3 : Math.max(3, (day.count / peak) * 34);
          const untracked = day.underTarget === null && day.count === 0;
          const selected = day.localDate === selectedDay?.localDate;
          const dayStatus = untracked
            ? "nothing logged"
            : `${day.count} ${day.count === 1 ? "cigarette" : "cigarettes"}`;

          return (
            <button
              key={day.localDate}
              type="button"
              onClick={() => setSelectedDate(day.localDate)}
              onFocus={() => setSelectedDate(day.localDate)}
              onMouseEnter={() => setSelectedDate(day.localDate)}
              aria-pressed={selected}
              aria-label={`${longDate(day.localDate)}: ${dayStatus}`}
              className="flex h-12 min-w-0 flex-1 items-end justify-center rounded-xs"
            >
              <span
                className="block w-full max-w-6 rounded-xs"
                style={{
                  height,
                  background: untracked
                    ? "var(--line)"
                    : day.underTarget === false
                      ? "var(--amber)"
                      : "var(--teal)",
                  boxShadow: selected
                    ? "0 0 0 2px var(--surf), 0 0 0 4px var(--blue)"
                    : "none",
                  transform: selected ? "translateY(-2px)" : "none",
                  transition:
                    "height var(--dur-base) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) ease",
                }}
              />
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div
          className="mt-3 flex items-center gap-3 rounded-card px-3.5 py-2.5"
          style={{ background: "var(--bg)" }}
          aria-live="polite"
        >
          <div className="min-w-0 flex-1">
            <p className="text-body font-medium" style={{ color: "var(--text)" }}>
              {dayLabel(selectedDay.localDate)} · {shortDate(selectedDay.localDate)}
            </p>
            <p className="mt-0.5 text-caption" style={{ color: "var(--muted)" }}>
              {selectedStatus}
            </p>
          </div>
          <p
            className="shrink-0 font-mono text-subhead tabular-nums"
            style={{
              color:
                selectedDay.underTarget === false ? "var(--amber-text)" : "var(--text)",
            }}
          >
            {selectedWasTracked ? selectedDay.count : "—"}
          </p>
        </div>
      )}

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
