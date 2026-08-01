"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { TallyMarks } from "@/components/ui/TallyMarks";
import { formatMoney } from "@/lib/money";
import type { PadTile } from "@/lib/store/selectors";

interface TapTileProps {
  tile: PadTile;
  currency: string;
  strikeAt: number;
  longPressMs: number;
  pressDepth: number;
  index: number;
  onTap: (tileId: string) => void;
  onLongPress: (tileId: string) => void;
}

/**
 * A Tap Pad tile.
 *
 * The gesture is the whole product, so it's handled carefully:
 *   - Pointer events (not click) so the press state appears on finger-down.
 *   - A hold past `longPressMs` opens the amount sheet and *cancels* the tap,
 *     so an edit never also logs an expense.
 *   - Moving off the tile cancels both — a scroll that started on a tile must
 *     not log anything.
 *   - The context menu is suppressed, since long-press is our own gesture.
 *
 * It stays a <button> so keyboard and screen-reader users get the tap for
 * free; the long-press equivalent is the amount button in the sheet.
 */
export function TapTile({
  tile,
  currency,
  strikeAt,
  longPressMs,
  pressDepth,
  index,
  onTap,
  onLongPress,
}: TapTileProps) {
  const [pressed, setPressed] = useState(false);
  const timer = useRef<number | null>(null);
  const didLongPress = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const start = () => {
    didLongPress.current = false;
    setPressed(true);
    timer.current = window.setTimeout(() => {
      didLongPress.current = true;
      setPressed(false);
      // A hold is a deliberate, "I meant something else" gesture — worth a
      // haptic on the devices that offer one.
      navigator.vibrate?.(12);
      onLongPress(tile.id);
    }, longPressMs);
  };

  const end = () => {
    clearTimer();
    setPressed(false);
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    onTap(tile.id);
  };

  const cancel = () => {
    clearTimer();
    setPressed(false);
    didLongPress.current = false;
  };

  return (
    <button
      type="button"
      data-tap
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={`${tile.name}, ${formatMoney(tile.amountMinor, currency)}${
        tile.todayCount > 0 ? `, ${tile.todayCount} logged today` : ""
      }`}
      className="relative flex h-[104px] flex-col items-start justify-between rounded-tile border p-3 text-left"
      style={{
        background: "var(--surf)",
        borderColor: pressed ? "var(--blue)" : "var(--line)",
        transform: pressed ? `translateY(${pressDepth}px) scale(.982)` : "none",
        boxShadow: pressed ? "inset 0 2px 6px rgba(11,18,32,.10)" : "none",
        transition:
          "transform 90ms cubic-bezier(.3,.7,.4,1), box-shadow 90ms ease, border-color 90ms ease",
        animation: `tileIn .38s cubic-bezier(.2,.9,.25,1) ${Math.max(0, 5 - index) * 46}ms both`,
      }}
    >
      <span style={{ color: "var(--blue)" }}>
        <Icon name={tile.iconKey} size={23} strokeWidth={1.6} />
      </span>

      <span className="w-full">
        <span
          className="block text-[13px] font-medium leading-[1.15]"
          style={{ color: "var(--text)" }}
        >
          {tile.name}
        </span>
        <span
          className="mt-1 block font-mono text-[12px] tabular-nums"
          style={{ color: "var(--muted)" }}
        >
          {formatMoney(tile.amountMinor, currency)}
        </span>
      </span>

      <span className="absolute right-[11px] top-[11px]" style={{ color: "var(--blue)" }}>
        <TallyMarks count={tile.todayCount} strikeAt={strikeAt} animate />
      </span>
    </button>
  );
}

export default TapTile;
