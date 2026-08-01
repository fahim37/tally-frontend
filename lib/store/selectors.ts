import {
  addDays,
  currentLocalMonth,
  dayLabel,
  dayOfMonth,
  daysInMonth,
  lastNLocalDates,
  monthOf,
  previousMonth,
  shortDate,
  startOfWeek,
  todayLocalDate,
  weekdayIndex,
  type LocalDate,
  type LocalMonth,
} from "../date";
import type { LocalCategory, LocalExpense, LocalHabit, TallyState } from "./state";

/**
 * Derived views over the store. Kept as pure functions rather than stored
 * state so a tap only ever has to update one expense row — every total, ring,
 * chart and streak recomputes from it.
 */

const live = (expenses: LocalExpense[]) => expenses.filter((e) => !e.deletedAt);

export const sumMinor = (expenses: LocalExpense[]): number =>
  expenses.reduce((total, e) => total + e.totalAmountMinor, 0);

// ── Day ────────────────────────────────────────────────────────────────────

export const expensesOn = (state: TallyState, localDate: LocalDate): LocalExpense[] =>
  live(state.expenses).filter((e) => e.localDate === localDate);

export const todayTotalMinor = (state: TallyState): number =>
  sumMinor(expensesOn(state, todayLocalDate()));

/** Count logged today for a tile — drives the tally marks on the pad. */
export const todayCountFor = (state: TallyState, tileId: string): number =>
  expensesOn(state, todayLocalDate())
    .filter((e) => e.tileId === tileId)
    .reduce((total, e) => total + e.quantity, 0);

// ── Budget ─────────────────────────────────────────────────────────────────

export const budgetFor = (state: TallyState, month: LocalMonth = currentLocalMonth()) =>
  state.budgets.find((b) => b.month === month) ??
  state.budgets[state.budgets.length - 1] ?? {
    month,
    overallLimitMinor: 0,
    categoryLimits: [],
  };

/**
 * The month's limit spread evenly across its days — the ring's denominator.
 *
 * Rounded to a whole currency unit, not a whole minor unit: ৳18,000 over 31
 * days is 580.645…, and the screen must read "৳580 a day", not "৳580.65". A
 * daily pace is a rule of thumb, and showing it to the poisha implies a
 * precision the number doesn't have.
 */
export const dailyAllowanceMinor = (state: TallyState): number => {
  const month = currentLocalMonth();
  const budget = budgetFor(state, month);
  if (!budget.overallLimitMinor) return 0;
  const perDay = budget.overallLimitMinor / daysInMonth(month);
  return Math.round(perDay / 100) * 100;
};

export interface RingState {
  spentMinor: number;
  allowanceMinor: number;
  remainingMinor: number;
  /** 0..1, clamped for the arc. */
  ratio: number;
  /** Unclamped, so "140% of today" can still be reported. */
  rawRatio: number;
  isOver: boolean;
  percentLabel: string;
}

export const ringState = (state: TallyState): RingState => {
  const spentMinor = todayTotalMinor(state);
  const allowanceMinor = dailyAllowanceMinor(state);
  const rawRatio = allowanceMinor > 0 ? spentMinor / allowanceMinor : 0;

  return {
    spentMinor,
    allowanceMinor,
    remainingMinor: allowanceMinor - spentMinor,
    ratio: Math.min(1, rawRatio),
    rawRatio,
    isOver: spentMinor > allowanceMinor && allowanceMinor > 0,
    percentLabel: `${Math.round(rawRatio * 100)}%`,
  };
};

// ── Tiles ──────────────────────────────────────────────────────────────────

export interface PadTile {
  id: string;
  name: string;
  iconKey: string;
  categorySlug: string;
  amountMinor: number;
  presetAmountsMinor: number[];
  todayCount: number;
  usageCount: number;
}

/**
 * Tiles in pad order: most-used first, since the brief asks them to reorder by
 * frequency. Ties fall back to the seeded order so the grid doesn't shuffle
 * arbitrarily on a fresh account.
 */
export const padTiles = (state: TallyState): PadTile[] =>
  state.tiles
    .filter((t) => !t.isArchived)
    .map((t) => ({
      id: t.id,
      name: t.name,
      iconKey: t.iconKey,
      categorySlug: t.categorySlug,
      amountMinor: t.defaultAmountMinor,
      presetAmountsMinor: t.presetAmountsMinor,
      todayCount: todayCountFor(state, t.id),
      usageCount: t.usageCount,
    }))
    .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name));

/** The "Recently used" chip rail — today's tiles, busiest first. */
export const recentTiles = (state: TallyState, limit = 4): PadTile[] =>
  padTiles(state)
    .filter((t) => t.todayCount > 0)
    .sort((a, b) => b.todayCount - a.todayCount)
    .slice(0, limit);

// ── History ────────────────────────────────────────────────────────────────

export interface HistoryDay {
  localDate: LocalDate;
  label: string;
  dateLabel: string;
  totalMinor: number;
  markCount: number;
  rows: LocalExpense[];
}

export interface HistoryFilters {
  search?: string;
  categorySlug?: string | null;
}

export const historyDays = (
  state: TallyState,
  { search = "", categorySlug = null }: HistoryFilters = {}
): HistoryDay[] => {
  const term = search.trim().toLowerCase();

  const rows = live(state.expenses).filter((e) => {
    if (categorySlug && e.categorySlug !== categorySlug) return false;
    if (!term) return true;
    return (
      e.name.toLowerCase().includes(term) ||
      (e.note ?? "").toLowerCase().includes(term) ||
      (e.merchant ?? "").toLowerCase().includes(term)
    );
  });

  const byDate = new Map<LocalDate, LocalExpense[]>();
  for (const row of rows) {
    const bucket = byDate.get(row.localDate);
    if (bucket) bucket.push(row);
    else byDate.set(row.localDate, [row]);
  }

  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([localDate, dayRows]) => ({
      localDate,
      label: dayLabel(localDate),
      dateLabel: shortDate(localDate),
      totalMinor: sumMinor(dayRows),
      markCount: dayRows.reduce((total, e) => total + e.quantity, 0),
      rows: dayRows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    }));
};

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface CategorySlice {
  category: LocalCategory;
  totalMinor: number;
  ratio: number;
  percentLabel: string;
}

export const categoryBreakdown = (
  state: TallyState,
  month: LocalMonth = currentLocalMonth()
): CategorySlice[] => {
  const rows = live(state.expenses).filter((e) => e.localMonth === month);
  const total = sumMinor(rows);
  if (!total) return [];

  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.categorySlug, (totals.get(row.categorySlug) ?? 0) + row.totalAmountMinor);
  }

  return [...totals.entries()]
    .map(([slug, totalMinor]) => {
      const category =
        state.categories.find((c) => c.slug === slug) ??
        state.categories[state.categories.length - 1];
      const ratio = totalMinor / total;
      return {
        category,
        totalMinor,
        ratio,
        percentLabel: `${Math.round(ratio * 100)}%`,
      };
    })
    .sort((a, b) => b.totalMinor - a.totalMinor);
};

export interface TrendPoint {
  localDate: LocalDate;
  totalMinor: number;
  /** 0..1 against the window's peak — the bar height. */
  ratio: number;
  isToday: boolean;
}

export const spendTrend = (state: TallyState, days = 30): TrendPoint[] => {
  const today = todayLocalDate();
  const dates = lastNLocalDates(days);

  const totals = new Map<LocalDate, number>();
  for (const row of live(state.expenses)) {
    totals.set(row.localDate, (totals.get(row.localDate) ?? 0) + row.totalAmountMinor);
  }

  const peak = Math.max(1, ...dates.map((d) => totals.get(d) ?? 0));

  return dates.map((localDate) => {
    const totalMinor = totals.get(localDate) ?? 0;
    return {
      localDate,
      totalMinor,
      ratio: totalMinor / peak,
      isToday: localDate === today,
    };
  });
};

export interface HeatCell {
  localDate: LocalDate;
  totalMinor: number;
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
}

/**
 * Five weeks of calendar cells, Monday-aligned. Levels are quintiles of the
 * window's own peak, so the ramp always uses its full range.
 */
export const spendHeatmap = (state: TallyState, weeks = 5): HeatCell[] => {
  const today = todayLocalDate();
  const start = addDays(startOfWeek(today), -(weeks - 1) * 7);

  const totals = new Map<LocalDate, number>();
  for (const row of live(state.expenses)) {
    totals.set(row.localDate, (totals.get(row.localDate) ?? 0) + row.totalAmountMinor);
  }

  const cells: HeatCell[] = [];
  const peak = Math.max(1, ...[...totals.values()]);

  for (let i = 0; i < weeks * 7; i++) {
    const localDate = addDays(start, i);
    const totalMinor = totals.get(localDate) ?? 0;
    const fraction = totalMinor / peak;
    const level: HeatCell["level"] =
      totalMinor === 0 ? 0 : fraction > 0.75 ? 4 : fraction > 0.5 ? 3 : fraction > 0.25 ? 2 : 1;

    cells.push({ localDate, totalMinor, level, isFuture: localDate > today });
  }

  return cells;
};

export interface MonthComparison {
  month: LocalMonth;
  spentMinor: number;
  limitMinor: number;
  dayOfMonth: number;
  daysInMonth: number;
  previousMonth: LocalMonth;
  previousSpentToSamePointMinor: number;
  previousTotalMinor: number;
  /** Positive means this month is running ahead of last. */
  deltaMinor: number;
}

export const monthComparison = (state: TallyState): MonthComparison => {
  const month = currentLocalMonth();
  const prev = previousMonth(month);
  const today = todayLocalDate();
  const day = dayOfMonth(today);

  const rows = live(state.expenses);
  const spentMinor = sumMinor(rows.filter((e) => e.localMonth === month));

  // Compare like for like: last month up to the same day number, not its total.
  const previousRows = rows.filter((e) => e.localMonth === prev);
  const previousSpentToSamePointMinor = sumMinor(
    previousRows.filter((e) => dayOfMonth(e.localDate) <= day)
  );

  return {
    month,
    spentMinor,
    limitMinor: budgetFor(state, month).overallLimitMinor,
    dayOfMonth: day,
    daysInMonth: daysInMonth(month),
    previousMonth: prev,
    previousSpentToSamePointMinor,
    previousTotalMinor: sumMinor(previousRows),
    deltaMinor: spentMinor - previousSpentToSamePointMinor,
  };
};

export interface SpendDriver {
  name: string;
  totalMinor: number;
  detail: string;
}

export const topDrivers = (state: TallyState, limit = 3): SpendDriver[] => {
  const month = currentLocalMonth();
  const rows = live(state.expenses).filter((e) => e.localMonth === month);

  const groups = new Map<string, { total: number; count: number; days: Set<string> }>();
  for (const row of rows) {
    const entry = groups.get(row.name) ?? { total: 0, count: 0, days: new Set<string>() };
    entry.total += row.totalAmountMinor;
    entry.count += row.quantity;
    entry.days.add(row.localDate);
    groups.set(row.name, entry);
  }

  const elapsed = dayOfMonth(todayLocalDate());

  return [...groups.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([name, entry]) => ({
      name,
      totalMinor: entry.total,
      detail:
        entry.count > entry.days.size
          ? `${entry.count} logged this month`
          : `${entry.days.size} days of ${elapsed}`,
    }));
};

// ── Habits ─────────────────────────────────────────────────────────────────

export interface HabitView {
  habit: LocalHabit;
  todayCount: number;
  /** Observed average per day over the trailing window. */
  observedDailyCount: number;
  dailyCostMinor: number;
  monthlyCostMinor: number;
  yearlyCostMinor: number;
  whatIfCount: number;
  savedYearlyMinor: number;
  savedMonthlyMinor: number;
  streak: number;
}

const DAYS_IN_YEAR = 365;

export const habitViews = (state: TallyState, windowDays = 30): HabitView[] =>
  [...state.habits]
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((habit) => {
      const dates = new Set(lastNLocalDates(windowDays));
      const rows = live(state.expenses).filter(
        (e) => e.tileId === habit.tileId && dates.has(e.localDate)
      );

      const totalUnits = rows.reduce((sum, e) => sum + e.quantity, 0);
      // Fall back to the stored baseline until there's enough history to mean
      // anything — a brand-new habit shouldn't read as "৳0 a year".
      const observed = totalUnits > 0 ? totalUnits / windowDays : habit.baselineDailyCount;

      const daily = Math.round(habit.unitAmountMinor * observed);
      const whatIf = habit.whatIfDailyCount ?? Math.max(0, Math.round(observed));
      const reduction = Math.max(0, observed - whatIf);
      const savedYearly = Math.round(habit.unitAmountMinor * reduction * DAYS_IN_YEAR);

      return {
        habit,
        todayCount: todayCountFor(state, habit.tileId),
        observedDailyCount: observed,
        dailyCostMinor: daily,
        monthlyCostMinor: Math.round(habit.unitAmountMinor * observed * 30),
        yearlyCostMinor: Math.round(habit.unitAmountMinor * observed * DAYS_IN_YEAR),
        whatIfCount: whatIf,
        savedYearlyMinor: savedYearly,
        savedMonthlyMinor: Math.round(savedYearly / 12),
        streak: habitStreak(state, habit),
      };
    });

/**
 * Consecutive days, counting back from yesterday, where the logged count was
 * at or under target. Today is excluded — it isn't over yet, and counting a
 * partial day would show a streak that could still break.
 */
export const habitStreak = (state: TallyState, habit: LocalHabit): number => {
  if (habit.targetDailyCount === null) return 0;

  const counts = new Map<LocalDate, number>();
  for (const row of live(state.expenses)) {
    if (row.tileId !== habit.tileId) continue;
    counts.set(row.localDate, (counts.get(row.localDate) ?? 0) + row.quantity);
  }

  let streak = 0;
  let cursor = addDays(todayLocalDate(), -1);
  const floor = state.expenses.reduce(
    (min, e) => (e.localDate < min ? e.localDate : min),
    todayLocalDate()
  );

  while (cursor >= floor) {
    if ((counts.get(cursor) ?? 0) > habit.targetDailyCount) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
};

// ── Streak / profile ───────────────────────────────────────────────────────

/** Consecutive days up to today on which anything was logged. */
export const loggingStreak = (state: TallyState): number => {
  const days = new Set(live(state.expenses).map((e) => e.localDate));
  let streak = 0;
  let cursor = todayLocalDate();

  // Today not being logged yet shouldn't zero a real streak.
  if (!days.has(cursor)) cursor = addDays(cursor, -1);

  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
};

// ── Budgets ────────────────────────────────────────────────────────────────

export interface CategoryBudgetRow {
  category: LocalCategory;
  spentMinor: number;
  limitMinor: number;
  ratio: number;
  isOver: boolean;
  /** Day of the month the limit is projected to be crossed, if it will be. */
  projectedBreachDay: number | null;
}

export const categoryBudgetRows = (state: TallyState): CategoryBudgetRow[] => {
  const month = currentLocalMonth();
  const budget = budgetFor(state, month);
  const elapsed = dayOfMonth(todayLocalDate());
  const total = daysInMonth(month);
  const rows = live(state.expenses).filter((e) => e.localMonth === month);

  return budget.categoryLimits
    .map(({ categorySlug, limitMinor }) => {
      const category = state.categories.find((c) => c.slug === categorySlug);
      if (!category) return null;

      const spentMinor = sumMinor(rows.filter((e) => e.categorySlug === categorySlug));
      const ratio = limitMinor > 0 ? spentMinor / limitMinor : 0;

      // Straight-line projection from the pace so far.
      const perDay = elapsed > 0 ? spentMinor / elapsed : 0;
      const breachDay =
        perDay > 0 && limitMinor > 0 ? Math.ceil(limitMinor / perDay) : null;

      return {
        category,
        spentMinor,
        limitMinor,
        ratio,
        isOver: spentMinor > limitMinor,
        projectedBreachDay:
          breachDay !== null && breachDay <= total && spentMinor <= limitMinor
            ? breachDay
            : null,
      };
    })
    .filter((row): row is CategoryBudgetRow => row !== null)
    .sort((a, b) => b.ratio - a.ratio);
};

/** Straight-line month-end projection from the pace so far. */
export const monthForecast = (state: TallyState) => {
  const { spentMinor, limitMinor, dayOfMonth: elapsed, daysInMonth: total } =
    monthComparison(state);
  const perDay = elapsed > 0 ? spentMinor / elapsed : 0;
  const projectedMinor = Math.round(perDay * total);

  return {
    projectedMinor,
    limitMinor,
    overBy: projectedMinor - limitMinor,
    isOver: limitMinor > 0 && projectedMinor > limitMinor,
    ratio: limitMinor > 0 ? projectedMinor / limitMinor : 0,
    elapsedRatio: total > 0 ? elapsed / total : 0,
  };
};

export { weekdayIndex, monthOf, startOfWeek };
