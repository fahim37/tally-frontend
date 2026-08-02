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
import {
  clearState,
  flushState,
  loadAccountSyncFingerprints,
  loadState,
  markFullResyncComplete,
  needsFullResync,
  saveAccountSyncFingerprints,
  saveState,
} from "./persistence";
import {
  ACCOUNT_SECTION_NAMES,
  fetchAccountState,
  fetchExpenses,
  fingerprintAccountSections,
  fingerprintExpenseForSync,
  flushAccountSections,
  flushExpenses,
  isOnline,
  toAccountSections,
} from "./sync";
import { fetchSession, hasSession, signOut as revokeSession } from "../auth";
import type { AccountSections } from "./state";

const DEFAULT_ACCOUNT_FINGERPRINTS = fingerprintAccountSections(
  toAccountSections(createInitialState())
);

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
  const accountSyncing = useRef(false);
  const accountReadyUser = useRef<string | null>(null);
  const pulling = useRef(false);
  const syncAccountNowRef = useRef<() => void>(() => undefined);
  const syncNowRef = useRef<() => void>(() => undefined);
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

  // One-time repair for production builds that cleared pending flags after the
  // not-yet-mounted sync route returned 404. Replaying is idempotent by local
  // expense id, so this also remains safe for rows synced elsewhere already.
  useEffect(() => {
    const userId = state.profile.userId;
    if (!hydrated || !needsFullResync(userId)) return;

    if (state.expenses.length === 0) {
      markFullResyncComplete(userId);
      return;
    }

    dispatch({ type: "QUEUE_ALL_EXPENSES" });
    // This is a per-account migration, not a response to expense mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, state.profile.userId]);

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
  const pendingFingerprint = useMemo(
    () => pending.map(fingerprintExpenseForSync).join("\u001f"),
    [pending]
  );

  const accountSections = useMemo(() => toAccountSections(state), [state]);
  const accountFingerprints = useMemo(
    () => fingerprintAccountSections(accountSections),
    [accountSections]
  );
  const accountFingerprintKey = ACCOUNT_SECTION_NAMES.map(
    (name) => accountFingerprints[name]
  ).join("\u001f");

  // ── Drain the queue ──────────────────────────────────────────────────────
  // The queue is mirrored into a ref so `syncNow` can stay referentially
  // stable — it's handed out through context, and a new identity on every
  // change to the pending list would re-render every consumer that holds it.
  // Written in an effect rather than during render: a ref mutation in the
  // render body is not safe under concurrent rendering, where a render can be
  // thrown away before it ever commits.
  const pendingRef = useRef(pending);
  const userIdRef = useRef(state.profile.userId);
  const accountSectionsRef = useRef(accountSections);
  const accountFingerprintsRef = useRef(accountFingerprints);
  useEffect(() => {
    pendingRef.current = pending;
    userIdRef.current = state.profile.userId;
    accountSectionsRef.current = accountSections;
    accountFingerprintsRef.current = accountFingerprints;

    if (accountReadyUser.current && accountReadyUser.current !== state.profile.userId) {
      accountReadyUser.current = null;
    }
  }, [pending, state.profile.userId, accountSections, accountFingerprints]);

  const syncAccountNow = useCallback(async () => {
    const userId = userIdRef.current;
    if (
      !userId ||
      accountReadyUser.current !== userId ||
      accountSyncing.current ||
      !isOnline() ||
      !hasSession()
    ) {
      return;
    }

    const baseline = loadAccountSyncFingerprints(userId);
    const currentFingerprints = accountFingerprintsRef.current;
    const dirtyNames = ACCOUNT_SECTION_NAMES.filter(
      (name) => currentFingerprints[name] !== baseline[name]
    );
    if (!dirtyNames.length) return;

    const currentSections = accountSectionsRef.current;
    const changedSections = Object.fromEntries(
      dirtyNames.map((name) => [name, currentSections[name]])
    ) as Partial<AccountSections>;
    const submittedFingerprints = Object.fromEntries(
      dirtyNames.map((name) => [name, currentFingerprints[name]])
    );

    accountSyncing.current = true;
    let accepted = false;
    try {
      const result = await flushAccountSections(changedSections);
      if (!result) return;
      accepted = true;

      // Record exactly what this request sent. If the user edits the same
      // section while it is in flight, its newer fingerprint stays dirty and
      // is sent by the next pass instead of being marked synced accidentally.
      const nextBaseline = loadAccountSyncFingerprints(userId);
      for (const name of dirtyNames) {
        nextBaseline[name] = submittedFingerprints[name];
      }
      saveAccountSyncFingerprints(userId, nextBaseline);
    } finally {
      accountSyncing.current = false;
      if (accepted) {
        const latestBaseline = loadAccountSyncFingerprints(userId);
        const changedWhileSending = ACCOUNT_SECTION_NAMES.some(
          (name) => accountFingerprintsRef.current[name] !== latestBaseline[name]
        );
        if (changedWhileSending) {
          window.setTimeout(() => syncAccountNowRef.current(), 0);
        }
      }
    }
  }, []);

  const syncNow = useCallback(async () => {
    void syncAccountNow();
    const queue = pendingRef.current;
    // Nothing to push, no connection, or no account to push it to — an
    // anonymous queue would 401 on every attempt.
    if (syncing.current || !queue.length || !isOnline() || !hasSession()) return;

    syncing.current = true;
    let changedWhileSending = false;
    try {
      const result = await flushExpenses(queue);
      const settled = [...result.synced, ...result.failed];
      if (settled.length) {
        const settledIds = new Set(settled);
        const currentById = new Map(
          pendingRef.current.map((expense) => [expense.id, expense])
        );
        changedWhileSending = queue.some((sent) => {
          if (!settledIds.has(sent.id)) return false;
          const current = currentById.get(sent.id);
          return Boolean(
            current &&
              fingerprintExpenseForSync(current) !== fingerprintExpenseForSync(sent)
          );
        });
        dispatch({
          type: "MARK_SYNCED",
          expenses: queue.filter((expense) => settledIds.has(expense.id)),
        });
      }
      if (!result.offline && settled.length === queue.length) {
        markFullResyncComplete(userIdRef.current);
      }
    } finally {
      syncing.current = false;
      if (changedWhileSending) window.setTimeout(() => syncNowRef.current(), 0);
    }
  }, [syncAccountNow]);

  useEffect(() => {
    syncAccountNowRef.current = () => void syncAccountNow();
    syncNowRef.current = () => void syncNow();
  }, [syncAccountNow, syncNow]);

  const pullNow = useCallback(async () => {
    if (pulling.current || !isOnline() || !hasSession()) return;

    pulling.current = true;
    try {
      const pullUserId = userIdRef.current;
      const [expenses, remoteAccount] = await Promise.all([
        fetchExpenses(),
        fetchAccountState(),
      ]);
      if (expenses) dispatch({ type: "MERGE_REMOTE_EXPENSES", expenses });

      // A null result is a network/API failure. An empty section map is a
      // successful first sync and must unlock the initial local upload.
      if (remoteAccount && pullUserId && pullUserId === userIdRef.current) {
        const baseline = loadAccountSyncFingerprints(pullUserId);
        const currentFingerprints = accountFingerprintsRef.current;
        const cleanRemoteNames = ACCOUNT_SECTION_NAMES.filter((name) => {
          const remote = remoteAccount.sections[name];
          if (!remote) return false;

          const baselineFingerprint = baseline[name];
          const locallyDirty =
            baselineFingerprint !== undefined
              ? currentFingerprints[name] !== baselineFingerprint
              : currentFingerprints[name] !== DEFAULT_ACCOUNT_FINGERPRINTS[name];

          return !locallyDirty;
        });

        const remoteSections = Object.fromEntries(
          cleanRemoteNames.map((name) => [name, remoteAccount.sections[name]!.value])
        ) as Partial<AccountSections>;
        const nextBaseline = { ...baseline };
        for (const name of cleanRemoteNames) {
          nextBaseline[name] = JSON.stringify(remoteAccount.sections[name]!.value);
        }
        saveAccountSyncFingerprints(pullUserId, nextBaseline);
        accountReadyUser.current = pullUserId;

        if (cleanRemoteNames.length) {
          dispatch({ type: "MERGE_REMOTE_ACCOUNT_STATE", sections: remoteSections });
          if (remoteSections.recurring) dispatch({ type: "RUN_DUE_RECURRING" });
        } else {
          // No dispatch means no render/effect will follow this successful
          // empty pull, so start the first upload directly.
          void syncAccountNow();
        }
      }
    } finally {
      pulling.current = false;
    }
  }, [syncAccountNow]);

  // Flush when the connection returns and when new work is queued while online.
  useEffect(() => {
    if (!hydrated || !state.online || !pending.length) return;
    const timer = setTimeout(syncNow, 800); // debounce a burst of taps
    return () => clearTimeout(timer);
  }, [hydrated, state.online, pending.length, pendingFingerprint, syncNow]);

  // Non-expense state uses the same offline-first debounce, but is compared
  // section-by-section against its last server-accepted fingerprint.
  useEffect(() => {
    const userId = state.profile.userId;
    if (
      !hydrated ||
      !state.profile.signedIn ||
      !state.online ||
      !userId ||
      accountReadyUser.current !== userId
    ) {
      return;
    }

    const baseline = loadAccountSyncFingerprints(userId);
    const dirty = ACCOUNT_SECTION_NAMES.some(
      (name) => accountFingerprints[name] !== baseline[name]
    );
    if (!dirty) return;

    const timer = window.setTimeout(() => void syncAccountNow(), 800);
    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    state.profile.signedIn,
    state.profile.userId,
    state.online,
    accountFingerprintKey,
    accountFingerprints,
    syncAccountNow,
  ]);

  // Pull on sign-in/startup, when returning to the tab, after reconnecting,
  // and periodically while open. Pending local edits win during the merge, so
  // downloading can safely overlap the debounced outbound queue.
  useEffect(() => {
    if (!hydrated || !state.profile.signedIn || !state.online) return;

    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        await syncAccountNow();
        await pullNow();
      })();
    };

    void pullNow();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, 30_000);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(interval);
    };
  }, [
    hydrated,
    state.profile.signedIn,
    state.profile.userId,
    state.online,
    pullNow,
    syncAccountNow,
  ]);

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
