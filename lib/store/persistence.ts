import type { TallyState } from "./state";

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
 */

const STORAGE_KEY = "tally.state.v1";
const SCHEMA_VERSION = 1;

interface Envelope {
  version: number;
  savedAt: string;
  state: TallyState;
}

export const loadState = (): TallyState | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const envelope = JSON.parse(raw) as Envelope;

    // A stale schema is discarded rather than migrated blind — the seed will
    // rebuild. Real migrations land here when the shape starts changing.
    if (envelope.version !== SCHEMA_VERSION || !envelope.state?.tiles) return null;

    return envelope.state;
  } catch {
    // Corrupt or quota-cleared storage must not brick the app.
    return null;
  }
};

export const saveState = (state: TallyState): void => {
  if (typeof window === "undefined") return;

  try {
    const envelope: Envelope = {
      version: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      // `online` and `hydrated` are runtime facts, not saved state — both are
      // re-established from the browser on boot.
      state: { ...state, online: true, hydrated: false },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Quota exceeded / private mode. The in-memory store keeps working; the
    // user just loses persistence across reloads.
  }
};

export const clearState = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing useful to do */
  }
};
