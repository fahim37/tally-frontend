"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import { useToast } from "@/components/ui/Toast";
import { padTiles } from "@/lib/store/selectors";
import { formatMoney, toMinor } from "@/lib/money";
import { parseExpenseText, parsedTotalMinor } from "@/lib/parse";
import { todayLocalDate, toLocalMonth } from "@/lib/date";
import { ScanTab } from "./ScanTab";

type Tab = "tap" | "type" | "scan";

interface AddDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The three ways to add an expense. Tap is first and default — the other two
 * exist for the cases a tile can't cover, not as the main road.
 */
export function AddDrawer({ open, onClose }: AddDrawerProps) {
  const [tab, setTab] = useState<Tab>("tap");

  return (
    <Sheet open={open} onClose={onClose} label="Add an expense">
      <div
        className="mb-5 flex rounded-[12px] p-[3px]"
        style={{ background: "var(--bg)" }}
        role="tablist"
        aria-label="How to add"
      >
        {(["tap", "type", "scan"] as Tab[]).map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className="flex-1 rounded-[9px] py-2.5 text-[13px] font-medium capitalize transition-colors"
              style={{
                background: active ? "var(--surf)" : "transparent",
                color: active ? "var(--text)" : "var(--muted)",
                boxShadow: active ? "0 1px 3px rgba(11,18,32,.14)" : "none",
              }}
            >
              {key}
            </button>
          );
        })}
      </div>

      {tab === "tap" && <TapTab onClose={onClose} />}
      {tab === "type" && <TypeTab onClose={onClose} />}
      {tab === "scan" && <ScanTab onClose={onClose} />}
    </Sheet>
  );
}

// ── Tap ────────────────────────────────────────────────────────────────────

function TapTab({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useTally();
  const { toast } = useToast();
  const tiles = useMemo(() => padTiles(state), [state]);

  const log = (tileId: string, name: string, amountMinor: number) => {
    dispatch({ type: "TAP_TILE", tileId });
    toast(`${name} logged · ${formatMoney(amountMinor, state.profile.currency)}`, {
      actionLabel: "Undo",
      onAction: () => dispatch({ type: "UNDO_LAST_TAP" }),
    });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--muted)" }}
        >
          Pick one
        </span>
        <span className="text-[11px]" style={{ color: "var(--faint)" }}>
          Logs on tap, no confirm
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => log(tile.id, tile.name, tile.amountMinor)}
            className="flex h-[88px] flex-col items-start justify-between rounded-[16px] border p-2.5 text-left transition-colors"
            style={{ background: "var(--bg)", borderColor: "var(--line)" }}
          >
            <span style={{ color: "var(--blue)" }}>
              <Icon name={tile.iconKey} size={20} strokeWidth={1.6} />
            </span>
            <span className="w-full">
              <span
                className="block text-[12px] font-medium leading-tight"
                style={{ color: "var(--text)" }}
              >
                {tile.name}
              </span>
              <span
                className="mt-[3px] block font-mono text-[11px] tabular-nums"
                style={{ color: "var(--muted)" }}
              >
                {formatMoney(tile.amountMinor, state.profile.currency)}
              </span>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full rounded-[14px] py-4 text-[15px] font-semibold"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        Done
      </button>
    </div>
  );
}

// ── Type ───────────────────────────────────────────────────────────────────

function TypeTab({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useTally();
  const { toast } = useToast();
  const [text, setText] = useState("");

  const currency = state.profile.currency;

  // Parsed locally on every keystroke, so this works with no connection.
  const items = useMemo(
    () => parseExpenseText(text, state.categories, currency),
    [text, state.categories, currency]
  );
  const total = parsedTotalMinor(items);
  const loggable = items.filter((item) => item.amountMinor !== null);

  const commit = () => {
    if (!loggable.length) return;

    const now = new Date();
    dispatch({
      type: "ADD_EXPENSES",
      expenses: loggable.map((item) => ({
        tileId: null,
        categorySlug: item.categorySlug,
        name: item.name,
        unitAmountMinor: item.amountMinor as number,
        quantity: item.quantity,
        totalAmountMinor: 0,
        occurredAt: now.toISOString(),
        localDate: todayLocalDate(),
        localMonth: toLocalMonth(now),
        source: "parsed" as const,
      })),
    });

    toast(
      `${loggable.length} expense${loggable.length > 1 ? "s" : ""} logged · ${formatMoney(total, currency)}`
    );
    setText("");
    onClose();
  };

  return (
    <div>
      <label
        className="mb-2.5 block text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--muted)" }}
        htmlFor="type-input"
      >
        Write it how you&apos;d say it
      </label>

      <input
        id="type-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="lunch 250 and 40 rickshaw"
        autoComplete="off"
        className="w-full rounded-[14px] border px-3.5 py-4 text-[15px] outline-none"
        style={{
          background: "var(--surf)",
          borderColor: text ? "var(--blue)" : "var(--line)",
          color: "var(--text)",
        }}
      />

      <div className="mb-2.5 mt-5 flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--muted)" }}
        >
          Parsed
        </span>
        <span className="font-mono text-[12px] tabular-nums" style={{ color: "var(--text)" }}>
          {formatMoney(total, currency)}
        </span>
      </div>

      <div className="flex min-h-[120px] flex-col gap-2">
        {items.length === 0 && (
          <p className="py-6 text-center text-[13px]" style={{ color: "var(--faint)" }}>
            Type an amount and what it was for.
          </p>
        )}

        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-3 rounded-[14px] border p-3"
            style={{ background: "var(--bg)", borderColor: "var(--line)" }}
          >
            <span
              className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px]"
              style={{ background: "var(--sky)", color: "var(--blue)" }}
            >
              <Icon name={item.iconKey} size={18} strokeWidth={1.6} />
            </span>

            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-[13px] font-medium"
                style={{ color: "var(--text)" }}
              >
                {item.name}
                {item.quantity > 1 && ` ×${item.quantity}`}
              </span>
              <span className="block text-[11px]" style={{ color: "var(--muted)" }}>
                {item.categoryName}
                {!item.matched && " · tap to change"}
              </span>
            </span>

            <span
              className="font-mono text-[14px] tabular-nums"
              style={{ color: item.amountMinor === null ? "var(--faint)" : "var(--text)" }}
            >
              {item.amountMinor === null
                ? "—"
                : formatMoney(item.amountMinor * item.quantity, currency)}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={commit}
        disabled={!loggable.length}
        className="mt-4 w-full rounded-[14px] py-4 text-[15px] font-semibold transition-opacity disabled:opacity-40"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        {loggable.length > 1 ? `Log ${loggable.length} expenses` : "Log expense"}
      </button>
    </div>
  );
}

export { toMinor };
export default AddDrawer;
