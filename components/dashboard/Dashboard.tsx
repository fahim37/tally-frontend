"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, ProgressBar } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import {
  categoryBreakdown,
  monthComparison,
  ringState,
  spendHeatmap,
  spendTrend,
  topDrivers,
} from "@/lib/store/selectors";
import { formatMoney } from "@/lib/money";
import { monthLabel, monthShort, shortDate } from "@/lib/date";

const HEAT_COLORS = [
  "transparent",
  "var(--color-blue-100)",
  "var(--color-blue-200)",
  "var(--color-blue-400)",
  "var(--blue)",
];

/**
 * The one screen with a desktop layout. On a wide viewport the cards go into a
 * two-column grid; everywhere else it's a single mobile column, like the rest
 * of the app.
 */
export function Dashboard() {
  const { state } = useTally();
  const currency = state.profile.currency;

  const ring = useMemo(() => ringState(state), [state]);
  const month = useMemo(() => monthComparison(state), [state]);
  const trend = useMemo(() => spendTrend(state, 30), [state]);
  const categories = useMemo(() => categoryBreakdown(state), [state]);
  const heat = useMemo(() => spendHeatmap(state, 5), [state]);
  const drivers = useMemo(() => topDrivers(state, 3), [state]);

  const peak = trend.reduce(
    (best, point) => (point.totalMinor > best.totalMinor ? point : best),
    trend[0] ?? { totalMinor: 0, localDate: "" }
  );

  const monthRatio = month.limitMinor > 0 ? month.spentMinor / month.limitMinor : 0;
  const prevRatio =
    month.limitMinor > 0 ? month.previousSpentToSamePointMinor / month.limitMinor : 0;

  return (
    <div className="px-5 pb-8 pt-6 lg:mx-auto lg:max-w-[1100px] lg:px-8">
      <PageHeader
        title="Dashboard"
        action={
          <span
            className="tap-target rounded-pill border px-3 py-2 text-[12px] font-medium"
            style={{ borderColor: "var(--line)", color: "var(--text)" }}
          >
            {monthLabel(month.month)}
          </span>
        }
      />

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {/* Today / month tiles */}
        <div className="flex gap-2.5 lg:col-span-2">
          <Card className="flex-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--muted)" }}
            >
              Today
            </p>
            <p
              className="mt-2 font-display text-[27px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
              style={{ color: "var(--blue)" }}
            >
              {formatMoney(ring.spentMinor, currency)}
            </p>
            <p
              className="mt-1.5 text-[11px]"
              style={{ color: ring.isOver ? "var(--amber)" : "var(--teal)" }}
            >
              {ring.allowanceMinor === 0
                ? "No budget set"
                : ring.remainingMinor >= 0
                  ? `${formatMoney(ring.remainingMinor, currency)} under`
                  : `${formatMoney(-ring.remainingMinor, currency)} over`}
            </p>
          </Card>

          <Card className="flex-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--muted)" }}
            >
              Month so far
            </p>
            <p
              className="mt-2 font-display text-[27px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
              style={{ color: "var(--text)" }}
            >
              {formatMoney(month.spentMinor, currency)}
            </p>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
              {month.limitMinor > 0 ? `of ${formatMoney(month.limitMinor, currency)} · ` : ""}
              day {month.dayOfMonth}
            </p>
          </Card>
        </div>

        {/* This month vs last */}
        <Card title="This month vs last">
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[12px] font-medium" style={{ color: "var(--text)" }}>
                  {monthShort(month.month)}, day {month.dayOfMonth}
                </span>
                <span
                  className="font-mono text-[13px] font-medium tabular-nums"
                  style={{ color: "var(--text)" }}
                >
                  {formatMoney(month.spentMinor, currency)}
                </span>
              </div>
              <ProgressBar ratio={monthRatio} />
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>
                  {monthShort(month.previousMonth)}, day {month.dayOfMonth}
                </span>
                <span
                  className="font-mono text-[13px] font-medium tabular-nums"
                  style={{ color: "var(--muted)" }}
                >
                  {formatMoney(month.previousSpentToSamePointMinor, currency)}
                </span>
              </div>
              <ProgressBar ratio={prevRatio} color="var(--color-blue-200)" />
            </div>
          </div>

          <p className="mt-3.5 text-[12px] leading-[1.45]" style={{ color: "var(--muted)" }}>
            {month.previousSpentToSamePointMinor === 0
              ? "No history from last month to compare against yet."
              : month.deltaMinor === 0
                ? "Exactly level with last month at the same point."
                : month.deltaMinor < 0
                  ? `You're ${formatMoney(-month.deltaMinor, currency)} behind last month at the same point.`
                  : `You're ${formatMoney(month.deltaMinor, currency)} ahead of last month at the same point.`}
          </p>
        </Card>

        {/* 30-day trend */}
        <Card
          title="Last 30 days"
          action={
            <span className="text-[11px]" style={{ color: "var(--faint)" }}>
              {peak.totalMinor > 0
                ? `Peak ${formatMoney(peak.totalMinor, currency)} · ${shortDate(peak.localDate)}`
                : "No spend yet"}
            </span>
          }
        >
          <div className="flex h-[62px] items-end gap-[3px]">
            {trend.map((point) => (
              <span
                key={point.localDate}
                title={`${shortDate(point.localDate)} · ${formatMoney(point.totalMinor, currency)}`}
                className="flex-1 rounded-[2px]"
                style={{
                  height: `${Math.max(4, point.ratio * 62)}px`,
                  background: point.isToday
                    ? "var(--blue)"
                    : point.ratio > 0.7
                      ? "var(--amber)"
                      : "var(--color-blue-200)",
                }}
              />
            ))}
          </div>
          <div
            className="mt-2.5 flex justify-between text-[10px] font-medium uppercase tracking-[0.06em]"
            style={{ color: "var(--faint)" }}
          >
            <span>{shortDate(trend[0]?.localDate ?? "")}</span>
            <span>{shortDate(trend[Math.floor(trend.length / 2)]?.localDate ?? "")}</span>
            <span>Today</span>
          </div>
        </Card>

        {/* Where it went */}
        <Card title="Where it went">
          {categories.length === 0 ? (
            <p className="py-4 text-[13px]" style={{ color: "var(--faint)" }}>
              Nothing logged this month yet.
            </p>
          ) : (
            <>
              <div className="mb-4 flex h-2.5 overflow-hidden rounded-pill">
                {categories.map((slice) => (
                  <span
                    key={slice.category.slug}
                    style={{ width: `${slice.ratio * 100}%`, background: slice.category.colorVar }}
                  />
                ))}
              </div>

              <ul className="flex flex-col gap-3">
                {categories.map((slice) => (
                  <li key={slice.category.slug} className="flex items-center gap-2.5">
                    <span
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ background: slice.category.colorVar }}
                    />
                    <span className="flex-1 text-[13px]" style={{ color: "var(--text)" }}>
                      {slice.category.name}
                    </span>
                    <span
                      className="font-mono text-[12px] tabular-nums"
                      style={{ color: "var(--muted)" }}
                    >
                      {slice.percentLabel}
                    </span>
                    <span
                      className="w-[62px] text-right font-mono text-[13px] font-medium tabular-nums"
                      style={{ color: "var(--text)" }}
                    >
                      {formatMoney(slice.totalMinor, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* Heatmap. Capped: the cells are square, so in a full-width desktop
            column each one inflates to ~95px and the calendar reads as a wall
            of tiles rather than a density plot. */}
        <Card title="Heavier days are darker">
          <div className="max-w-[320px]">
          <div className="mb-1.5 grid grid-cols-7 gap-1.5">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
              <span
                key={`${day}-${i}`}
                className="text-center text-[10px] font-medium"
                style={{ color: "var(--faint)" }}
              >
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {heat.map((cell) => (
              <span
                key={cell.localDate}
                title={`${shortDate(cell.localDate)} · ${formatMoney(cell.totalMinor, currency)}`}
                className="rounded-[5px]"
                style={{
                  aspectRatio: "1",
                  background: HEAT_COLORS[cell.level],
                  border: cell.level === 0 ? "1px solid var(--line)" : "1px solid transparent",
                  opacity: cell.isFuture ? 0.35 : 1,
                }}
              />
            ))}
          </div>

          <div className="mt-3.5 flex items-center gap-1.5">
            <span className="mr-0.5 text-[11px]" style={{ color: "var(--faint)" }}>
              Light
            </span>
            {HEAT_COLORS.map((color, level) => (
              <span
                key={color}
                className="size-[13px] rounded-[4px]"
                style={{
                  background: color,
                  border: level === 0 ? "1px solid var(--line)" : undefined,
                }}
              />
            ))}
            <span className="ml-0.5 text-[11px]" style={{ color: "var(--faint)" }}>
              Heavy
            </span>
          </div>
          </div>
        </Card>

        {/* Top drivers */}
        <Card title="Top 3 spend drivers">
          {drivers.length === 0 ? (
            <p className="py-4 text-[13px]" style={{ color: "var(--faint)" }}>
              Log a few things and the pattern shows up here.
            </p>
          ) : (
            <ol className="flex flex-col gap-3.5">
              {drivers.map((driver, index) => (
                <li key={driver.name} className="flex items-baseline gap-3">
                  <span
                    className="w-3.5 font-mono text-[13px] font-semibold"
                    style={{ color: "var(--faint)" }}
                  >
                    {index + 1}
                  </span>
                  <span className="flex-1">
                    <span
                      className="block text-[14px] font-medium leading-tight"
                      style={{ color: "var(--text)" }}
                    >
                      {driver.name}
                    </span>
                    <span
                      className="mt-[3px] block text-[11px]"
                      style={{ color: "var(--muted)" }}
                    >
                      {driver.detail}
                    </span>
                  </span>
                  <span
                    className="font-mono text-[14px] font-medium tabular-nums"
                    style={{ color: "var(--text)" }}
                  >
                    {formatMoney(driver.totalMinor, currency)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="flex gap-2.5 lg:col-span-2">
          <DashLink href="/history" icon="edit" label="History" />
          <DashLink href="/insights" icon="warning" label="Insights" />
          <DashLink href="/budgets" icon="dashboard" label="Budgets" />
        </div>
      </div>
    </div>
  );
}

function DashLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-1 items-center justify-center gap-2 rounded-card border py-3.5 text-[13px] font-medium"
      style={{ borderColor: "var(--line)", background: "var(--surf)", color: "var(--text)" }}
    >
      <Icon name={icon} size={16} strokeWidth={1.8} />
      {label}
    </Link>
  );
}

export default Dashboard;
