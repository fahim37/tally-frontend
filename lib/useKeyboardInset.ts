"use client";

import { useEffect, useState } from "react";

/**
 * How much of the viewport the soft keyboard is covering.
 *
 * Nothing in this app used to know the keyboard existed. On a phone that meant
 * the bottom nav floated on top of it, and any input inside a bottom sheet —
 * the "type an expense" field, the receipt notes, the tile amount — sat behind
 * it with no way to scroll it into view.
 *
 * `window.innerHeight` does not change when the keyboard opens; the *visual*
 * viewport does. The difference between them is the keyboard.
 *
 * The measurement is published two ways:
 *   - `--kb` on <html>, so CSS can reserve space without a React render
 *   - `data-keyboard="open"`, so chrome can hide itself with a plain selector
 *
 * Both are declared in globals.css. Mount this once, high in the tree.
 */

// Below this, the delta is a URL bar collapsing or a rounding artefact, not a
// keyboard. Real soft keyboards are 250px+.
const KEYBOARD_THRESHOLD = 120;

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    let frame = 0;
    let last = -1;

    const measure = () => {
      frame = 0;

      // offsetTop matters on iOS: when the page scrolls under the keyboard the
      // visual viewport moves down rather than shrinking, and without this the
      // keyboard reads as 0 exactly when it is in the way.
      const covered = Math.max(
        0,
        Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
      );
      const next = covered > KEYBOARD_THRESHOLD ? covered : 0;

      if (next === last) return;
      last = next;

      root.style.setProperty("--kb", `${next}px`);
      if (next > 0) root.setAttribute("data-keyboard", "open");
      else root.removeAttribute("data-keyboard");

      setInset(next);
    };

    // visualViewport fires resize and scroll in bursts as the keyboard slides
    // in; coalescing to one write per frame keeps this off the critical path.
    const onChange = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    viewport.addEventListener("resize", onChange);
    viewport.addEventListener("scroll", onChange);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", onChange);
      viewport.removeEventListener("scroll", onChange);
      root.style.setProperty("--kb", "0px");
      root.removeAttribute("data-keyboard");
    };
  }, []);

  return inset;
}

export default useKeyboardInset;
