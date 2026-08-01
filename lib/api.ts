import type { ApiErrorBody, ApiResponse } from "./types";

/**
 * Thin fetch wrapper around the Tally API.
 *
 * It unwraps the `{ success, message, data }` envelope so callers get the
 * payload directly, and it refreshes an expired access token once, replaying
 * the original request — so a 15-minute token expiring mid-session is
 * invisible rather than a bounce to sign-in.
 */

// Relative by default, so every request goes to this app's own origin and the
// `/api/:path*` rewrite in next.config.ts forwards it server-side to the
// deployed API. That keeps the browser from ever making a direct cross-origin
// call to the backend's bare-HTTP address — same-origin requests can't hit
// mixed-content blocking, and there's no CORS negotiation to keep in sync.
// Set NEXT_PUBLIC_API_URL to override — e.g. for pointing at a local API
// server directly during backend development.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export class ApiError extends Error {
  status: number;
  fieldErrors?: { field: string; message: string }[];

  constructor(status: number, message: string, fieldErrors?: { field: string; message: string }[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** True when the request failed because the session is gone, not because
   *  the input was wrong — the only case that should redirect to sign-in. */
  get isAuthError() {
    return this.status === 401;
  }
}

// ── Token storage ──────────────────────────────────────────────────────────
// Kept behind an interface so swapping localStorage for cookies later touches
// one file. Guarded for SSR, where `window` does not exist.

const ACCESS_KEY = "tally.accessToken";
const REFRESH_KEY = "tally.refreshToken";

export const tokenStore = {
  get access() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(accessToken: string, refreshToken: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_KEY, accessToken);
    window.localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip the Authorization header — sign-in, sign-up, refresh. */
  anonymous?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

// Built without `new URL()`: that constructor requires either an absolute
// input or an explicit base, and API_BASE_URL is a bare "/api/v1" by default
// (the whole point — same-origin, so the rewrite in next.config.ts handles
// it). Plain string concatenation works the same whether API_BASE_URL ends up
// relative or someone points NEXT_PUBLIC_API_URL at an absolute origin.
const buildUrl = (path: string, query?: RequestOptions["query"]) => {
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const suffix = path.startsWith("/") ? path : `/${path}`;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();
  return `${base}${suffix}${qs ? `?${qs}` : ""}`;
};

// A single in-flight refresh shared by every request that hits a 401 at once,
// so a screen firing four parallel calls does not burn four refresh tokens
// (each rotation invalidates the last, which would log the user out).
let refreshInFlight: Promise<boolean> | null = null;

const refreshSession = async (): Promise<boolean> => {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        tokenStore.clear();
        return false;
      }
      const payload = (await response.json()) as ApiResponse<{
        accessToken: string;
        refreshToken: string;
      }>;
      tokenStore.set(payload.data.accessToken, payload.data.refreshToken);
      return true;
    } catch {
      tokenStore.clear();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
};

const parseError = async (response: Response): Promise<ApiError> => {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Non-JSON error (proxy, gateway) — fall through to the status text.
  }
  return new ApiError(
    response.status,
    body.message || response.statusText || "Request failed",
    body.errors
  );
};

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { body, anonymous, query, headers, ...rest } = options;

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const accessToken = anonymous ? null : tokenStore.access;

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: {
      // Let the browser set the multipart boundary itself for uploads.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !anonymous && !isRetry) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, options, true);
  }

  if (!response.ok) throw await parseError(response);

  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

/** Same as `request`, but returns the envelope so `meta` (pagination) survives. */
async function requestWithMeta<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { body, anonymous, query, headers, ...rest } = options;
  const accessToken = anonymous ? null : tokenStore.access;

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ApiResponse<T>;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
  paged: requestWithMeta,
};

export default api;
