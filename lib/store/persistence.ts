import type { AccountSectionName, TallyState } from "./state";

/**
 * Offline persistence.
 *
 * The local store is the source of truth: a tap is written here first and
 * rendered immediately, whether or not there's a network. The server is a
 * replica that catches up. That ordering is what makes "one tap logs it" hold
 * on a spotty connection — nothing in the log path awaits a request.
 *
 * localStorage is used rather than IndexedDB because the whole dataset is a
 * few hundred KB of integers and strings, and a synchronous read on boot means
 * the Tap Pad paints with real data on first frame instead of flashing empty.
 * If history ever outgrows that, this module is the only thing that changes.
 *
 * The write, though, is deliberately NOT synchronous with the tap. Serializing
 * the whole store and committing it to disk used to happen in the same frame
 * as the press animation, the ring pulse and the rolling total — the one frame
 * that has to feel instant was the one doing the most work. It is debounced
 * and moved to idle time now, with a guaranteed flush before the page can go
 * away.
 */

const KEY_PREFIX = "tally.state";
const FULL_RESYNC_VERSION = 1;

/**
 * Bump this whenever the shape or the starting data changes in a way that a
 * previously-saved store would contradict.
 *
 * v3 introduced `entry` on tiles and replaced the six fixed-price starters
 * with four buckets. A v2 store still holds "Lunch ৳450" as a tile that logs
 * on tap — which is the exact thing the new model exists to stop, since one
 * lunch is rarely the same price as the next and nobody buys three a day.
 */
const SCHEMA_VERSION = 3;

/**
 * Namespaced per account. Two people signing in on one device would otherwise
 * read each other's expenses — and signing out could not fully undo it,
 * because the next sign-in would rehydrate whatever was left behind.
 */
const storageKey = (userId: string | null) =>
  userId ? `${KEY_PREFIX}.v${SCHEMA_VERSION}.${userId}` : `${KEY_PREFIX}.v${SCHEMA_VERSION}.anon`;

const fullResyncKey = (userId: string) => `${KEY_PREFIX}.full-resync.${userId}`;
const accountSyncKey = (userId: string) => `${KEY_PREFIX}.account-sync.${userId}`;

export type AccountSyncFingerprints = Partial<Record<AccountSectionName, string>>;

/** Last server-accepted value per section, persisted so offline edits remain
 * identifiable even when the browser is closed before reconnecting. */
export const loadAccountSyncFingerprints = (
  userId: string | null
): AccountSyncFingerprints => {
  if (typeof window === "undefined" || !userId) return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(accountSyncKey(userId)) ?? "{}") as {
      fingerprints?: AccountSyncFingerprints;
    };
    return parsed.fingerprints ?? {};
  } catch {
    return {};
  }
};

export const saveAccountSyncFingerprints = (
  userId: string | null,
  fingerprints: AccountSyncFingerprints
): void => {
  if (typeof window === "undefined" || !userId) return;

  try {
    window.localStorage.setItem(
      accountSyncKey(userId),
      JSON.stringify({ fingerprints, savedAt: new Date().toISOString() })
    );
  } catch {
    /* the local state remains usable; the next pull safely re-establishes it */
  }
};

/**
 * The production frontend previously called an expense endpoint that did not
 * exist. Its 404 was incorrectly treated as a permanent item rejection, so
 * those local rows lost their pending flag without ever reaching MongoDB.
 * Replay every account once after the endpoint ships; clientId makes it safe
 * for rows that did get through in another environment.
 */
export const needsFullResync = (userId: string | null): boolean => {
  if (typeof window === "undefined" || !userId) return false;
  return window.localStorage.getItem(fullResyncKey(userId)) !== String(FULL_RESYNC_VERSION);
};

export const markFullResyncComplete = (userId: string | null): void => {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(fullResyncKey(userId), String(FULL_RESYNC_VERSION));
};

interface Envelope {
  version: number;
  savedAt: string;
  state: TallyState;
}

/** Every key this module has ever owned, for a clean sign-out. */
const ownedKeys = (): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(KEY_PREFIX)) keys.push(key);
  }
  return keys;
};

export const loadState = (userId: string | null = null): TallyState | null => {
  if (typeof window === "undefined") return null;

  try {
    // On boot nothing knows who is signed in yet — the tokens say there is a
    // session, but the user id lives in the store we are about to read. So an
    // unqualified load takes the most recently saved account.
    const raw = userId
      ? window.localStorage.getItem(storageKey(userId))
      : mostRecentlySaved();

    if (!raw) return null;

    const envelope = JSON.parse(raw) as Envelope;

    // A stale schema is discarded rather than migrated blind. Real migrations
    // land here when the shape starts changing.
    if (envelope.version !== SCHEMA_VERSION || !envelope.state?.tiles) return null;

    return envelope.state;
  } catch {
    // Corrupt or quota-cleared storage must not brick the app.
    return null;
  }
};

const mostRecentlySaved = (): string | null => {
  let newest: { raw: string; savedAt: string } | null = null;

  // Only stores written by the *current* schema are candidates. Considering
  // every version and letting the check below reject the winner would mean a
  // stale store from an older schema, saved more recently, shadows a valid
  // current one and drops the user back to a fresh account.
  const prefix = `${KEY_PREFIX}.v${SCHEMA_VERSION}.`;

  for (const key of ownedKeys()) {
    if (!key.startsWith(prefix)) continue;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const { savedAt } = JSON.parse(raw) as Envelope;
      if (!newest || savedAt > newest.savedAt) newest = { raw, savedAt };
    } catch {
      /* skip an unreadable entry rather than failing the whole load */
    }
  }

  return newest?.raw ?? null;
};

const write = (state: TallyState): void => {
  try {
    const envelope: Envelope = {
      version: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      // `online` and `hydrated` are runtime facts, not saved state — both are
      // re-established from the browser on boot.
      state: { ...state, online: true, hydrated: false },
    };
    window.localStorage.setItem(storageKey(state.profile.userId), JSON.stringify(envelope));
  } catch {
    // Quota exceeded / private mode. The in-memory store keeps working; the
    // user just loses persistence across reloads.
  }
};

// ── Deferred write ─────────────────────────────────────────────────────────

const IDLE_TIMEOUT = 1000;
const DEBOUNCE_MS = 500;

let pending: TallyState | null = null;
let debounceTimer: number | null = null;
let idleHandle: number | null = null;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const schedule = (run: () => void): number => {
  const w = window as IdleWindow;
  return w.requestIdleCallback
    ? w.requestIdleCallback(run, { timeout: IDLE_TIMEOUT })
    : window.setTimeout(run, 0);
};

const unschedule = (handle: number) => {
  const w = window as IdleWindow;
  if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
  else window.clearTimeout(handle);
};

const commit = () => {
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (idleHandle !== null) {
    unschedule(idleHandle);
    idleHandle = null;
  }
  if (pending) {
    write(pending);
    pending = null;
  }
};

/**
 * Queues a save. A burst of taps collapses into one write, which then runs
 * when the main thread is free rather than in the middle of the animation the
 * tap just started.
 */
export const saveState = (state: TallyState): void => {
  if (typeof window === "undefined") return;

  pending = state;

  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    idleHandle = schedule(() => {
      idleHandle = null;
      if (pending) {
        write(pending);
        pending = null;
      }
    });
  }, DEBOUNCE_MS);
};

/**
 * Writes anything queued, right now.
 *
 * Deferring the write means there is always a window in which the last few
 * taps exist only in memory. `pagehide` and a hidden `visibilitychange` are
 * the last moments a mobile browser reliably gives us before it may kill the
 * tab, so both flush synchronously.
 */
export const flushState = (): void => {
  if (typeof window === "undefined") return;
  commit();
};

export const clearState = (): void => {
  if (typeof window === "undefined") return;

  pending = null;
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (idleHandle !== null) {
    unschedule(idleHandle);
    idleHandle = null;
  }

  try {
    // Every account's entry, not just the current one — this runs on sign-out,
    // and leaving another namespace behind is the bug the namespacing exists
    // to prevent.
    for (const key of ownedKeys()) window.localStorage.removeItem(key);
    // The v1 store, from before this file namespaced anything.
    window.localStorage.removeItem("tally.state.v1");
  } catch {
    /* nothing useful to do */
  }
};
