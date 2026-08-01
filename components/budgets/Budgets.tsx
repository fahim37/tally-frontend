"use client";

import { useMemo, useState } from "react";
import { Card, ProgressBar } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useTally } from "@/lib/store/TallyProvider";
import {
  budgetFor,
  categoryBudgetRows,
  habitViews,
  monthComparison,
} from "@/lib/store/selectors";
import { formatMoney, toMinor } from "@/lib/money";
import { currentLocalMonth, monthLabel } from "@/lib/date";

export function Budgets() {
  const { state, dispatch } = useTally();
  const [editingOverall, setEditingOverall] = useState(false);
  const [limitFor, setLimitFor] = useState<string | null>(null);

  const currency = state.profile.currency;
  const month = currentLocalMonth();
  const budget = useMemo(() => budgetFor(state, month), [state, month]);
  const comparison = useMemo(() => monthComparison(state), [state]);
  const rows = useMemo(() => categoryBudgetRows(state), [state]);
  const habits = useMemo(() => habitViews(state), [state]);

  const spent = comparison.spentMinor;
  const limit = budget.overallLimitMinor;
  const left = limit - spent;
  const daysLeft = comparison.daysInMonth - comparison.dayOfMonth;

  const unbudgeted = state.categories.filter(
    (category) => !budget.categoryLimits.some((l) => l.categorySlug === category.slug)
  );

  return (
    <div className="px-5 pb-8 pt-6">
      <PageHeader title="Budgets" />

      {/* Overall */}
      <Card
        className="mb-3"
        title={`${monthLabel(month)} · monthly`}
        action={
          <button
            type="button"
            onClick={() => setEditingOverall(true)}
            className="tap-target px-1 text-[12px] font-medium"
            style={{ color: "var(--blue)" }}
          >
            Edit
          </button>
        }
      >
        <div className="mb-3.5 flex items-baseline gap-2">
          <span
            className="font-display text-[40px] font-semibold leading-none tracking-[-0.035em] tabular-nums"
            style={{ color: "var(--text)" }}
          >
            {formatMoney(spent, currency)}
          </span>
          {limit > 0 && (
            <span className="text-[14px]" style={{ color: "var(--muted)" }}>
              of {formatMoney(limit, currency)}
            </span>
          )}
        </div>

        {limit > 0 ? (
          <>
            <ProgressBar
              ratio={spent / limit}
              height={12}
              color={spent > limit ? "var(--amber)" : "var(--blue)"}
            />
            <div className="mt-2.5 flex justify-between text-[12px]" style={{ color: "var(--muted)" }}>
              <span>
                <span
                  className="font-mono"
                  style={{ color: left >= 0 ? "var(--teal)" : "var(--amber)" }}
                >
                  {formatMoney(Math.abs(left), currency)}
                </span>{" "}
                {left >= 0 ? "left" : "over"}
              </span>
              <span>{daysLeft} days to go</span>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditingOverall(true)}
            className="mt-2 w-full rounded-[12px] py-3.5 text-[14px] font-semibold"
            style={{ background: "var(--blue)", color: "#FFFFFF" }}
          >
            Set a monthly budget
          </button>
        )}
      </Card>

      {/* Per category */}
      <Card className="mb-3" title="Per category">
        {rows.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--faint)" }}>
            No category limits yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {rows.map((row) => (
              <div key={row.category.slug}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setLimitFor(row.category.slug)}
                    className="tap-target text-[14px] font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    {row.category.name}
                  </button>
                  <span
                    className="font-mono text-[13px] font-medium tabular-nums"
                    style={{ color: "var(--text)" }}
                  >
                    {formatMoney(row.spentMinor, currency)}{" "}
                    <span style={{ color: "var(--faint)" }}>
                      / {formatMoney(row.limitMinor, currency)}
                    </span>
                  </span>
                </div>

                <ProgressBar
                  ratio={row.ratio}
                  height={8}
                  color={row.isOver ? "var(--amber)" : row.ratio > 0.85 ? "var(--amber)" : "var(--blue)"}
                />

                {row.isOver ? (
                  <p className="mt-1.5 text-[11px]" style={{ color: "var(--amber)" }}>
                    {formatMoney(row.spentMinor - row.limitMinor, currency)} over the limit.
                  </p>
                ) : (
                  row.projectedBreachDay !== null && (
                    <p className="mt-1.5 text-[11px]" style={{ color: "var(--amber)" }}>
                      At this pace you pass the limit on {row.projectedBreachDay}{" "}
                      {monthLabel(month)}.
                    </p>
                  )
                )}
              </div>
            ))}
          </div>
        )}

        {unbudgeted.length > 0 && (
          <button
            type="button"
            onClick={() => setLimitFor(unbudgeted[0].slug)}
            className="mt-4 w-full rounded-[12px] border border-dashed py-3.5 text-[13px] font-medium"
            style={{ borderColor: "var(--line)", color: "var(--muted)" }}
          >
            Add a category limit
          </button>
        )}
      </Card>

      {/* Goals */}
      {state.goals.map((goal) => {
        const habit = habits.find((view) => view.habit.id === goal.linkedHabitId);
        const ratio = goal.targetAmountMinor
          ? goal.savedAmountMinor / goal.targetAmountMinor
          : 0;

        return (
          <Card key={goal.id} className="mb-3">
            <div className="mb-3.5 flex items-center gap-2">
              <span style={{ color: "var(--teal)" }}>
                <Icon name="goal" size={15} strokeWidth={2} />
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--teal)" }}
              >
                Goal
              </span>
            </div>

            <p
              className="mb-1.5 font-display text-[18px] font-semibold leading-[1.25] tracking-[-0.015em]"
              style={{ color: "var(--text)" }}
            >
              {goal.title}
            </p>

            {habit && goal.reductionPerDay ? (
              <p className="mb-4 text-[13px] leading-[1.45]" style={{ color: "var(--muted)" }}>
                {goal.reductionPerDay} fewer a day puts{" "}
                {formatMoney(
                  Math.round(habit.habit.unitAmountMinor * goal.reductionPerDay * 30),
                  currency
                )}{" "}
                a month aside. The target is {formatMoney(goal.targetAmountMinor, currency)}.
              </p>
            ) : (
              <p className="mb-4 text-[13px] leading-[1.45]" style={{ color: "var(--muted)" }}>
                {goal.note}
              </p>
            )}

            <div className="mb-2 flex items-baseline justify-between">
              <span
                className="font-mono text-[13px] font-medium tabular-nums"
                style={{ color: "var(--teal)" }}
              >
                {formatMoney(goal.savedAmountMinor, currency)} saved
              </span>
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                {Math.round(ratio * 100)}%
              </span>
            </div>

            <ProgressBar ratio={ratio} height={10} color="var(--teal)" />
          </Card>
        );
      })}

      {/* Recurring */}
      <Card title="Recurring">
        {state.recurring.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--faint)" }}>
            Nothing recurring yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {state.recurring.map((rule) => (
              <li key={rule.id} className="flex items-center gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-[11px]"
                  style={{ background: "var(--bg)", color: "var(--muted)" }}
                >
                  <Icon name="bill" size={17} strokeWidth={1.6} />
                </span>

                <span className="flex-1">
                  <span className="block text-[14px] font-medium" style={{ color: "var(--text)" }}>
                    {rule.name}
                  </span>
                  <span className="block text-[11px]" style={{ color: "var(--muted)" }}>
                    {rule.frequency}
                    {rule.dayOfMonth ? ` · day ${rule.dayOfMonth}` : ""} · auto-logs
                  </span>
                </span>

                <span
                  className="font-mono text-[13px] font-medium tabular-nums"
                  style={{ color: rule.isActive ? "var(--text)" : "var(--faint)" }}
                >
                  {formatMoney(rule.amountMinor, currency)}
                </span>

                <button
                  type="button"
                  onClick={() => dispatch({ type: "TOGGLE_RECURRING", ruleId: rule.id })}
                  role="switch"
                  aria-checked={rule.isActive}
                  aria-label={`${rule.name} auto-logging`}
                  className="tap-target relative h-6 w-10 shrink-0 rounded-pill transition-colors"
                  style={{ background: rule.isActive ? "var(--blue)" : "var(--line)" }}
                >
                  <span
                    className="absolute top-0.5 size-5 rounded-pill bg-white transition-transform"
                    style={{ left: 2, transform: rule.isActive ? "translateX(16px)" : "none" }}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AmountSheet
        open={editingOverall}
        title={`${monthLabel(month)} budget`}
        hint="Tally works out the daily pace from this."
        initial={limit ? String(limit / 100) : ""}
        onClose={() => setEditingOverall(false)}
        onSave={(minor) => {
          dispatch({ type: "SET_BUDGET", month, overallLimitMinor: minor });
          setEditingOverall(false);
        }}
      />

      <CategoryLimitSheet slug={limitFor} onClose={() => setLimitFor(null)} />
    </div>
  );
}

function AmountSheet({
  open,
  title,
  hint,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  hint?: string;
  initial: string;
  onClose: () => void;
  onSave: (minor: number) => void;
}) {
  const { state } = useTally();
  const [value, setValue] = useState(initial);
  const [seen, setSeen] = useState(false);

  if (open && !seen) {
    setSeen(true);
    setValue(initial);
  }
  if (!open && seen) setSeen(false);

  if (!open) return null;

  const minor = toMinor(value, state.profile.currency) ?? 0;

  return (
    <Sheet open onClose={onClose} label={title}>
      <p className="mb-1.5 font-display text-[20px] font-semibold" style={{ color: "var(--text)" }}>
        {title}
      </p>
      {hint && (
        <p className="mb-5 text-[13px] leading-[1.45]" style={{ color: "var(--muted)" }}>
          {hint}
        </p>
      )}

      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        inputMode="decimal"
        autoFocus
        aria-label={title}
        className="mb-5 w-full rounded-[13px] border px-3.5 py-4 font-mono text-[22px] tabular-nums outline-none"
        style={{ background: "var(--bg)", borderColor: "var(--blue)", color: "var(--text)" }}
      />

      <button
        type="button"
        onClick={() => onSave(minor)}
        disabled={minor <= 0}
        className="w-full rounded-[14px] py-4 text-[15px] font-semibold disabled:opacity-40"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        Save
      </button>
    </Sheet>
  );
}

function CategoryLimitSheet({ slug, onClose }: { slug: string | null; onClose: () => void }) {
  const { state, dispatch } = useTally();
  const month = currentLocalMonth();
  const budget = budgetFor(state, month);
  const category = state.categories.find((c) => c.slug === slug);
  const existing = budget.categoryLimits.find((l) => l.categorySlug === slug);

  if (!slug || !category) return null;

  return (
    <AmountSheet
      open
      title={`${category.name} limit`}
      hint="A monthly ceiling for this category."
      initial={existing ? String(existing.limitMinor / 100) : ""}
      onClose={onClose}
      onSave={(minor) => {
        dispatch({ type: "SET_CATEGORY_LIMIT", month, categorySlug: slug, limitMinor: minor });
        onClose();
      }}
    />
  );
}

export default Budgets;
