"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import { useToast } from "@/components/ui/Toast";
import { padTiles, recentTiles, ringState, type PadTile } from "@/lib/store/selectors";
import { formatMoney } from "@/lib/money";
import { todayLocalDate } from "@/lib/date";
import { RollingTotal } from "./RollingTotal";
import { BudgetRing } from "./BudgetRing";
import { TapTile } from "./TapTile";
import { TileSheet } from "./TileSheet";
import { NewTileSheet } from "./NewTileSheet";

/**
 * The home screen. Everything above the fold answers two questions — what have
 * I spent today, and how does that sit against the day's allowance — and
 * everything below it is one tap from logging.
 */
export function TapPad() {
  const { state, dispatch } = useTally();
  const { toast } = useToast();

  const [sheetTileId, setSheetTileId] = useState<string | null>(null);
  const [newTileOpen, setNewTileOpen] = useState(false);
  const [pulse, setPulse] = useState(0);

  const currency = state.profile.currency;
  const tiles = useMemo(() => padTiles(state), [state]);
  const recent = useMemo(() => recentTiles(state), [state]);
  const ring = useMemo(() => ringState(state), [state]);

  const sheetTile: PadTile | null = sheetTileId
    ? (tiles.find((tile) => tile.id === sheetTileId) ?? null)
    : null;

  const handleTap = (tileId: string) => {
    const tile = tiles.find((t) => t.id === tileId);
    if (!tile) return;

    dispatch({ type: "TAP_TILE", tileId });
    setPulse((n) => n + 1);
    navigator.vibrate?.(8);

    toast(`${tile.name} logged · ${formatMoney(tile.amountMinor, currency)}`, {
      actionLabel: "Undo",
      onAction: () => dispatch({ type: "UNDO_LAST_TAP" }),
    });
  };

  return (
    <div className="flex flex-col px-5 pb-8">
      {/* Total + ring */}
      <div className="flex items-start justify-between gap-3.5 px-0.5 pb-6 pt-6">
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--muted)" }}
          >
            Spent today
          </p>

          <RollingTotal totalMinor={ring.spentMinor} currency={currency} />

          <p className="mt-2.5 text-[12px]" style={{ color: "var(--muted)" }}>
            {ring.allowanceMinor > 0 ? (
              <>
                <span className="font-mono tabular-nums">
                  {formatMoney(ring.allowanceMinor, currency)}
                </span>{" "}
                a day ·{" "}
                <span
                  className="font-mono tabular-nums"
                  style={{ color: ring.isOver ? "var(--amber)" : "var(--teal)" }}
                >
                  {ring.remainingMinor >= 0
                    ? `${formatMoney(ring.remainingMinor, currency)} left`
                    : `${formatMoney(-ring.remainingMinor, currency)} over`}
                </span>
              </>
            ) : (
              <>Set a monthly budget to see a daily pace.</>
            )}
          </p>
        </div>

        {ring.allowanceMinor > 0 && <BudgetRing ring={ring} pulseKey={pulse} />}
      </div>

      {/* Recently used */}
      {recent.length > 0 && (
        <div className="px-1 pb-3.5">
          <p
            className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--muted)" }}
          >
            Recently used
          </p>
          <div data-scroll className="flex gap-[7px] overflow-x-auto pb-1">
            {recent.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => handleTap(tile.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-pill border py-[7px] pl-[9px] pr-[11px]"
                style={{ background: "var(--sky)", borderColor: "transparent" }}
              >
                <span style={{ color: "var(--blue)" }}>
                  <Icon name={tile.iconKey} size={15} strokeWidth={1.7} />
                </span>
                <span className="text-[12px] font-medium" style={{ color: "var(--text)" }}>
                  {tile.name}
                </span>
                <span
                  className="font-mono text-[11px] font-medium tabular-nums"
                  style={{ color: "var(--blue)" }}
                >
                  ×{tile.todayCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The pad */}
      <div className="grid grid-cols-3 gap-[9px] pb-4">
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
          className="flex h-[104px] flex-col items-center justify-center gap-2 rounded-tile border-[1.5px] border-dashed transition-colors"
          style={{
            // --line is a hairline meant for solid borders on a surface; as a
            // dashed border on the page background it disappears. This needs a
            // step more contrast to read as an affordance.
            borderColor: "color-mix(in srgb, var(--muted) 35%, transparent)",
            color: "var(--muted)",
          }}
        >
          <Icon name="plus" size={21} strokeWidth={1.7} />
          <span className="text-[12px] font-medium">Add tile</span>
        </button>
      </div>

      <p className="px-1 text-[11px] leading-[1.4]" style={{ color: "var(--faint)" }}>
        Long-press a tile to change its amount or quantity.
      </p>

      {/* Before the first tap of the day the screen is otherwise empty, so it
          says what the marks will do rather than showing a blank half-page. */}
      {ring.spentMinor === 0 ? (
        <div
          className="mt-7 rounded-card border p-5"
          style={{ background: "var(--surf)", borderColor: "var(--line)" }}
        >
          <div className="mb-3.5 flex items-center gap-1.5" style={{ color: "var(--line)" }}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-[2.5px] rounded-[2px]"
                style={{ height: 26, background: "currentColor" }}
              />
            ))}
            <span
              className="ml-2 w-[2.5px] rounded-[2px]"
              style={{ height: 26, background: "var(--blue)" }}
            />
          </div>
          <p
            className="mb-1.5 font-display text-[19px] font-semibold leading-[1.2] tracking-[-0.02em]"
            style={{ color: "var(--text)" }}
          >
            Nothing logged today.
          </p>
          <p className="text-[13px] leading-[1.5]" style={{ color: "var(--muted)" }}>
            Tap a tile once and the first mark lands on it. Four marks then a strike-through,
            the way you&apos;d keep score on paper.
          </p>
        </div>
      ) : (
        <TodaySummary />
      )}

      <TileSheet tile={sheetTile} onClose={() => setSheetTileId(null)} />
      <NewTileSheet open={newTileOpen} onClose={() => setNewTileOpen(false)} />
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
      className="mt-7 rounded-card border p-4"
      style={{ background: "var(--surf)", borderColor: "var(--line)" }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--muted)" }}
        >
          Today so far
        </h2>
        <Link href="/history" className="tap-target text-[12px] font-medium">
          All history
        </Link>
      </div>

      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-2.5">
            <span style={{ color: "var(--muted)" }}>
              <Icon
                name={
                  state.categories.find((c) => c.slug === row.categorySlug)?.iconKey ?? "bag"
                }
                size={16}
                strokeWidth={1.6}
              />
            </span>
            <span className="flex-1 text-[13px]" style={{ color: "var(--text)" }}>
              {row.name}
              {row.quantity > 1 && (
                <span style={{ color: "var(--muted)" }}> ×{row.quantity}</span>
              )}
            </span>
            <span
              className="font-mono text-[13px] font-medium tabular-nums"
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

export default TapPad;
