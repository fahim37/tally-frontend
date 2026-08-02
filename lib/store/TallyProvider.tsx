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
import { loadState, saveState, clearState, flushState } from "./persistence";
import { flushExpenses, isOnline } from "./sync";
import { fetchSession, hasSession, signOut as revokeSession } from "../auth";

interface TallyContextValue {
  state: TallyState;
  dispatch: React.Dispatch<TallyAction>;
  /** False until the persisted store has been read, so screens can hold their
   *  first paint rather than flashing seed data over real data. */
  hydrated: boolean;
  pendingCount: number;
  syncNow: () => void;
  resetAll: () => void;
  signOut: () => Promise<void>;
}

/**
 * Two contexts, not one.
 *
 * With a single value memoized on `state`, every dispatch minted a new object
 * and re-rendered all eighteen `useTally()` consumers — on the home screen a
 * single tap re-rendered the shell, the offline banner, every tile with its
 * icon and tally marks, the day's summary and any open sheet. Dispatch and the
 * imperative actions are referentially stable, so components that only ever
 * *write* can subscribe to that half and never re-render at all.
 */
const StateContext = createContext<TallyState | null>(null);

interface ActionsValue {
  dispatch: React.Dispatch<TallyAction>;
  syncNow: () => void;
  resetAll: () => void;
  signOut: () => Promise<void>;
}

const ActionsContext = createContext<ActionsValue | null>(null);

export function TallyProvider({ children }: { children: React.ReactNode }) {
  // Server and first client render both start from the same empty state, so
  // the markup matches; the persisted store is adopted in an effect
  // immediately after.
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const syncing = useRef(false);
  const hydrated = state.hydrated;

  // ── Hydrate ──────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch({ type: "HYDRATE", state: loadState() });
  }, []);

  // ── Restore the session ──────────────────────────────────────────────────
  // The persisted store says who *was* signed in; the API says whether that is
  // still true. Only an actual 401 signs the user out — `fetchSession` returns
  // null for a network failure too, and treating that as a sign-out would
  // eject anyone who opened the app on a dead connection.
  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    if (!hasSession()) {
      // No token at all. If the store still claims a session, it is stale —
      // tokens were cleared out from under it (another tab, manual wipe).
      if (state.profile.signedIn) dispatch({ type: "SIGN_OUT" });
      return;
    }

    void (async () => {
      const user = await fetchSession();
      if (cancelled) return;
      if (user) dispatch({ type: "SIGN_IN", user });
      else if (!hasSession()) dispatch({ type: "SIGN_OUT" });
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately only on hydration: this is a boot-time reconciliation, not
    // a subscription to profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // ── Persist ──────────────────────────────────────────────────────────────
  // Queued on every change once hydrated; `saveState` debounces and writes at
  // idle. Skipping the pre-hydration writes stops the empty initial state from
  // overwriting a real store during that first tick.
  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  // A deferred write means the newest taps live only in memory for up to a
  // second. These are the last events a mobile browser reliably delivers
  // before it may discard the tab.
  useEffect(() => {
    const flushIfHiding = () => {
      if (document.visibilityState === "hidden") flushState();
    };

    window.addEventListener("pagehide", flushState);
    document.addEventListener("visibilitychange", flushIfHiding);
    return () => {
      window.removeEventListener("pagehide", flushState);
      document.removeEventListener("visibilitychange", flushIfHiding);
      flushState();
    };
  }, []);

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
  // The queue is mirrored into a ref so `syncNow` can stay referentially
  // stable — it's handed out through context, and a new identity on every
  // change to the pending list would re-render every consumer that holds it.
  // Written in an effect rather than during render: a ref mutation in the
  // render body is not safe under concurrent rendering, where a render can be
  // thrown away before it ever commits.
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const syncNow = useCallback(async () => {
    const queue = pendingRef.current;
    // Nothing to push, no connection, or no account to push it to — an
    // anonymous queue would 401 on every attempt.
    if (syncing.current || !queue.length || !isOnline() || !hasSession()) return;

    syncing.current = true;
    try {
      const result = await flushExpenses(queue);
      const settled = [...result.synced, ...result.failed];
      if (settled.length) dispatch({ type: "MARK_SYNCED", expenseIds: settled });
    } finally {
      syncing.current = false;
    }
  }, []);

  // Flush when the connection returns and when new work is queued while online.
  useEffect(() => {
    if (!hydrated || !state.online || !pending.length) return;
    const timer = setTimeout(syncNow, 800); // debounce a burst of taps
    return () => clearTimeout(timer);
  }, [hydrated, state.online, pending.length, syncNow]);

  const resetAll = useCallback(() => {
    clearState();
    dispatch({ type: "RESET" });
  }, []);

  const signOut = useCallback(async () => {
    // Revoke first, then wipe. If the order were reversed the refresh token
    // would be gone before we could tell the server to invalidate it, leaving
    // a live session on the server that nobody can reach or revoke.
    await revokeSession();
    clearState();
    dispatch({ type: "SIGN_OUT" });
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

  const actions = useMemo(
    () => ({ dispatch, syncNow, resetAll, signOut }),
    [syncNow, resetAll, signOut]
  );

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </StateContext.Provider>
  );
}

/** Everything. Re-renders on any state change — use the narrower hooks below
 *  in components that only need one half. */
export function useTally(): TallyContextValue {
  const state = useContext(StateContext);
  const actions = useContext(ActionsContext);
  if (!state || !actions) throw new Error("useTally must be used inside <TallyProvider>");

  const pendingCount = state.expenses.reduce((n, e) => (e.pendingSync ? n + 1 : n), 0);

  return {
    state,
    dispatch: actions.dispatch,
    hydrated: state.hydrated,
    pendingCount,
    syncNow: actions.syncNow,
    resetAll: actions.resetAll,
    signOut: actions.signOut,
  };
}

/** For components that only write. Never re-renders. */
export function useTallyActions(): ActionsValue {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error("useTallyActions must be used inside <TallyProvider>");
  return actions;
}

export function useTallyState(): TallyState {
  const state = useContext(StateContext);
  if (!state) throw new Error("useTallyState must be used inside <TallyProvider>");
  return state;
}
