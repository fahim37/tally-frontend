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
import type { LocalCategory, LocalExpense, LocalHabit, TallyState, TileEntry } from "./state";

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

/** The "anything else" category. Its tile always sorts to the end of the pad. */
export const CATCH_ALL_SLUG = "other";

export interface PadTile {
  id: string;
  name: string;
  iconKey: string;
  categorySlug: string;
  amountMinor: number;
  sortIndex: number;
  presetAmountsMinor: number[];
  /** "instant" logs on tap; "prompt" asks how much first. */
  entry: TileEntry;
  todayCount: number;
  /** What this tile has cost today — the only honest figure to show on a
   *  prompt tile, whose per-entry amount is different every time. */
  todayTotalMinor: number;
  usageCount: number;
}

/**
 * Today's quantity per tile, in one pass.
 *
 * `padTiles` used to call `todayCountFor` once per tile, and each of those
 * called `live()`, which allocates a filtered copy of the entire expense
 * array. Twelve tiles against a year of history meant twelve full scans and
 * twelve discarded arrays — per call, and `padTiles` is called three to five
 * times on every tap.
 */
export interface TodayTally {
  count: number;
  totalMinor: number;
}

export const todayCounts = (state: TallyState): Map<string, TodayTally> => {
  const today = todayLocalDate();
  const counts = new Map<string, TodayTally>();
  const tilesByCategory = new Map<string, string[]>();

  for (const tile of state.tiles) {
    if (tile.isArchived) continue;
    const ids = tilesByCategory.get(tile.categorySlug) ?? [];
    ids.push(tile.id);
    tilesByCategory.set(tile.categorySlug, ids);
  }

  for (const expense of state.expenses) {
    if (expense.deletedAt || expense.localDate !== today) continue;
    // Early production syncs lost `tile-food`/`tile-transport` because those
    // local ids had no matching server Tile document. A tap still carries its
    // category; when exactly one live tile owns that category, the association
    // is unambiguous and its tally should not disappear.
    const candidates = tilesByCategory.get(expense.categorySlug) ?? [];
    const tileId =
      expense.tileId ?? (expense.source === "tap" && candidates.length === 1 ? candidates[0] : null);
    if (!tileId) continue;

    const entry = counts.get(tileId);
    if (entry) {
      entry.count += expense.quantity;
      entry.totalMinor += expense.totalAmountMinor;
    } else {
      counts.set(tileId, {
        count: expense.quantity,
        totalMinor: expense.totalAmountMinor,
      });
    }
  }

  return counts;
};

/**
 * Tiles in pad order: most-used first, since the brief asks them to reorder by
 * frequency. Ties fall back to the starting order so the grid doesn't shuffle
 * arbitrarily on a fresh account.
 *
 * `counts` is optional so callers that already built the map (the home screen
 * builds it once for the pad, the rail and the ring) can pass it through
 * instead of paying for it again.
 */
export const padTiles = (state: TallyState, counts?: Map<string, TodayTally>): PadTile[] => {
  const today = counts ?? todayCounts(state);

  return state.tiles
    .filter((t) => !t.isArchived)
    .map((t) => {
      const tally = today.get(t.id);
      return {
        id: t.id,
        name: t.name,
        iconKey: t.iconKey,
        categorySlug: t.categorySlug,
        amountMinor: t.defaultAmountMinor,
        sortIndex: t.sortIndex,
        presetAmountsMinor: t.presetAmountsMinor,
        entry: t.entry,
        todayCount: tally?.count ?? 0,
        todayTotalMinor: tally?.totalMinor ?? 0,
        usageCount: t.usageCount,
      };
    })
    .sort((a, b) => {
      // "Extras" is the leftover bucket — whatever didn't fit the other tiles.
      // It belongs at the end of the pad no matter how often it gets used,
      // because reading past it to reach a real category is backwards.
      const aLast = a.categorySlug === CATCH_ALL_SLUG ? 1 : 0;
      const bLast = b.categorySlug === CATCH_ALL_SLUG ? 1 : 0;
      if (aLast !== bLast) return aLast - bLast;

      // Then by frequency, as the brief asks. Ties fall back to the tile's own
      // order rather than alphabetically, so a fresh pad reads in the order it
      // was designed in (Cigarette, Food, Transport) instead of being
      // reshuffled into an alphabet nobody chose.
      return b.usageCount - a.usageCount || a.sortIndex - b.sortIndex;
    });
};

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

// ── Smoking ────────────────────────────────────────────────────────────────

/**
 * The category the reduction features track. Everything below keys off the
 * category rather than a specific tile, so a second tile ("Pack of 20") counts
 * toward the same day without any extra wiring.
 */
export const SMOKING_SLUG = "cigarettes";

export interface SmokingDay {
  localDate: LocalDate;
  count: number;
  /** Null before a target is set — an unmet target and no target at all are
   *  different things and must not colour the same. */
  underTarget: boolean | null;
}

export interface SmokingStats {
  /** False when nothing has ever been logged in this category. */
  isTracked: boolean;
  todayCount: number;
  targetDailyCount: number | null;
  /** Average per day over the trailing window, across logged days only. */
  averageDailyCount: number;
  /** The same average for the window before it — the honest trend. */
  previousAverageDailyCount: number;
  /** Negative means smoking less. Null when there isn't enough history yet. */
  changePercent: number | null;
  /** Consecutive days up to yesterday at or under target. */
  streak: number;
  bestStreak: number;
  /** Most recent first — the 14-day strip on the home card. */
  recentDays: SmokingDay[];
  totalLogged: number;
  smokeFreeDays: number;
}

/**
 * Everything the reduction features need, from a per-day count map.
 *
 * Deliberately all *observed* numbers — what was actually logged, on what
 * days, against a target the user chose. There is no "you would save ৳X a
 * year if you cut down" figure anywhere here: that multiplies a guess by 365
 * to produce something shaped like a fact, and measures a year that hasn't
 * happened instead of the day that has. Days under target either happened or
 * they didn't.
 */
const reductionStats = (
  counts: Map<LocalDate, number>,
  target: number | null,
  windowDays: number
): SmokingStats => {
  const today = todayLocalDate();
  const window = lastNLocalDates(windowDays);
  const previousWindow = lastNLocalDates(windowDays * 2).slice(0, windowDays);

  // Averages run over days that were actually logged. Including untracked days
  // as zeroes would show a fake improvement every time someone forgets to log.
  const averageOver = (dates: LocalDate[]) => {
    const logged = dates.map((d) => counts.get(d)).filter((n): n is number => n !== undefined);
    if (!logged.length) return 0;
    return logged.reduce((sum, n) => sum + n, 0) / logged.length;
  };

  const average = averageOver(window);
  const previousAverage = averageOver(previousWindow);

  const changePercent =
    previousAverage > 0 && average > 0
      ? Math.round(((average - previousAverage) / previousAverage) * 100)
      : null;

  // Streaks count back from yesterday: today isn't over, and a streak that can
  // still break tonight isn't one yet.
  let streak = 0;
  if (target !== null) {
    let cursor = addDays(today, -1);
    while (counts.has(cursor) && (counts.get(cursor) ?? 0) <= target) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
  }

  let bestStreak = 0;
  if (target !== null && counts.size) {
    const dates = [...counts.keys()].sort();
    let run = 0;
    let previous: LocalDate | null = null;

    for (const date of dates) {
      const under = (counts.get(date) ?? 0) <= target;
      // A gap in logging breaks the run rather than extending it across days
      // we know nothing about.
      const contiguous = previous !== null && addDays(previous, 1) === date;

      if (!under) run = 0;
      else run = contiguous ? run + 1 : 1;

      bestStreak = Math.max(bestStreak, run);
      previous = date;
    }
  }

  const recentDays: SmokingDay[] = window.map((localDate) => {
    const logged = counts.get(localDate);
    return {
      localDate,
      count: logged ?? 0,
      underTarget: target === null || logged === undefined ? null : logged <= target,
    };
  });

  return {
    isTracked: counts.size > 0,
    todayCount: counts.get(today) ?? 0,
    targetDailyCount: target,
    averageDailyCount: average,
    previousAverageDailyCount: previousAverage,
    changePercent,
    streak,
    bestStreak,
    recentDays,
    totalLogged: [...counts.values()].reduce((sum, n) => sum + n, 0),
    smokeFreeDays: [...counts.values()].filter((n) => n === 0).length,
  };
};

/** Per-day totals for whatever subset of expenses `matches` accepts. */
const dailyCounts = (
  state: TallyState,
  matches: (expense: LocalExpense) => boolean
): Map<LocalDate, number> => {
  const counts = new Map<LocalDate, number>();
  for (const expense of live(state.expenses)) {
    if (!matches(expense)) continue;
    counts.set(expense.localDate, (counts.get(expense.localDate) ?? 0) + expense.quantity);
  }
  return counts;
};

/**
 * Smoking, tracked by category rather than by tile — so a second tile ("Pack
 * of 20") counts toward the same day without any extra wiring.
 */
export const smokingStats = (state: TallyState, windowDays = 14): SmokingStats => {
  const counts = dailyCounts(state, (e) => e.categorySlug === SMOKING_SLUG);

  const habit = state.habits.find((h) => {
    const tile = state.tiles.find((t) => t.id === h.tileId);
    return tile?.categorySlug === SMOKING_SLUG;
  });

  return reductionStats(counts, habit?.targetDailyCount ?? null, windowDays);
};

/** The same picture for any tracked habit. */
export const habitProgress = (
  state: TallyState,
  habit: LocalHabit,
  windowDays = 14
): SmokingStats =>
  reductionStats(
    dailyCounts(state, (e) => e.tileId === habit.tileId),
    habit.targetDailyCount,
    windowDays
  );

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

export interface SafeToSpend {
  /** What's left of the month's budget. */
  remainingMinor: number;
  daysLeft: number;
  /** Remaining budget ÷ days left — the pace that actually finishes the month. */
  perDayMinor: number;
  /** The flat allowance the budget started at, for comparison. */
  originalPerDayMinor: number;
  hasBudget: boolean;
  isBehind: boolean;
  /** True once the month's budget is already gone. */
  isBlown: boolean;
}

/**
 * "What can I spend a day from here?"
 *
 * The flat daily allowance (budget ÷ days in month) is the number you plan
 * with, but it's the wrong number from the 12th onward, because it can't see
 * what you've already done. Overspend early and it keeps cheerfully quoting a
 * figure that guarantees you finish over.
 *
 * This is the one that recovers: it divides what's *left* by the days that are
 * *left*, so it tightens when you're behind and loosens when you're under. It
 * is the honest answer to "how do I get through the month on what I have."
 */
export const safeToSpend = (state: TallyState): SafeToSpend => {
  const month = currentLocalMonth();
  const budget = budgetFor(state, month);
  const total = daysInMonth(month);
  const elapsed = dayOfMonth(todayLocalDate());

  // Today is still spendable, so it counts as one of the days remaining.
  const daysLeft = Math.max(1, total - elapsed + 1);

  const spent = sumMinor(live(state.expenses).filter((e) => e.localMonth === month));
  const limit = budget.overallLimitMinor;
  const remaining = limit - spent;

  const perDay = limit > 0 ? Math.max(0, Math.round(remaining / daysLeft / 100) * 100) : 0;
  const originalPerDay = limit > 0 ? Math.round(limit / total / 100) * 100 : 0;

  return {
    remainingMinor: remaining,
    daysLeft,
    perDayMinor: perDay,
    originalPerDayMinor: originalPerDay,
    hasBudget: limit > 0,
    isBehind: limit > 0 && perDay < originalPerDay,
    isBlown: limit > 0 && remaining <= 0,
  };
};

export interface DayStat {
  localDate: LocalDate;
  totalMinor: number;
}

/** The heaviest day in a window, and the average, so one can be read against
 *  the other. Used for "you spent more in one day than…" observations. */
export const dayExtremes = (state: TallyState, days = 30) => {
  const dates = lastNLocalDates(days);
  const inWindow = new Set(dates);

  const totals = new Map<LocalDate, number>();
  for (const row of live(state.expenses)) {
    if (!inWindow.has(row.localDate)) continue;
    totals.set(row.localDate, (totals.get(row.localDate) ?? 0) + row.totalAmountMinor);
  }

  const logged: DayStat[] = [...totals.entries()]
    .map(([localDate, totalMinor]) => ({ localDate, totalMinor }))
    .filter((d) => d.totalMinor > 0)
    .sort((a, b) => b.totalMinor - a.totalMinor);

  const sum = logged.reduce((n, d) => n + d.totalMinor, 0);

  return {
    busiest: logged[0] ?? null,
    quietest: logged[logged.length - 1] ?? null,
    // Averaged over days actually logged, not the whole window — a week of
    // untracked days would otherwise halve the "typical day" figure.
    averageMinor: logged.length ? Math.round(sum / logged.length) : 0,
    loggedDays: logged.length,
  };
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
