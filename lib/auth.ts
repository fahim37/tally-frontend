import api, { ApiError, tokenStore } from "./api";

/**
 * The only module that talks to /auth.
 *
 * Token storage and the refresh-and-replay dance already live in `lib/api.ts`
 * — this layer is about the account: who is signed in, how they got there, and
 * how they leave.
 *
 * One rule runs through all of it: **a network failure is not a sign-out.**
 * The app is offline-first, so someone on a dead connection with a valid
 * session must stay signed in and keep logging expenses into the local store.
 * Only the server actually rejecting a credential ends a session.
 */

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  currency: string;
  timezone: string;
  appearance: "light" | "dark" | "system";
  authProviders: ("email" | "google")[];
  onboarding: { completed: boolean; step: number; completedAt: string | null };
  stats: {
    totalTaps: number;
    currentStreak: number;
    longestStreak: number;
    lastLoggedDate: string | null;
    firstLoggedDate: string | null;
  };
}

export type AuthMode = "signin" | "signup";

interface SessionPayload {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

/** The API returns `_id`/`id` depending on the path; normalise once, here. */
const normalize = (user: AuthUser & { _id?: string }): AuthUser => ({
  ...user,
  id: user.id ?? user._id ?? "",
  // A blank display name is the common case — signup is two fields — and every
  // screen would otherwise need its own fallback.
  displayName: user.displayName || user.email.split("@")[0],
});

const adopt = (payload: SessionPayload): AuthUser => {
  tokenStore.set(payload.accessToken, payload.refreshToken);
  return normalize(payload.user);
};

/** Signs in or registers, stores the tokens, and returns the account. */
export async function authenticate(
  mode: AuthMode,
  email: string,
  password: string
): Promise<AuthUser> {
  const path = mode === "signup" ? "/auth/register" : "/auth/login";
  const payload = await api.post<SessionPayload>(
    path,
    { email: email.trim().toLowerCase(), password },
    { anonymous: true }
  );
  return adopt(payload);
}

/** Exchanges a Google ID token for a session. */
export async function authenticateWithGoogle(idToken: string): Promise<AuthUser> {
  const payload = await api.post<SessionPayload>(
    "/auth/google",
    { idToken },
    { anonymous: true }
  );
  return adopt(payload);
}

/**
 * The current account, or null when there is no usable session.
 *
 * `api.get` already refreshes once and replays on a 401, so reaching a 401
 * here means the refresh token is gone too and the session is genuinely over.
 * Anything else — a dead connection, a 500, the API not running — leaves the
 * stored tokens alone and returns null, so the caller falls back to whatever
 * the persisted store already knows.
 */
export async function fetchSession(): Promise<AuthUser | null> {
  if (!tokenStore.access) return null;

  try {
    const { user } = await api.get<{ user: AuthUser }>("/auth/me");
    return normalize(user);
  } catch (error) {
    if (error instanceof ApiError && error.isAuthError) {
      tokenStore.clear();
      return null;
    }
    return null;
  }
}

export type AccountPatch = Partial<
  Pick<AuthUser, "displayName" | "currency" | "timezone" | "appearance">
> & {
  onboarding?: { completed?: boolean; step?: number };
};

/**
 * Pushes profile changes to the API.
 *
 * Returns null rather than throwing when it can't reach the server. Every
 * caller is a screen where the local store has already been updated — losing
 * the round trip must not block the user or roll back what they just did.
 */
export async function updateAccount(patch: AccountPatch): Promise<AuthUser | null> {
  if (!tokenStore.access) return null;

  try {
    const { user } = await api.patch<{ user: AuthUser }>("/auth/me", patch);
    return normalize(user);
  } catch {
    return null;
  }
}

/**
 * Ends the session. Always resolves — a sign-out that can fail is a sign-out
 * users can't trust, and the local tokens are cleared either way. The server
 * call is best-effort revocation of the refresh token.
 */
export async function signOut(): Promise<void> {
  const refreshToken = tokenStore.refresh;

  try {
    if (refreshToken) {
      await api.post("/auth/logout", { refreshToken }, { anonymous: true });
    }
  } catch {
    // The token expires on its own schedule; nothing useful to do here.
  } finally {
    tokenStore.clear();
  }
}

/** Synchronous and SSR-safe — for render-time branching, not authorization. */
export function hasSession(): boolean {
  return Boolean(tokenStore.access);
}

/**
 * The browser half of Google Sign-In. Resolves with an ID token, or null when
 * no client ID is configured — in which case the UI hides the button entirely
 * rather than offering something that cannot work.
 */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export const googleSignInAvailable = (): boolean => Boolean(GOOGLE_CLIENT_ID);
