"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useTally } from "@/lib/store/TallyProvider";
import {
  habitProgress,
  padTiles,
  SMOKING_SLUG,
} from "@/lib/store/selectors";
import { shortDate } from "@/lib/date";
import type { LocalHabit } from "@/lib/store/state";

/**
 * Habits: how often you're doing something, and whether that's going down.
 *
 * This screen used to be a calculator. It priced a daily purchase at three
 * scales and then offered a slider that answered "what would you keep in a
 * year if you had two fewer a day" — a number arrived at by multiplying a
 * guess by 365. It read as authoritative and wasn't, it measured a year that
 * hadn't happened, and it said nothing about today.
 *
 * What replaced it is only things that actually occurred: how many today,
 * against a limit you set; how the last two weeks compare to the two before;
 * how many days running you've stayed under. Tone stays factual — no shame
 * language, no health claims, no "you should". The only value judgement on
 * screen is the target the user chose.
 */
export function Habits() {
  const { state } = useTally();
  const [addOpen, setAddOpen] = useState(false);

  // Smoking first, always. For most people using this it's the reason the app
  // is installed, and burying it under "Tea" would be an odd choice.
  const habits = useMemo(() => {
    const smokingTileIds = new Set(
      state.tiles.filter((t) => t.categorySlug === SMOKING_SLUG).map((t) => t.id)
    );
    return [...state.habits].sort((a, b) => {
      const aSmoking = smokingTileIds.has(a.tileId) ? 0 : 1;
      const bSmoking = smokingTileIds.has(b.tileId) ? 0 : 1;
      return aSmoking - bSmoking || a.sortIndex - b.sortIndex;
    });
  }, [state.tiles, state.habits]);

  return (
    <div className="px-5 pt-6 pb-8">
      <PageHeader
        title="Habits"
        subtitle="How often, and whether it's coming down."
      />

      {habits.length === 0 ? (
        <Card>
          <p className="mb-2 font-display text-subhead" style={{ color: "var(--text)" }}>
            Nothing tracked yet.
          </p>
          <p className="text-body" style={{ color: "var(--muted)" }}>
            Pick something you do most days — cigarettes are the usual one — and set a daily
            limit. This screen then shows how often you stay under it.
          </p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-4 w-full rounded-card py-3.5 text-label font-semibold transition-transform active:scale-[0.99]"
            style={{ background: "var(--blue)", color: "#FFFFFF" }}
          >
            Track a habit
          </button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {habits.map((habit, index) => (
            <HabitCard key={habit.id} habit={habit} index={index} />
          ))}
        </div>
      )}

      {habits.length > 0 && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mt-3 w-full rounded-card border border-dashed py-3.5 text-body font-medium"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          Track another habit
        </button>
      )}

      <AddHabitSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function HabitCard({ habit, index }: { habit: LocalHabit; index: number }) {
  const { state, dispatch } = useTally();
  const stats = useMemo(() => habitProgress(state, habit), [state, habit]);

  const [editingTarget, setEditingTarget] = useState(false);
  const target = habit.targetDailyCount;
  const remaining = target === null ? null : target - stats.todayCount;
  const over = remaining !== null && remaining < 0;

  return (
    <div className="animate-row-in" style={{ ["--i" as string]: index }}>
      <Card>
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-card"
            style={{ background: "var(--sky)", color: "var(--blue)" }}
          >
            <Icon name={habit.iconKey} size={21} strokeWidth={1.6} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-subhead" style={{ color: "var(--text)" }}>
              {habit.name}
            </p>
            <p className="mt-0.5 text-meta" style={{ color: "var(--muted)" }}>
              {stats.averageDailyCount > 0
                ? `${stats.averageDailyCount.toFixed(1)} a day over the last fortnight`
                : "Not enough logged yet to average"}
            </p>
          </div>

          {stats.streak > 0 && (
            <span
              className="shrink-0 rounded-pill px-3 py-1.5 text-caption font-medium"
              style={{ background: "rgba(15,164,127,.12)", color: "var(--teal-text)" }}
            >
              {stats.streak}d
            </span>
          )}
        </div>

        {/* Today against the limit */}
        <div className="mb-4">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="flex items-baseline gap-2">
              <span
                className="font-display text-hero tabular-nums"
                style={{ color: over ? "var(--amber-text)" : "var(--text)" }}
              >
                {stats.todayCount}
              </span>
              <span className="text-body" style={{ color: "var(--muted)" }}>
                today
                {target !== null && ` of ${target}`}
              </span>
            </p>
          </div>

          {target !== null && (
            <div
              className="h-2 overflow-hidden rounded-pill"
              style={{ background: "var(--bg)" }}
            >
              <div
                className="h-full origin-left rounded-pill"
                style={{
                  background: over ? "var(--amber)" : "var(--teal)",
                  transform: `scaleX(${Math.min(1, target > 0 ? stats.todayCount / target : 0)})`,
                  transition: "transform var(--dur-slow) var(--ease-out)",
                }}
              />
            </div>
          )}
        </div>

        {/* The fortnight */}
        <div className="mb-1.5 flex items-end gap-1" aria-hidden>
          {stats.recentDays.map((day) => {
            const peak = Math.max(1, target ?? 0, ...stats.recentDays.map((d) => d.count));
            const height = day.count === 0 ? 3 : Math.max(3, (day.count / peak) * 40);
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
        <p className="mb-4 text-caption" style={{ color: "var(--faint)" }}>
          Last 14 days
          {stats.changePercent !== null && (
            <>
              {" · "}
              <span
                style={{
                  color: stats.changePercent < 0 ? "var(--teal-text)" : "var(--muted)",
                }}
              >
                {stats.changePercent < 0
                  ? `${Math.abs(stats.changePercent)}% fewer than the fortnight before`
                  : stats.changePercent > 0
                    ? `${stats.changePercent}% more than the fortnight before`
                    : "level with the fortnight before"}
              </span>
            </>
          )}
        </p>

        {/* The limit */}
        <div className="border-t pt-4" style={{ borderColor: "var(--line)" }}>
          {editingTarget || target === null ? (
            <TargetPicker
              current={target ?? Math.max(1, Math.round(stats.averageDailyCount) - 1)}
              suggestion={Math.max(1, Math.round(stats.averageDailyCount) - 1)}
              hasAverage={stats.averageDailyCount > 0}
              onCancel={target === null ? undefined : () => setEditingTarget(false)}
              onSet={(value) => {
                dispatch({ type: "SET_HABIT_TARGET", habitId: habit.id, target: value });
                setEditingTarget(false);
              }}
            />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-body" style={{ color: "var(--text)" }}>
                  Daily limit: {target}
                </p>
                <p className="mt-0.5 text-caption" style={{ color: "var(--muted)" }}>
                  {stats.bestStreak > 0
                    ? `Best run: ${stats.bestStreak} ${stats.bestStreak === 1 ? "day" : "days"} under`
                    : "No full day under it yet."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTarget(true)}
                className="tap-target shrink-0 text-body font-medium"
                style={{ color: "var(--blue)" }}
              >
                Change
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * Setting the limit.
 *
 * Opens on one below the current average rather than on a round number: the
 * point is a next step you'll actually hit, and "cut from 14 to 5" is how
 * people abandon this in a week.
 */
function TargetPicker({
  current,
  suggestion,
  hasAverage,
  onSet,
  onCancel,
}: {
  current: number;
  suggestion: number;
  hasAverage: boolean;
  onSet: (value: number) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(current);

  return (
    <div>
      <p className="mb-1.5 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
        Daily limit
      </p>
      <p className="mb-3.5 text-body" style={{ color: "var(--muted)" }}>
        {hasAverage
          ? `You're averaging about ${suggestion + 1} a day. One fewer is a limit you can actually hold.`
          : "Pick a number you can stay under today."}
      </p>

      <div
        className="mb-4 flex items-center justify-between rounded-card border px-3 py-2"
        style={{ borderColor: "var(--line)" }}
      >
        <button
          type="button"
          onClick={() => setValue((v) => Math.max(0, v - 1))}
          disabled={value === 0}
          aria-label="One fewer"
          className="flex size-11 items-center justify-center rounded-card disabled:opacity-35"
          style={{ background: "var(--bg)" }}
        >
          <Icon name="minus" size={19} strokeWidth={2} />
        </button>

        <p
          aria-live="polite"
          className="font-display text-display tabular-nums"
          style={{ color: "var(--text)" }}
        >
          {value}
        </p>

        <button
          type="button"
          onClick={() => setValue((v) => v + 1)}
          aria-label="One more"
          className="flex size-11 items-center justify-center rounded-card"
          style={{ background: "var(--bg)" }}
        >
          <Icon name="plus" size={19} strokeWidth={2} />
        </button>
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-card border px-5 py-3 text-body font-medium"
            style={{ borderColor: "var(--line)", color: "var(--text)" }}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => onSet(value)}
          className="flex-1 rounded-card py-3 text-body font-semibold transition-transform active:scale-[0.99]"
          style={{ background: "var(--blue)", color: "#FFFFFF" }}
        >
          Set {value} a day
        </button>
      </div>
    </div>
  );
}

function AddHabitSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useTally();

  const available = useMemo(
    () => padTiles(state).filter((tile) => !state.habits.some((h) => h.tileId === tile.id)),
    [state]
  );

  return (
    <Sheet open={open} onClose={onClose} label="Track a habit">
      <p className="mb-1.5 font-display text-title" style={{ color: "var(--text)" }}>
        Track a habit
      </p>
      <p className="mb-5 text-body" style={{ color: "var(--muted)" }}>
        Pick a tile you use most days.
      </p>

      {available.length === 0 ? (
        <p className="py-6 text-center text-body" style={{ color: "var(--faint)" }}>
          Every tile is already tracked.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {available.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => {
                dispatch({ type: "ADD_HABIT", tileId: tile.id });
                onClose();
              }}
              className="flex h-22 flex-col items-start justify-between rounded-tile border p-3 text-left transition-transform active:scale-95"
              style={{ background: "var(--bg)", borderColor: "var(--line)" }}
            >
              <span style={{ color: "var(--blue)" }}>
                <Icon name={tile.iconKey} size={21} strokeWidth={1.6} />
              </span>
              <span
                className="truncate text-body font-medium"
                style={{ color: "var(--text)" }}
              >
                {tile.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export default Habits;
