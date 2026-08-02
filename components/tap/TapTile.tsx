"use client";

import { useCallback, useEffect, useRef } from "react";
import { TallyMarks } from "@/components/ui/TallyMarks";
import { formatMoney } from "@/lib/money";
import type { PadTile } from "@/lib/store/selectors";
import { TileArt } from "./TileArt";

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

/** Past this much movement the gesture is a scroll, not a tap. */
const MOVE_CANCEL_PX = 10;

/** The tile's resting shadow. Kept as a constant because `paint()` has to put
 *  it back — restoring "none" is what used to flatten a tile after one press. */
const REST_SHADOW = "0 1px 2px rgba(11,18,32,.05)";

/**
 * A Tap Pad tile.
 *
 * The gesture is the whole product, so it's handled carefully:
 *   - Pointer events (not click) so the press state appears on finger-down.
 *   - A hold past `longPressMs` opens the tile sheet and *cancels* the tap,
 *     so an edit never also logs an expense.
 *   - Moving off the tile cancels both — a scroll that started on a tile must
 *     not log anything.
 *   - The context menu is suppressed, since long-press is our own gesture.
 *
 * It stays a <button> so keyboard and screen-reader users get the tap for
 * free; the long-press equivalent is the amount button in the sheet.
 *
 * The press state is written straight to the node instead of going through
 * React. It is purely visual, and routing it through the scheduler put two
 * re-renders of the tile — icon SVG, tally marks and all — in the same frames
 * as the store commit the tap triggers. Those are exactly the frames that have
 * to feel instant.
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | null>(null);
  const didLongPress = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const active = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const paint = (pressed: boolean) => {
    const node = buttonRef.current;
    if (!node) return;
    node.style.transform = pressed ? `translateY(${pressDepth}px) scale(.982)` : "";
    node.style.borderColor = pressed ? "var(--blue)" : "var(--line)";
    node.style.boxShadow = pressed ? "inset 0 2px 6px rgba(11,18,32,.10)" : REST_SHADOW;
  };

  const start = (event: React.PointerEvent<HTMLButtonElement>) => {
    /**
     * The implicit pointer capture that touch gives us on pointerdown is KEPT,
     * deliberately.
     *
     * It guarantees that `pointerup` comes back to this element no matter what
     * is under the finger when it lifts — including a sheet that has just
     * opened over the tile. Releasing it (which an earlier version did, to try
     * to make `onPointerLeave` cancel the tap) sends `pointerup` to whatever
     * element is actually under the finger instead, so the smallest drift
     * meant `end()` never ran here and the tap was silently dropped.
     *
     * Cancelling on movement is handled properly in `move()` below, by
     * distance from the origin, which works identically for mouse and touch
     * and does not depend on hit-testing at all.
     */
    active.current = true;
    didLongPress.current = false;
    origin.current = { x: event.clientX, y: event.clientY };
    paint(true);

    timer.current = window.setTimeout(() => {
      didLongPress.current = true;
      paint(false);
      // A hold is a deliberate, "I meant something else" gesture — worth a
      // haptic on the devices that offer one.
      navigator.vibrate?.(12);
      onLongPress(tile.id);
    }, longPressMs);
  };

  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!active.current) return;
    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cancel();
  };

  const end = () => {
    if (!active.current) return;
    active.current = false;
    clearTimer();
    paint(false);

    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    onTap(tile.id);
  };

  const cancel = () => {
    active.current = false;
    clearTimer();
    paint(false);
    didLongPress.current = false;
  };

  // A prompt tile has no single price, so showing one would be a claim the app
  // can't stand behind. It shows what it has actually cost today instead.
  const subtitle =
    tile.entry === "prompt"
      ? tile.todayTotalMinor > 0
        ? formatMoney(tile.todayTotalMinor, currency)
        : "Ask each time"
      : formatMoney(tile.amountMinor, currency);

  return (
    <button
      ref={buttonRef}
      type="button"
      data-tap
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={`${tile.name}, ${subtitle}${
        tile.todayCount > 0 ? `, ${tile.todayCount} logged today` : ""
      }`}
      className="relative flex h-34 flex-col items-start justify-between overflow-hidden rounded-tile border p-3 text-left"
      style={{
        background: "var(--surf)",
        borderColor: "var(--line)",
        boxShadow: REST_SHADOW,
        transition:
          "transform var(--dur-instant) cubic-bezier(.3,.7,.4,1), box-shadow var(--dur-instant) ease, border-color var(--dur-instant) ease",
        animation: `tileIn var(--dur-slow) var(--ease-out) ${Math.max(0, 5 - index) * 40}ms both`,
      }}
    >
      <span className="w-full">
        <TileArt iconKey={tile.iconKey} size={46} className="mx-auto -mt-0.5" />

        {/* Two compact rows keep a busy day legible instead of fading the
            marks out at the tile edge. The fixed-height area also keeps every
            tile's name aligned whether it has marks yet or not. */}
        <span
          className="mt-1 flex h-7 w-full items-start overflow-hidden"
          style={{ color: "var(--blue)" }}
        >
          <TallyMarks
            count={tile.todayCount}
            strikeAt={strikeAt}
            height={12}
            animate
            wrap
          />
        </span>
      </span>

      <span className="w-full">
        <span className="block truncate text-body font-medium" style={{ color: "var(--text)" }}>
          {tile.name}
        </span>
        <span
          className={`block truncate text-caption tabular-nums ${
            tile.entry === "prompt" && tile.todayTotalMinor === 0 ? "" : "font-mono"
          }`}
          style={{ color: "var(--muted)" }}
        >
          {subtitle}
        </span>
      </span>
    </button>
  );
}

export default TapTile;
