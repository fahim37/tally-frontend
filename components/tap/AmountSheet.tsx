"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { formatMoney, getCurrency, minorFactor } from "@/lib/money";
import type { PadTile } from "@/lib/store/selectors";

interface AmountSheetProps {
  tile: PadTile | null;
  currency: string;
  onClose: () => void;
  onConfirm: (amountMinor: number, label: string) => void;
  /** Switch this tile to logging on tap, and log it now at `amountMinor`. */
  onMakeInstant: (amountMinor: number) => void;
}

/**
 * "How much?" for the tiles whose answer changes every time.
 *
 * Two ways in, and they're deliberately not equal. The chips are the fast path
 * and take one press — most food and fare spending clusters on a handful of
 * round numbers, so the right amount is usually already on screen. The keypad
 * is the fallback for everything else.
 *
 * The keypad is drawn in the app rather than being an <input> that summons the
 * OS keyboard. That is not a stylistic choice: the system keyboard covers a
 * bottom sheet, animates the layout while you're aiming at it, and offers a
 * full alphabet for a field that only accepts digits. Owning it means the
 * numbers sit exactly where the thumb already is.
 */
export function AmountSheet({
  tile,
  currency,
  onClose,
  onConfirm,
  onMakeInstant,
}: AmountSheetProps) {
  // Digits as typed, in *major* units — "125" means ৳125, "12.50" means ৳12.50.
  // The tile's saved amount is the starting value, so an amount set from the
  // long-press sheet is ready to log instead of being hidden state. The parent
  // keys this component by tile id, giving every open a fresh starting value.
  const [typed, setTyped] = useState(() => {
    if (!tile || tile.amountMinor <= 0) return "";
    return String(tile.amountMinor / minorFactor(currency));
  });

  /**
   * What it was — "Biryani", "CNG to office". Entirely optional.
   *
   * It sits BELOW the amount and the chips, not above them, and nothing waits
   * on it: tapping a chip logs immediately, with whatever happens to be typed
   * here. That ordering is the whole point — the fast path stays one tap, and
   * this is available to anyone who wants the row to read as something more
   * specific than "Food" later.
   */
  const [label, setLabel] = useState("");

  const symbol = getCurrency(currency).symbol;
  const factor = minorFactor(currency);

  const amountMinor = useMemo(() => {
    if (!typed) return 0;
    const value = Number(typed);
    return Number.isFinite(value) ? Math.round(value * factor) : 0;
  }, [typed, factor]);

  // The long-press sheet owns these values. Keeping this list tied to the tile
  // means adding or removing an offered amount changes this screen immediately.
  const quickAmountsMinor = useMemo(
    () =>
      tile
        ? [...new Set(tile.presetAmountsMinor)]
            .filter((minor) => Number.isFinite(minor) && minor > 0)
            .sort((a, b) => a - b)
        : [],
    [tile]
  );

  if (!tile) return null;

  const press = (key: string) => {
    setTyped((current) => {
      if (key === "back") return current.slice(0, -1);
      if (key === ".") {
        if (current.includes(".")) return current;
        return current === "" ? "0." : `${current}.`;
      }
      // Stop at two decimals — money has no third.
      const [, decimals] = current.split(".");
      if (decimals !== undefined && decimals.length >= 2) return current;
      // No runaway leading zeroes, but "0.x" still has to be reachable.
      if (current === "0") return key;
      if (current.replace(".", "").length >= 9) return current;
      return current + key;
    });
  };

  const confirm = (minor: number) => {
    if (minor <= 0) return;
    onConfirm(minor, label);
    onClose();
  };

  const display = typed === "" ? "0" : typed;

  return (
    <Sheet open onClose={onClose} label={`How much for ${tile.name}?`}>
      <div className="flex items-center gap-3 pb-5">
        <span
          className="flex size-11 items-center justify-center rounded-card"
          style={{ background: "var(--sky)", color: "var(--blue)" }}
        >
          <Icon name={tile.iconKey} size={22} strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          <p className="text-subhead" style={{ color: "var(--text)" }}>
            {tile.name}
          </p>
          <p className="text-meta" style={{ color: "var(--muted)" }}>
            {tile.todayCount > 0
              ? `${tile.todayCount} logged today`
              : "Nothing logged today yet"}
          </p>
        </div>
      </div>

      {/* The running figure. Big, because it's the one thing being decided. */}
      <div
        className="mb-5 flex items-baseline justify-center gap-1 rounded-tile py-6"
        style={{ background: "var(--bg)" }}
        aria-live="polite"
        aria-label={`Amount ${formatMoney(amountMinor, currency)}`}
      >
        <span className="font-display text-title" style={{ color: "var(--muted)" }}>
          {symbol}
        </span>
        <span
          className="font-display text-hero tabular-nums"
          style={{ color: amountMinor > 0 ? "var(--text)" : "var(--faint)" }}
        >
          {display}
        </span>
      </div>

      {quickAmountsMinor.length > 0 && (
        <>
          <p className="mb-2 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
            Quick amounts
          </p>
          <div data-scroll className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
            {quickAmountsMinor.map((minor) => (
              <button
                key={minor}
                type="button"
                onClick={() => confirm(minor)}
                className="shrink-0 rounded-pill px-3.5 py-2.5 font-mono text-body font-medium tabular-nums transition-transform active:scale-95"
                style={{ background: "var(--sky)", color: "var(--blue)" }}
              >
                {formatMoney(minor, currency)}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === "back" ? "Delete" : key}
            className="flex h-14 items-center justify-center rounded-card font-mono text-title tabular-nums transition-colors active:opacity-70"
            style={{
              background: key === "back" ? "transparent" : "var(--bg)",
              color: "var(--text)",
            }}
          >
            {key === "back" ? (
              <Icon name="minus" size={22} strokeWidth={2} />
            ) : (
              key
            )}
          </button>
        ))}
      </div>

      {/* Below the keypad on purpose: reaching the numbers must never mean
          scrolling past a field most logs won't use. */}
      <input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder={`What ${tile.name.toLowerCase()}? (optional)`}
        aria-label={`What ${tile.name.toLowerCase()}, optional`}
        maxLength={40}
        enterKeyHint="done"
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="mt-4 w-full rounded-card border px-4 py-3 text-label outline-none transition-colors"
        style={{
          background: "var(--bg)",
          borderColor: label ? "var(--blue)" : "var(--line)",
          color: "var(--text)",
        }}
      />

      <button
        type="button"
        onClick={() => confirm(amountMinor)}
        disabled={amountMinor <= 0}
        className="mt-3 w-full rounded-card py-4 text-label font-semibold transition-all duration-[--dur-fast] active:scale-[0.99] disabled:opacity-40"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        {amountMinor > 0
          ? `Log ${label.trim() || tile.name.toLowerCase()} · ${formatMoney(amountMinor, currency)}`
          : "Enter an amount"}
      </button>

      {/* The way out.
          Being asked "how much?" for something that costs the same every time
          is pure friction, and the setting that causes it lives behind a
          long-press — so the fix is offered at the exact moment it's wanted,
          rather than making someone go and find it. */}
      <button
        type="button"
        onClick={() => {
          const value = amountMinor > 0 ? amountMinor : tile.amountMinor;
          onMakeInstant(value);
          onClose();
        }}
        className="mt-3 w-full py-2 text-body font-medium"
        style={{ color: "var(--muted)" }}
      >
        Always {formatMoney(amountMinor > 0 ? amountMinor : tile.amountMinor, currency)}?{" "}
        <span style={{ color: "var(--blue)" }}>Log it on tap instead</span>
      </button>
    </Sheet>
  );
}

export default AmountSheet;
