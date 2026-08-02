"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import { useToast } from "@/components/ui/Toast";
import {
  dayExtremes,
  padTiles,
  ringState,
  safeToSpend,
  smokingStats,
  todayCounts,
  type PadTile,
} from "@/lib/store/selectors";
import { formatMoney } from "@/lib/money";
import { todayLocalDate } from "@/lib/date";
import { SpendCard } from "./SpendCard";
import { TapTile } from "./TapTile";
import { TileSheet } from "./TileSheet";
import { NewTileSheet } from "./NewTileSheet";
import { AmountSheet } from "./AmountSheet";
import { SmokingCard } from "./SmokingCard";

/**
 * The home screen. Everything above the fold answers two questions — what have
 * I spent today, and how does that sit against the day's allowance — and
 * everything below it is one tap from logging.
 */
export function TapPad() {
  const { state, dispatch } = useTally();
  const { toast } = useToast();

  const [sheetTileId, setSheetTileId] = useState<string | null>(null);
  const [amountTileId, setAmountTileId] = useState<string | null>(null);
  const [newTileOpen, setNewTileOpen] = useState(false);
  const [pulse, setPulse] = useState(0);

  const currency = state.profile.currency;

  // One pass over the expenses for all three of these. They used to run
  // independently, which meant three-to-five full scans of the whole history
  // on the single most latency-sensitive gesture in the product.
  const counts = useMemo(() => todayCounts(state), [state]);
  const tiles = useMemo(() => padTiles(state, counts), [state, counts]);
  const ring = useMemo(() => ringState(state), [state]);
  const smoking = useMemo(() => smokingStats(state), [state]);

  const sheetTile: PadTile | null = sheetTileId
    ? (tiles.find((tile) => tile.id === sheetTileId) ?? null)
    : null;
  const amountTile: PadTile | null = amountTileId
    ? (tiles.find((tile) => tile.id === amountTileId) ?? null)
    : null;

  const confirmed = (name: string, amountMinor: number) => {
    setPulse((n) => n + 1);
    navigator.vibrate?.(8);
    toast(`${name} logged · ${formatMoney(amountMinor, currency)}`, {
      actionLabel: "Undo",
      onAction: () => dispatch({ type: "UNDO_LAST_TAP" }),
    });
  };

  /**
   * A tap means different things to different tiles. A fixed-price one logs
   * and is done — that is the whole product. One whose price changes every
   * time asks first, because logging ৳50 for a meal that cost ৳400 is worse
   * than not logging it.
   */
  const handleTap = (tileId: string) => {
    const tile = tiles.find((t) => t.id === tileId);
    if (!tile) return;

    if (tile.entry === "prompt") {
      setAmountTileId(tileId);
      return;
    }

    dispatch({ type: "TAP_TILE", tileId });
    confirmed(tile.name, tile.amountMinor);
  };

  const logAmount = (amountMinor: number, label: string) => {
    if (!amountTile) return;
    dispatch({ type: "LOG_TILE_AMOUNT", tileId: amountTile.id, amountMinor, label });
    confirmed(label.trim() || amountTile.name, amountMinor);
  };

  /** "This always costs the same" — switch the tile over and log it now. */
  const makeInstant = (amountMinor: number) => {
    if (!amountTile) return;
    dispatch({
      type: "UPDATE_TILE",
      tileId: amountTile.id,
      patch: { entry: "instant", defaultAmountMinor: amountMinor },
    });
    dispatch({ type: "LOG_TILE_AMOUNT", tileId: amountTile.id, amountMinor });
    confirmed(amountTile.name, amountMinor);
  };

  return (
    <div className="flex flex-col px-5 pb-8">
      {/* Total + ring */}
      <div className="pt-5 pb-6">
        <SpendCard ring={ring} currency={currency} pulseKey={pulse} />
      </div>

      {/* The pad */}
      <div className="grid grid-cols-3 gap-2.5 pb-4">
        {tiles.map((tile, index) => (
          <TapTile
            key={tile.id}
            tile={tile}
            index={index}
            currency={currency}
            strikeAt={state.settings.strikeAt}
            longPressMs={state.settings.longPressMs}
            pressDepth={state.settings.pressDepth}
            onTap={handleTap}
            onLongPress={setSheetTileId}
          />
        ))}

        <button
          type="button"
          onClick={() => setNewTileOpen(true)}
          className="flex h-34 flex-col items-center justify-center gap-2 rounded-tile border-[1.5px] border-dashed transition-colors"
          style={{
            // --line is a hairline meant for solid borders on a surface; as a
            // dashed border on the page background it disappears. This needs a
            // step more contrast to read as an affordance.
            borderColor: "color-mix(in srgb, var(--muted) 35%, transparent)",
            color: "var(--muted)",
          }}
        >
          <span
            className="flex items-center justify-center rounded-full"
            style={{
              width: 34,
              height: 34,
              background: "color-mix(in srgb, var(--muted) 12%, transparent)",
            }}
          >
            <Icon name="plus" size={20} strokeWidth={1.9} />
          </span>
          <span className="text-meta font-medium">Add tile</span>
        </button>
      </div>

      <p className="text-caption" style={{ color: "var(--faint)" }}>
        Long-press a tile to change its amount, or how it logs.
      </p>

      {/* The reduction card sits above the money, not below it — for anyone
          using this to cut down, it's the reason the app is open. It appears
          as soon as there's a single cigarette logged. */}
      {smoking.isTracked && <SmokingCard stats={smoking} />}

      {ring.spentMinor === 0 ? <FirstRun /> : <TodaySummary />}

      <TodayStats />

      <TileSheet tile={sheetTile} onClose={() => setSheetTileId(null)} />
      <NewTileSheet open={newTileOpen} onClose={() => setNewTileOpen(false)} />
      <AmountSheet
        key={amountTile?.id ?? "none"}
        tile={amountTile}
        currency={currency}
              onClose={() => setAmountTileId(null)}
        onConfirm={logAmount}
        onMakeInstant={makeInstant}
      />
    </div>
  );
}

/** Before the first tap of the day the screen is otherwise empty, so it says
 *  what the marks will do rather than showing a blank half-page. */
function FirstRun() {
  return (
    <div
      className="animate-row-in mt-6 rounded-card border p-5"
      style={{ background: "var(--surf)", borderColor: "var(--line)" }}
    >
      <div className="mb-4 flex items-center gap-1.5" style={{ color: "var(--line)" }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-[2.5px] rounded-xs"
            style={{ height: 26, background: "currentColor" }}
          />
        ))}
        <span
          className="ml-2 w-[2.5px] rounded-xs"
          style={{ height: 26, background: "var(--blue)" }}
        />
      </div>
      <p className="mb-2 font-display text-title" style={{ color: "var(--text)" }}>
        Nothing logged today.
      </p>
      <p className="text-body" style={{ color: "var(--muted)" }}>
        Tap a tile once and the first mark lands on it. Fixed-price tiles log straight
        away; the rest ask how much.
      </p>
    </div>
  );
}

/** What today actually consists of — the receipt for the marks on the tiles. */
function TodaySummary() {
  const { state } = useTally();
  const currency = state.profile.currency;

  const rows = useMemo(() => {
    const today = todayLocalDate();
    return state.expenses
      .filter((e) => !e.deletedAt && e.localDate === today)
      .sort((a, b) => b.totalAmountMinor - a.totalAmountMinor);
  }, [state.expenses]);

  if (!rows.length) return null;

  return (
    <div
      className="mt-6 rounded-card border p-4"
      style={{ background: "var(--surf)", borderColor: "var(--line)" }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
          Today so far
        </h2>
        <Link href="/history" className="tap-target text-meta font-medium">
          All history
        </Link>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="animate-row-in flex items-center gap-3"
            style={{ ["--i" as string]: index }}
          >
            <span style={{ color: "var(--muted)" }}>
              <Icon
                name={
                  state.categories.find((c) => c.slug === row.categorySlug)?.iconKey ?? "bag"
                }
                size={18}
                strokeWidth={1.6}
              />
            </span>
            <span className="min-w-0 flex-1 truncate text-body" style={{ color: "var(--text)" }}>
              {row.name}
              {row.quantity > 1 && (
                <span style={{ color: "var(--muted)" }}> ×{row.quantity}</span>
              )}
            </span>
            <span
              className="font-mono text-body font-medium tabular-nums"
              style={{ color: "var(--text)" }}
            >
              {formatMoney(row.totalAmountMinor, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The part of the screen that used to be blank space.
 *
 * Three numbers, and every one of them is something you'd act on: what you can
 * spend a day from here to make the month, how today compares to a normal day,
 * and whether you're logging consistently enough for either figure to mean
 * anything. Each hides itself until there's enough history to be true.
 */
function TodayStats() {
  const { state } = useTally();
  const currency = state.profile.currency;

  const safe = useMemo(() => safeToSpend(state), [state]);
  const extremes = useMemo(() => dayExtremes(state, 30), [state]);
  const ring = useMemo(() => ringState(state), [state]);

  const hasHistory = extremes.loggedDays >= 3;

  // Nothing worth saying yet — and a card full of zeroes says less than no
  // card at all.
  if (!safe.hasBudget && !hasHistory) return null;

  const todayVsUsual =
    hasHistory && extremes.averageMinor > 0 && ring.spentMinor > 0
      ? Math.round(((ring.spentMinor - extremes.averageMinor) / extremes.averageMinor) * 100)
      : null;

  return (
    <div className="mt-6 flex flex-col gap-2.5">
      {safe.hasBudget && (
        <div
          className="animate-row-in rounded-card border p-4"
          style={{ background: "var(--surf)", borderColor: "var(--line)" }}
        >
          <p className="mb-2 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
            Safe to spend
          </p>

          {safe.isBlown ? (
            <>
              <p className="font-display text-title" style={{ color: "var(--amber-text)" }}>
                {formatMoney(-safe.remainingMinor, currency)} over
              </p>
              <p className="mt-1.5 text-body" style={{ color: "var(--muted)" }}>
                This month&apos;s budget is gone with {safe.daysLeft}{" "}
                {safe.daysLeft === 1 ? "day" : "days"} to go. Anything from here adds to it.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-title" style={{ color: "var(--text)" }}>
                {formatMoney(safe.perDayMinor, currency)}{" "}
                <span className="text-body font-normal" style={{ color: "var(--muted)" }}>
                  a day
                </span>
              </p>
              <p className="mt-1.5 text-body" style={{ color: "var(--muted)" }}>
                {formatMoney(safe.remainingMinor, currency)} left over {safe.daysLeft}{" "}
                {safe.daysLeft === 1 ? "day" : "days"}.{" "}
                {safe.isBehind ? (
                  <>
                    That&apos;s tighter than the{" "}
                    {formatMoney(safe.originalPerDayMinor, currency)} you planned — spending
                    ran ahead earlier in the month.
                  </>
                ) : (
                  <>
                    More than the {formatMoney(safe.originalPerDayMinor, currency)} you
                    planned, because you&apos;re running under.
                  </>
                )}
              </p>
            </>
          )}
        </div>
      )}

      {hasHistory && (
        <div
          className="animate-row-in rounded-card border p-4"
          style={{ background: "var(--surf)", borderColor: "var(--line)", ["--i" as string]: 1 }}
        >
          <p className="mb-2 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
            A normal day
          </p>
          <p className="font-display text-title" style={{ color: "var(--text)" }}>
            {formatMoney(extremes.averageMinor, currency)}
          </p>
          <p className="mt-1.5 text-body" style={{ color: "var(--muted)" }}>
            {todayVsUsual === null ? (
              <>Across {extremes.loggedDays} days you&apos;ve logged in the last month.</>
            ) : todayVsUsual > 12 ? (
              <>
                Today is running {todayVsUsual}% above that.
                {extremes.busiest && ring.spentMinor >= extremes.busiest.totalMinor
                  ? " It's your heaviest day this month."
                  : ""}
              </>
            ) : todayVsUsual < -12 ? (
              <>Today is running {Math.abs(todayVsUsual)}% below that.</>
            ) : (
              <>Today is tracking about normal.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export default TapPad;
