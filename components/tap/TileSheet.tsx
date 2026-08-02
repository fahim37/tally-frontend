"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import { formatMoney, toMinor } from "@/lib/money";
import { todayLocalDate } from "@/lib/date";
import type { PadTile } from "@/lib/store/selectors";
import { ExpenseEditSheet } from "@/components/history/ExpenseEditSheet";
import { TileArt } from "./TileArt";

interface TileSheetProps {
  tile: PadTile | null;
  onClose: () => void;
}

/**
 * The long-press sheet: change what a tile costs, or correct how many times
 * a fixed-price tile was logged today. Variable-price tiles expose each of
 * today's entries separately because Lunch and Dinner can have different
 * labels and amounts.
 *
 * Both edits are immediate — there is no save step, so "Done" only dismisses.
 * That matches the tap-to-log model: nothing in this app waits for a commit.
 */
export function TileSheet({ tile, onClose }: TileSheetProps) {
  const { state, dispatch } = useTally();
  const [customAmount, setCustomAmount] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const currency = state.profile.currency;

  if (!tile) return null;

  const today = todayLocalDate();
  const categoryTiles = state.tiles.filter(
    (candidate) => !candidate.isArchived && candidate.categorySlug === tile.categorySlug
  );
  const ownsLegacyOrphans = categoryTiles.length === 1 && categoryTiles[0].id === tile.id;
  const todayEntries = state.expenses
    .filter(
      (expense) =>
        !expense.deletedAt &&
        expense.localDate === today &&
        (expense.tileId === tile.id ||
          (!expense.tileId &&
            expense.source === "tap" &&
            ownsLegacyOrphans &&
            expense.categorySlug === tile.categorySlug))
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const editingExpense = editingExpenseId
    ? (todayEntries.find((expense) => expense.id === editingExpenseId) ?? null)
    : null;

  if (editingExpense) {
    return (
      <ExpenseEditSheet
        expense={editingExpense}
        onClose={() => setEditingExpenseId(null)}
        allowDelete
      />
    );
  }

  const setAmount = (amountMinor: number) => {
    dispatch({ type: "SET_TILE_AMOUNT", tileId: tile.id, amountMinor });
    setCustomAmount("");
  };

  const setQuantity = (quantity: number) =>
    dispatch({
      type: "SET_QUANTITY",
      tileId: tile.id,
      localDate: todayLocalDate(),
      quantity: Math.max(0, quantity),
    });

  const applyCustom = () => {
    const minor = toMinor(customAmount, currency);
    if (minor && minor > 0) setAmount(minor);
  };

  return (
    <Sheet open onClose={onClose} label={`Edit ${tile.name}`}>
      <div className="mb-5 flex items-center gap-3">
        <span
          className="flex size-12 shrink-0 items-center justify-center"
        >
          <TileArt iconKey={tile.iconKey} size={44} />
        </span>
        <div>
          <p className="text-subhead" style={{ color: "var(--text)" }}>
            {tile.name}
          </p>
          <p className="text-meta leading-tight" style={{ color: "var(--muted)" }}>
            Logged {tile.todayCount} {tile.todayCount === 1 ? "time" : "times"} today
          </p>
        </div>
      </div>

      {/* How it logs. The single most consequential thing about a tile, and
          the one people get wrong when they create it — so it's changeable
          here rather than only at creation. */}
      <p className="mb-2.5 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
        When you tap it
      </p>
      <div className="mb-5 flex gap-2">
        {(
          [
            ["instant", "Log straight away"],
            ["prompt", "Ask how much"],
          ] as const
        ).map(([mode, label]) => {
          const active = tile.entry === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => dispatch({ type: "UPDATE_TILE", tileId: tile.id, patch: { entry: mode } })}
              aria-pressed={active}
              className="flex-1 rounded-card py-3 text-body font-medium transition-colors"
              style={{
                background: active ? "var(--sky)" : "var(--bg)",
                // Constant border width — switching between 1 and 1.5px
                // relayouts the row and makes both options twitch.
                border: `1.5px solid ${active ? "var(--blue)" : "transparent"}`,
                color: active ? "var(--blue)" : "var(--muted)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="mb-2.5 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
        {tile.entry === "prompt" ? "Amounts offered" : "Amount"}
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {tile.presetAmountsMinor.map((preset) => {
          const active = preset === tile.amountMinor;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset)}
              aria-pressed={active}
              className="min-w-18 flex-1 rounded-card border py-3.5 font-mono text-label font-medium tabular-nums"
              style={{
                // On a prompt tile these are a menu, not a current value —
                // highlighting one as "selected" would misrepresent what the
                // tile does.
                background: active && tile.entry === "instant" ? "var(--sky)" : "transparent",
                borderColor: active && tile.entry === "instant" ? "var(--blue)" : "var(--line)",
                color: active && tile.entry === "instant" ? "var(--blue)" : "var(--text)",
              }}
            >
              {formatMoney(preset, currency, { withSymbol: false })}
            </button>
          );
        })}
      </div>

      <div
        className="mb-5 flex items-center gap-2 rounded-card border px-3.5 py-3"
        style={{ borderColor: "var(--line)" }}
      >
        <input
          value={customAmount}
          onChange={(event) => setCustomAmount(event.target.value)}
          onBlur={applyCustom}
          onKeyDown={(event) => event.key === "Enter" && applyCustom()}
          placeholder="Something else"
          inputMode="decimal"
          aria-label="Custom amount"
          className="min-w-0 flex-1 bg-transparent font-mono text-label tabular-nums outline-none"
          style={{ color: "var(--text)" }}
        />
        {customAmount && (
          <button
            type="button"
            onClick={applyCustom}
            className="text-body font-semibold"
            style={{ color: "var(--blue)" }}
          >
            Set
          </button>
        )}
      </div>

      {tile.entry === "prompt" ? (
        <>
          <p className="mb-2.5 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
            Today&apos;s entries
          </p>
          {todayEntries.length > 0 ? (
            <div data-scroll className="mb-5 flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
              {todayEntries.map((expense) => (
                <button
                  key={expense.id}
                  type="button"
                  onClick={() => setEditingExpenseId(expense.id)}
                  className="flex items-center gap-3 rounded-card border px-3.5 py-3 text-left"
                  style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium" style={{ color: "var(--text)" }}>
                      {expense.name}
                    </span>
                    <span className="mt-0.5 block text-caption" style={{ color: "var(--muted)" }}>
                      {expense.quantity > 1 ? `Quantity ${expense.quantity}` : "Tap to edit"}
                    </span>
                  </span>
                  <span className="font-mono text-body font-medium" style={{ color: "var(--text)" }}>
                    {formatMoney(expense.totalAmountMinor, currency)}
                  </span>
                  <span style={{ color: "var(--blue)" }}>
                    <Icon name="edit" size={17} strokeWidth={1.8} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mb-5 text-body" style={{ color: "var(--faint)" }}>
              Nothing logged from this tile today.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mb-2.5 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
            Quantity today
          </p>
          <div
            className="mb-5 flex items-center justify-between rounded-card border px-2.5 py-2"
            style={{ borderColor: "var(--line)" }}
          >
            <button
              type="button"
              onClick={() => setQuantity(tile.todayCount - 1)}
              disabled={tile.todayCount === 0}
              aria-label="One fewer"
              className="flex size-10 items-center justify-center rounded-card disabled:opacity-35"
              style={{ background: "var(--bg)" }}
            >
              <Icon name="minus" size={18} strokeWidth={2} />
            </button>
            <span
              aria-live="polite"
              className="font-display text-display tabular-nums"
              style={{ color: "var(--text)" }}
            >
              {tile.todayCount}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(tile.todayCount + 1)}
              aria-label="One more"
              className="flex size-10 items-center justify-center rounded-card"
              style={{ background: "var(--bg)" }}
            >
              <Icon name="plus" size={18} strokeWidth={2} />
            </button>
          </div>
          <p className="mb-4 text-meta leading-[1.45]" style={{ color: "var(--faint)" }}>
            Changing the amount updates today&apos;s entries for this tile. Earlier days keep
            what they were logged at.
          </p>
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-card py-4 text-label font-semibold"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        Done
      </button>
    </Sheet>
  );
}

export default TileSheet;
