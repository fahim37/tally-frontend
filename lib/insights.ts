import {
  addDays,
  currentLocalMonth,
  startOfWeek,
  todayLocalDate,
  weekRangeLabel,
  type LocalDate,
} from "./date";
import { formatMoney } from "./money";
import { monthForecast } from "./store/selectors";
import type { TallyState } from "./store/state";

/**
 * Locally computed insights.
 *
 * The *findings* here are arithmetic — week-over-week deltas, a straight-line
 * forecast, outliers against a category's own history — so they're computed on
 * device and work with no connection. What the AI adds is the writing: turning
 * these figures into a paragraph that reads like a person wrote it, and
 * answering free-form questions. Until that endpoint is live the screen shows
 * the same findings in plainer sentences rather than showing nothing.
 *
 * Everything is stated as observation, never advice.
 */

const sumBetween = (state: TallyState, from: LocalDate, to: LocalDate, slug?: string) =>
  state.expenses
    .filter(
      (e) =>
        !e.deletedAt &&
        e.localDate >= from &&
        e.localDate <= to &&
        (!slug || e.categorySlug === slug)
    )
    .reduce((total, e) => total + e.totalAmountMinor, 0);

export interface WeeklySummary {
  rangeLabel: string;
  sentences: string[];
  hasData: boolean;
}

export const weeklySummary = (state: TallyState): WeeklySummary => {
  const currency = state.profile.currency;
  const today = todayLocalDate();

  const thisStart = startOfWeek(today);
  const thisEnd = today;
  const lastStart = addDays(thisStart, -7);
  const lastEnd = addDays(thisStart, -1);

  const thisTotal = sumBetween(state, thisStart, thisEnd);
  const lastTotal = sumBetween(state, lastStart, lastEnd);

  if (thisTotal === 0) {
    return {
      rangeLabel: weekRangeLabel(thisStart, thisEnd),
      sentences: ["Nothing logged this week yet."],
      hasData: false,
    };
  }

  const sentences: string[] = [];

  // Biggest category mover, week over week.
  const moves = state.categories
    .map((category) => {
      const now = sumBetween(state, thisStart, thisEnd, category.slug);
      const before = sumBetween(state, lastStart, lastEnd, category.slug);
      return {
        name: category.name,
        now,
        before,
        delta: now - before,
        ratio: before > 0 ? (now - before) / before : null,
      };
    })
    .filter((move) => move.now > 0 || move.before > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const biggest = moves[0];
  if (biggest && biggest.ratio !== null && Math.abs(biggest.ratio) >= 0.15) {
    const direction = biggest.delta > 0 ? "higher" : "lower";
    sentences.push(
      `${biggest.name} was ${Math.abs(Math.round(biggest.ratio * 100))}% ${direction} this week — ${formatMoney(Math.abs(biggest.delta), currency)} ${biggest.delta > 0 ? "more" : "less"} than last.`
    );
  }

  // Anything that held steady is worth saying too — it's the baseline the
  // user's habits actually run at.
  const steady = moves.filter(
    (move) => move.ratio !== null && Math.abs(move.ratio) < 0.08 && move.now > 0
  );
  if (steady.length) {
    const names = steady.slice(0, 2).map((m) => m.name.toLowerCase());
    const total = steady.slice(0, 2).reduce((sum, m) => sum + m.now, 0);
    sentences.push(
      `${names.join(" and ")} held steady at ${formatMoney(total, currency)} for the week.`
    );
  }

  if (lastTotal > 0) {
    const delta = thisTotal - lastTotal;
    sentences.push(
      delta === 0
        ? `The week came in level with the one before, at ${formatMoney(thisTotal, currency)}.`
        : `In total, ${formatMoney(thisTotal, currency)} this week against ${formatMoney(lastTotal, currency)} last — ${formatMoney(Math.abs(delta), currency)} ${delta > 0 ? "more" : "less"}.`
    );
  } else {
    sentences.push(`${formatMoney(thisTotal, currency)} logged so far this week.`);
  }

  return {
    rangeLabel: weekRangeLabel(thisStart, thisEnd),
    sentences,
    hasData: true,
  };
};

export interface Anomaly {
  id: string;
  name: string;
  amountMinor: number;
  localDate: LocalDate;
  reason: string;
}

/**
 * Flags an expense that is unusually large for its own category — more than
 * twice that category's typical entry over the last 60 days. Comparing a
 * category against itself avoids the obvious trap where every rent payment
 * reads as an anomaly next to a cup of tea.
 */
export const findAnomalies = (state: TallyState, limit = 2): Anomaly[] => {
  const currency = state.profile.currency;
  const today = todayLocalDate();
  const windowStart = addDays(today, -60);
  const recentStart = addDays(today, -14);

  const live = state.expenses.filter(
    (e) => !e.deletedAt && e.localDate >= windowStart
  );

  const byCategory = new Map<string, number[]>();
  for (const expense of live) {
    const bucket = byCategory.get(expense.categorySlug) ?? [];
    bucket.push(expense.totalAmountMinor);
    byCategory.set(expense.categorySlug, bucket);
  }

  const medians = new Map<string, number>();
  for (const [slug, amounts] of byCategory) {
    // Median, not mean — one outlier shouldn't raise the bar that detects it.
    const sorted = [...amounts].sort((a, b) => a - b);
    medians.set(slug, sorted[Math.floor(sorted.length / 2)] ?? 0);
  }

  return live
    .filter((expense) => {
      if (expense.localDate < recentStart) return false;
      const median = medians.get(expense.categorySlug) ?? 0;
      const sampleSize = byCategory.get(expense.categorySlug)?.length ?? 0;
      // Too few examples and "typical" means nothing yet.
      return sampleSize >= 5 && median > 0 && expense.totalAmountMinor > median * 2.5;
    })
    .sort((a, b) => b.totalAmountMinor - a.totalAmountMinor)
    .slice(0, limit)
    .map((expense) => {
      const category = state.categories.find((c) => c.slug === expense.categorySlug);
      const median = medians.get(expense.categorySlug) ?? 0;
      return {
        id: expense.id,
        name: expense.name,
        amountMinor: expense.totalAmountMinor,
        localDate: expense.localDate,
        reason: `${category?.name ?? "This category"} usually runs about ${formatMoney(median, currency)} an entry.`,
      };
    });
};

export interface ForecastInsight {
  projectedMinor: number;
  limitMinor: number;
  isOver: boolean;
  overByMinor: number;
  sentence: string;
  ratio: number;
  elapsedRatio: number;
}

export const forecastInsight = (state: TallyState): ForecastInsight => {
  const currency = state.profile.currency;
  const forecast = monthForecast(state);

  const sentence =
    forecast.limitMinor === 0
      ? `On this pace the month finishes around ${formatMoney(forecast.projectedMinor, currency)}.`
      : forecast.isOver
        ? `On this pace you finish ${formatMoney(forecast.overBy, currency)} over.`
        : `On this pace you finish ${formatMoney(-forecast.overBy, currency)} under.`;

  return {
    projectedMinor: forecast.projectedMinor,
    limitMinor: forecast.limitMinor,
    isOver: forecast.isOver,
    overByMinor: forecast.overBy,
    sentence,
    ratio: forecast.ratio,
    elapsedRatio: forecast.elapsedRatio,
  };
};

/**
 * Answers a question from local data.
 *
 * This handles the shapes that are genuinely mechanical — "how much on X in
 * the last N months/days/weeks" — which covers most of what the search box
 * gets asked. Anything else is passed to the AI endpoint when it's reachable;
 * this returns null so the caller can decide.
 */
export const answerLocally = (question: string, state: TallyState): string | null => {
  const text = question.toLowerCase().trim();
  if (!text) return null;

  const currency = state.profile.currency;
  const today = todayLocalDate();

  // How far back?
  let days = 30;
  let periodLabel = "the last 30 days";

  const months = text.match(/(\d+)\s*months?/);
  const weeks = text.match(/(\d+)\s*weeks?/);
  const rawDays = text.match(/(\d+)\s*days?/);

  if (months) {
    days = Number(months[1]) * 30;
    periodLabel = `the last ${months[1]} month${Number(months[1]) > 1 ? "s" : ""}`;
  } else if (weeks) {
    days = Number(weeks[1]) * 7;
    periodLabel = `the last ${weeks[1]} week${Number(weeks[1]) > 1 ? "s" : ""}`;
  } else if (rawDays) {
    days = Number(rawDays[1]);
    periodLabel = `the last ${rawDays[1]} days`;
  } else if (text.includes("this month")) {
    days = new Date().getDate();
    periodLabel = "this month";
  }

  const from = addDays(today, -days);

  // What subject? Match a tile or category name mentioned in the question.
  const tile = state.tiles.find((t) => text.includes(t.name.toLowerCase()));
  const category = state.categories.find((c) => text.includes(c.name.toLowerCase()));

  if (!tile && !category) {
    if (!/how much|total|spend|spent/.test(text)) return null;

    const total = sumBetween(state, from, today);
    return `${formatMoney(total, currency)} in ${periodLabel}.`;
  }

  const rows = state.expenses.filter(
    (e) =>
      !e.deletedAt &&
      e.localDate >= from &&
      e.localDate <= today &&
      (tile ? e.tileId === tile.id : e.categorySlug === category?.slug)
  );

  const total = rows.reduce((sum, e) => sum + e.totalAmountMinor, 0);
  const count = rows.reduce((sum, e) => sum + e.quantity, 0);
  const subject = tile?.name ?? category?.name ?? "that";

  if (total === 0) return `Nothing logged for ${subject.toLowerCase()} in ${periodLabel}.`;

  return tile
    ? `${formatMoney(total, currency)} on ${subject.toLowerCase()} in ${periodLabel} — ${count} logged, about ${formatMoney(Math.round(total / Math.max(1, days)), currency)} a day.`
    : `${formatMoney(total, currency)} on ${subject.toLowerCase()} in ${periodLabel}.`;
};

export { currentLocalMonth };
