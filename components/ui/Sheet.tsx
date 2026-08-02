"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "@/lib/useReducedMotion";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Announced to screen readers as the sheet's name. */
  label: string;
}

/**
 * A bottom sheet — the app's one modal surface.
 *
 * Handles the things a modal has to get right and screens shouldn't have to
 * repeat: Escape closes it, focus moves in and returns to where it was, the
 * page behind it doesn't scroll, focus can't tab out into the frozen page —
 * and, the part that makes it feel native rather than like a div that
 * appeared, it follows your thumb.
 *
 * Three details do most of that work:
 *
 *  1. **The drag never touches React.** Pointer moves write `style.transform`
 *     on the node directly. A `setState` per move would re-render the entire
 *     sheet contents 120 times a second on a high-sample-rate touchscreen,
 *     which is exactly the stutter that makes a hand-rolled drawer feel worse
 *     than a real one.
 *  2. **A drag only starts when the content is already scrolled to the top.**
 *     Otherwise a downward swipe inside a long sheet has two possible meanings
 *     and picks the wrong one.
 *  3. **It closes on velocity, not just distance.** A quick flick should
 *     dismiss even if it only travelled 40px, because that is what the gesture
 *     meant.
 */

// Past this, release closes. Below it, the sheet springs back.
const CLOSE_DISTANCE_RATIO = 0.35;
// px per ms. A flick faster than this closes regardless of distance.
const CLOSE_VELOCITY = 0.5;
// Upward drag is resisted rather than blocked — a hard stop feels broken.
const RUBBER_BAND = 0.35;
// Downward travel before a press counts as a drag rather than a tap. Low
// enough to feel immediate, high enough that pressing a keypad key doesn't
// start dragging the sheet out from under the finger.
const DRAG_THRESHOLD_PX = 8;

export function Sheet({ open, onClose, children, label }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLButtonElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  /** Set only when a press actually began on the scrim — see its handlers. */
  const scrimArmed = useRef(false);
  const reducedMotion = useReducedMotion();

  // Kept mounted through the close animation, then torn down on animationend.
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);


  // Callers pass a fresh arrow function on every render. Holding it in a ref
  // keeps the modal effect below from tearing down and re-running — including
  // its focus trap and scroll lock — every time the parent re-renders.
  // Synced in an effect, not during render: mutating a ref in the render body
  // is unsafe under concurrent rendering, where a render can be discarded
  // before it commits.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (reducedMotion) {
      onCloseRef.current();
      return;
    }
    setClosing(true);
  }, [reducedMotion]);

  // Mirrors `open` into the mount/exit states. Done by adjusting state during
  // render rather than in an effect — an effect would paint one frame of the
  // wrong state and then correct it, which on a sheet is a visible flash.
  // https://react.dev/learn/you-might-not-need-an-effect
  const [lastOpen, setLastOpen] = useState(open);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setRendered(true);
      setClosing(false);
    } else if (rendered) {
      // Closed from outside (a route change, a successful submit) rather than
      // by the gesture. Under reduced motion there is no exit to play, so it
      // goes straight away.
      if (reducedMotion) setRendered(false);
      else setClosing(true);
    }
  }

  // ── Modal behaviour ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!rendered) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    // Lock the page behind the sheet. `overflow: hidden` alone loses the
    // scroll position on iOS, which drops the user at the top of the page when
    // the sheet closes.
    const { scrollY } = window;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

    // Move focus into the sheet so a keyboard user isn't left behind it. The
    // scrim is a focusable button and is skipped — landing on "Close" is a
    // hostile first stop.
    const timer = window.setTimeout(() => {
      const items = focusables().filter((el) => el !== scrimRef.current);
      items[0]?.focus();
    }, 60);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];

      // Wrap at both ends rather than letting focus escape to the page.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);

      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);

      restoreFocusTo.current?.focus?.();
    };
  }, [rendered, requestClose]);

  // ── Drag ─────────────────────────────────────────────────────────────────
  const drag = useRef({
    /** Pressed somewhere draggable, but intent not yet established. */
    armed: false,
    /** Past the threshold — the sheet is following the finger. */
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastY: 0,
    lastT: 0,
    velocity: 0,
    offset: 0,
  });

  const paint = (offset: number) => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transform = `translate3d(0, ${offset}px, 0)`;

    // The scrim fades with the drag, so the page behind reappears as you pull
    // down — the feedback that tells you the gesture is working before you've
    // committed to it.
    const scrim = scrimRef.current;
    if (scrim) {
      const height = panel.offsetHeight || 1;
      scrim.style.opacity = String(Math.max(0, 1 - offset / height));
    }
  };

  const endDrag = (commit: boolean) => {
    const panel = panelRef.current;
    const state = drag.current;

    // Armed but never passed the threshold — this was a tap or a scroll, and
    // there is nothing to spring back.
    if (!panel || (!state.active && !state.armed)) return;

    const wasActive = state.active;
    state.armed = false;
    state.active = false;

    // Native scrolling and the panel's own touch-action are handed back.
    const scroller = scrollRef.current;
    if (scroller) scroller.style.overflowY = "";
    panel.style.touchAction = "";
    panel.style.willChange = "";
    panel.style.transition = "";

    if (!wasActive) return;

    const height = panel.offsetHeight || 1;
    const farEnough = state.offset > height * CLOSE_DISTANCE_RATIO;
    const fastEnough = state.velocity > CLOSE_VELOCITY;

    if (commit && (farEnough || fastEnough)) {
      requestClose();
      return;
    }

    // Spring back. Transition rather than animation so an interrupted spring
    // (a second grab mid-flight) picks up from where it actually is.
    panel.style.transition = `transform var(--dur-base) var(--ease-drawer)`;
    paint(0);
    const scrim = scrimRef.current;
    if (scrim) {
      scrim.style.transition = "opacity var(--dur-base) var(--ease-drawer)";
      scrim.style.opacity = "1";
    }
    state.offset = 0;
  };

  /**
   * Arms on any press inside the sheet. The drag itself doesn't begin until
   * `onPointerMove` sees a clear downward intent — until then this could just
   * as easily be a tap on a button or the start of a scroll, and committing
   * early would break both.
   */
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || event.pointerType === "mouse") return;

    // A drag that starts mid-scroll is a scroll. Only consider the gesture
    // when the content has nowhere further up to go.
    const scroller = scrollRef.current;
    if (scroller && scroller.scrollTop > 0) return;

    drag.current = {
      armed: true,
      active: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      offset: 0,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state.armed || event.pointerId !== state.pointerId) return;

    const dy = event.clientY - state.startY;
    const dx = event.clientX - state.startX;

    if (!state.active) {
      // Sideways, or upward — not ours. A horizontal swipe belongs to the chip
      // rails inside the sheet, and an upward drag at scrollTop 0 means the
      // content is about to scroll.
      if (Math.abs(dx) > Math.abs(dy)) {
        state.armed = false;
        return;
      }
      if (dy < DRAG_THRESHOLD_PX) return;

      // Committed. Freeze native scrolling for the rest of the gesture so the
      // browser and this handler aren't both moving something at once.
      const panel = panelRef.current;
      if (!panel) return;
      state.active = true;
      state.startY = event.clientY; // rebase, so the sheet doesn't jump by the threshold

      const scroller = scrollRef.current;
      if (scroller) scroller.style.overflowY = "hidden";
      panel.style.touchAction = "none";
      panel.style.transition = "none";
      panel.style.willChange = "transform";
      const scrim = scrimRef.current;
      if (scrim) scrim.style.transition = "none";
    }

    const delta = event.clientY - state.startY;
    // Dragging up past the top is resisted, not stopped.
    const offset = delta >= 0 ? delta : delta * RUBBER_BAND;

    const dt = event.timeStamp - state.lastT;
    if (dt > 0) {
      state.velocity = (event.clientY - state.lastY) / dt;
      state.lastY = event.clientY;
      state.lastT = event.timeStamp;
    }

    state.offset = offset;
    paint(offset);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== drag.current.pointerId) return;
    endDrag(true);
  };

  const onPointerCancel = () => endDrag(false);

  // ── Teardown ─────────────────────────────────────────────────────────────
  const onAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== panelRef.current || !closing) return;
    setRendered(false);
    setClosing(false);
    // When the gesture closed it, the parent still thinks it is open.
    if (open) onCloseRef.current();
  };

  // The portal target only exists in the browser. Nothing here can open before
  // hydration — every sheet's `open` starts false and is flipped by a tap —
  // so a plain environment check is enough, and avoids the extra render an
  // effect-driven "mounted" flag would cost on every sheet.
  if (!rendered || typeof document === "undefined") return null;

  /**
   * Rendered into <body>, not in place.
   *
   * Sheets are opened from deep inside the page — the Tap Pad, a history row —
   * and `position: fixed` is only relative to the viewport if no ancestor has
   * a transform, filter or containment. `<main>` carries the route-change
   * animation, and an animated transform creates a containing block plus its
   * own stacking context. In place, that meant two visible bugs at once: the
   * sheet was confined to the height of `<main>` instead of the viewport (so
   * it never opened fully), and it was trapped under the bottom nav's z-index
   * no matter how high its own went.
   *
   * A portal takes it out of that ancestry entirely, which is the only real
   * fix — bumping z-index cannot escape a stacking context.
   */
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Closing requires the press to have STARTED on the scrim.
          The gesture that opens a sheet ends with the finger wherever the
          scrim now is, so a bare onClick would let the opening tap fall
          straight through and dismiss it again. It also stops a drag that
          begins inside the panel and finishes over the scrim from counting as
          a dismiss. */}
      {/* Pointer-only, and out of the focus order: with the arming rule above,
          a keyboard Enter on it would no longer close anything. Escape is the
          keyboard path, and `aria-modal` already tells a screen reader the
          page behind is inert. */}
      <button
        ref={scrimRef}
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onPointerDown={() => {
          scrimArmed.current = true;
        }}
        onClick={() => {
          if (!scrimArmed.current) return;
          scrimArmed.current = false;
          requestClose();
        }}
        className="absolute inset-0 h-full w-full cursor-default"
        style={{
          background: "var(--scrim)",
          animation: closing
            ? "fadeOut var(--dur-base) var(--ease-drawer) both"
            : "fadeIn var(--dur-fast) ease both",
        }}
      />
      {/* The drag listens on the whole panel, not just the handle.
          A 24px grab strip is a target you have to aim at; on a phone the
          gesture people actually make is "push the sheet down" from wherever
          their thumb already is. The handlers are safe here because they only
          commit once the movement is clearly downward AND the content is
          already scrolled to the top — see onPointerMove. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onAnimationEnd={onAnimationEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="relative flex w-full max-w-[520px] flex-col"
        style={{
          background: "var(--surf)",
          borderRadius: "22px 22px 0 0",
          boxShadow: "var(--lift-sheet)",
          animation: closing
            ? "sheetDown var(--dur-base) var(--ease-drawer) both"
            : "sheetUp var(--dur-slow) var(--ease-drawer) both",
          // Capped against the *visual* viewport so an open keyboard shrinks
          // the sheet rather than pushing its actions off-screen.
          maxHeight: "calc(92dvh - var(--kb))",
        }}
      >
        {/* Now purely the affordance — it says "this can be pulled down" while
            the panel above handles the gesture from anywhere. */}
        <div
          className="shrink-0 cursor-grab touch-none pt-3 pb-2 active:cursor-grabbing"
          style={{ background: "var(--surf)", borderRadius: "22px 22px 0 0" }}
        >
          <span
            className="mx-auto block h-1 w-10 rounded-pill"
            style={{ background: "var(--line)" }}
          />
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-5"
          style={{
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            // The safe-area inset is owned here and only here — it used to be
            // applied on body, the nav, the toast AND the sheet at once.
            paddingBottom: "calc(24px + var(--safe-b) + var(--kb))",
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Sheet;
