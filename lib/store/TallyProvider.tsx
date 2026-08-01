"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { reducer, type TallyAction } from "./reducer";
import { createInitialState, type TallyState } from "./state";
import { loadState, saveState, clearState } from "./persistence";
import { flushExpenses, isOnline } from "./sync";

interface TallyContextValue {
  state: TallyState;
  dispatch: React.Dispatch<TallyAction>;
  /** False until the persisted store has been read, so screens can hold their
   *  first paint rather than flashing seed data over real data. */
  hydrated: boolean;
  pendingCount: number;
  syncNow: () => void;
  resetAll: () => void;
}

const TallyContext = createContext<TallyContextValue | null>(null);

export function TallyProvider({ children }: { children: React.ReactNode }) {
  // Server and first client render both start from the seed, so the markup
  // matches; the persisted store is adopted in an effect immediately after.
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const syncing = useRef(false);
  const hydrated = state.hydrated;

  // ── Hydrate ──────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch({ type: "HYDRATE", state: loadState() });
  }, []);

  // ── Persist ──────────────────────────────────────────────────────────────
  // Written on every change once hydrated. Skipping the pre-hydration writes
  // stops the seed from overwriting a real store during that first tick.
  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  // ── Recurring rules ──────────────────────────────────────────────────────
  // Swept once per session on open; `lastRunDate` keeps it idempotent.
  useEffect(() => {
    if (!hydrated) return;
    dispatch({ type: "RUN_DUE_RECURRING" });
  }, [hydrated]);

  // ── Connectivity ─────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => dispatch({ type: "SET_ONLINE", online: isOnline() });
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const pending = useMemo(
    () => state.expenses.filter((e) => e.pendingSync),
    [state.expenses]
  );

  // ── Drain the queue ──────────────────────────────────────────────────────
  const syncNow = useCallback(async () => {
    if (syncing.current || !pending.length || !isOnline()) return;
    syncing.current = true;
    try {
      const result = await flushExpenses(pending);
      const settled = [...result.synced, ...result.failed];
      if (settled.length) dispatch({ type: "MARK_SYNCED", expenseIds: settled });
    } finally {
      syncing.current = false;
    }
  }, [pending]);

  // Flush when the connection returns and when new work is queued while online.
  useEffect(() => {
    if (!hydrated || !state.online || !pending.length) return;
    const timer = setTimeout(syncNow, 800); // debounce a burst of taps
    return () => clearTimeout(timer);
  }, [hydrated, state.online, pending.length, syncNow]);

  const resetAll = useCallback(() => {
    clearState();
    window.location.reload();
  }, []);

  // ── Theme ────────────────────────────────────────────────────────────────
  const appearance = state.profile.appearance;

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const dark =
        appearance === "dark" ||
        (appearance === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.setAttribute("data-theme", dark ? "dark" : "light");
    };

    apply();
    if (appearance !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      hydrated,
      pendingCount: pending.length,
      syncNow,
      resetAll,
    }),
    [state, hydrated, pending.length, syncNow, resetAll]
  );

  return <TallyContext.Provider value={value}>{children}</TallyContext.Provider>;
}

export function useTally() {
  const context = useContext(TallyContext);
  if (!context) throw new Error("useTally must be used inside <TallyProvider>");
  return context;
}
