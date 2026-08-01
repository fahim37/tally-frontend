"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useTally } from "@/lib/store/TallyProvider";
import { habitViews, padTiles, type HabitView } from "@/lib/store/selectors";
import { formatMoney } from "@/lib/money";

const PACK_SIZE = 20;

/**
 * Habits: what a daily purchase costs at three scales, and what a smaller
 * number would be worth.
 *
 * Tone is factual throughout, per the brief — no shame language, no health
 * claims, no "you should". The screen states arithmetic and stops. The one
 * value judgement available is the target the user sets themselves.
 */
export function Habits() {
  const { state } = useTally();
  const [addOpen, setAddOpen] = useState(false);
  const views = useMemo(() => habitViews(state), [state]);

  return (
    <div className="px-5 pb-8 pt-6">
      <PageHeader
        title="Habits"
        subtitle="The things you buy most days, priced out at three scales."
      />

      {views.length === 0 ? (
        <Card>
          <p className="text-[14px] leading-[1.5]" style={{ color: "var(--muted)" }}>
            Track a tile as a habit and you&apos;ll see what it costs a day, a month and a
            year.
          </p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-4 w-full rounded-[12px] py-3.5 text-[14px] font-semibold"
            style={{ background: "var(--blue)", color: "#FFFFFF" }}
          >
            Track a habit
          </button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {views.map((view) => (
            <HabitCard key={view.habit.id} view={view} currency={state.profile.currency} />
          ))}
        </div>
      )}

      {views.length > 0 && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mt-3 w-full rounded-[12px] border border-dashed py-3.5 text-[13px] font-medium"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          Track another habit
        </button>
      )}

      <AddHabitSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function HabitCard({ view, currency }: { view: HabitView; currency: string }) {
  const { dispatch } = useTally();
  const { habit } = view;

  const filled = Math.min(PACK_SIZE, view.todayCount);
  const reduction = Math.max(0, view.observedDailyCount - view.whatIfCount);

  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[12px]"
          style={{ background: "var(--sky)", color: "var(--blue)" }}
        >
          <Icon name={habit.iconKey} size={19} strokeWidth={1.6} />
        </span>

        <div className="flex-1">
          <p className="text-[15px] font-semibold leading-tight" style={{ color: "var(--text)" }}>
            {habit.name}
          </p>
          <p className="mt-[3px] text-[11px] leading-tight" style={{ color: "var(--muted)" }}>
            {view.observedDailyCount.toFixed(1)} a day ·{" "}
            {formatMoney(habit.unitAmountMinor, currency)} each
          </p>
        </div>

        {view.streak > 0 && (
          <span
            className="rounded-pill px-2.5 py-1.5 text-[11px] font-medium"
            style={{ background: "rgba(15,164,127,.1)", color: "var(--teal)" }}
          >
            {view.streak}d streak
          </span>
        )}
      </div>

      {/* Today's pack grid */}
      <div className="mb-2 grid grid-cols-10 gap-1">
        {Array.from({ length: PACK_SIZE }, (_, i) => (
          <span
            key={i}
            className="rounded-[3px]"
            style={{
              aspectRatio: "1",
              background: i < filled ? "var(--blue)" : "transparent",
              border: `1px solid ${i < filled ? "var(--blue)" : "var(--line)"}`,
            }}
          />
        ))}
      </div>
      <p className="mb-4 text-[11px]" style={{ color: "var(--faint)" }}>
        {view.todayCount} logged today
      </p>

      {/* Three scales */}
      <div className="flex border-t pt-3.5" style={{ borderColor: "var(--line)" }}>
        <Scale label="A day" value={formatMoney(view.dailyCostMinor, currency)} />
        <Scale label="A month" value={formatMoney(view.monthlyCostMinor, currency)} />
        <div className="flex-[1.2]">
          <p
            className="text-[9px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--amber)" }}
          >
            A year
          </p>
          <p
            className="mt-1.5 font-display text-[21px] font-semibold tracking-[-0.02em] tabular-nums"
            style={{ color: "var(--amber)" }}
          >
            {formatMoney(view.yearlyCostMinor, currency)}
          </p>
        </div>
      </div>

      {/* What if */}
      <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
        <p
          className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--muted)" }}
        >
          What if
        </p>
        <p className="mb-3.5 text-[13px] leading-[1.45]" style={{ color: "var(--text)" }}>
          You log {view.observedDailyCount.toFixed(1)} on an average day. Move the number to
          see what a different one is worth.
        </p>

        <div
          className="mb-4 flex items-center justify-between rounded-[14px] border px-2.5 py-2"
          style={{ borderColor: "var(--line)" }}
        >
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "SET_WHAT_IF",
                habitId: habit.id,
                count: Math.max(0, view.whatIfCount - 1),
              })
            }
            disabled={view.whatIfCount === 0}
            aria-label="One fewer a day"
            className="flex size-[42px] items-center justify-center rounded-[12px] disabled:opacity-35"
            style={{ background: "var(--bg)" }}
          >
            <Icon name="minus" size={18} strokeWidth={2} />
          </button>

          <div className="text-center">
            <p
              aria-live="polite"
              className="font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
              style={{ color: "var(--text)" }}
            >
              {view.whatIfCount}
            </p>
            <p
              className="mt-1 text-[10px] font-medium uppercase tracking-[0.1em]"
              style={{ color: "var(--muted)" }}
            >
              a day
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "SET_WHAT_IF",
                habitId: habit.id,
                count: view.whatIfCount + 1,
              })
            }
            aria-label="One more a day"
            className="flex size-[42px] items-center justify-center rounded-[12px]"
            style={{ background: "var(--bg)" }}
          >
            <Icon name="plus" size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="rounded-[14px] p-4" style={{ background: "rgba(15,164,127,.09)" }}>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--teal)" }}
          >
            {reduction > 0 ? "Kept in a year" : "No change"}
          </p>
          <p
            className="mt-2.5 font-display text-[38px] font-semibold leading-none tracking-[-0.035em] tabular-nums"
            style={{ color: "var(--teal)" }}
          >
            {formatMoney(view.savedYearlyMinor, currency)}
          </p>
          <p className="mt-2 text-[12px] leading-[1.4]" style={{ color: "var(--muted)" }}>
            {reduction > 0
              ? `${formatMoney(view.savedMonthlyMinor, currency)} a month. Nothing else about the day changes.`
              : "Move the number below your average to see the difference."}
          </p>
        </div>

        <div className="mt-3.5 flex items-center justify-between">
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            {habit.targetDailyCount === null
              ? "No daily target set"
              : `Target: ${habit.targetDailyCount} a day`}
          </span>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "SET_HABIT_TARGET",
                habitId: habit.id,
                target: habit.targetDailyCount === null ? view.whatIfCount : null,
              })
            }
            className="tap-target text-[12px] font-medium"
            style={{ color: "var(--blue)" }}
          >
            {habit.targetDailyCount === null ? `Set ${view.whatIfCount} as target` : "Clear target"}
          </button>
        </div>
      </div>
    </Card>
  );
}

function Scale({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1">
      <p
        className="text-[9px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </p>
      <p
        className="mt-1.5 font-mono text-[15px] font-medium tabular-nums"
        style={{ color: "var(--text)" }}
      >
        {value}
      </p>
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
      <p className="mb-1.5 font-display text-[20px] font-semibold" style={{ color: "var(--text)" }}>
        Track a habit
      </p>
      <p className="mb-5 text-[13px] leading-[1.45]" style={{ color: "var(--muted)" }}>
        Pick a tile you buy most days.
      </p>

      {available.length === 0 ? (
        <p className="py-6 text-center text-[13px]" style={{ color: "var(--faint)" }}>
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
              className="flex h-[86px] flex-col items-start justify-between rounded-[16px] border p-2.5 text-left"
              style={{ background: "var(--bg)", borderColor: "var(--line)" }}
            >
              <span style={{ color: "var(--blue)" }}>
                <Icon name={tile.iconKey} size={20} strokeWidth={1.6} />
              </span>
              <span
                className="text-[12px] font-medium leading-tight"
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
