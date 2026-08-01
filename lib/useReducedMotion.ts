"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

const getSnapshot = () => window.matchMedia(QUERY).matches;

// The server has no media queries; assume motion is fine so the markup matches
// the common case, and let the client correct it on hydration if not.
const getServerSnapshot = () => false;

/**
 * Whether the user has asked for reduced motion, as reactive state.
 *
 * `useSyncExternalStore` is the right tool here rather than an effect: the
 * media query is an external store, and reading it this way means components
 * can branch on it *during render* instead of setting state afterwards.
 */
export const useReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export default useReducedMotion;
