import api, { ApiError } from "../api";
import type { LocalExpense } from "./state";

/**
 * Outbound sync.
 *
 * Everything the user does lands in the local store first and is flagged
 * `pendingSync`. This module drains that queue when the network is back. It is
 * deliberately the only place that talks to the write endpoints, so the screens
 * never have to think about connectivity.
 *
 * Idempotency: each queued expense sends its local `id` as `clientId`, which
 * the API has a unique index on. A retry after a response was lost updates the
 * existing row instead of creating a duplicate — the failure mode that would
 * otherwise silently double a day's spending.
 */

export interface SyncResult {
  synced: string[];
  failed: string[];
  /** True when the queue could not be drained because the API is unreachable. */
  offline: boolean;
}

const toPayload = (expense: LocalExpense) => ({
  clientId: expense.id,
  tileId: expense.tileId,
  categorySlug: expense.categorySlug,
  name: expense.name,
  note: expense.note,
  merchant: expense.merchant,
  unitAmountMinor: expense.unitAmountMinor,
  quantity: expense.quantity,
  occurredAt: expense.occurredAt,
  localDate: expense.localDate,
  source: expense.source,
  deletedAt: expense.deletedAt,
});

/**
 * Pushes pending expenses in one batch. Returns which ids the server accepted
 * so the caller can clear their `pendingSync` flag.
 */
export const flushExpenses = async (pending: LocalExpense[]): Promise<SyncResult> => {
  if (!pending.length) return { synced: [], failed: [], offline: false };

  try {
    const result = await api.post<{ synced: string[]; failed: string[] }>(
      "/expenses/sync",
      { expenses: pending.map(toPayload) }
    );
    return { synced: result.synced ?? [], failed: result.failed ?? [], offline: false };
  } catch (error) {
    // 4xx means the server rejected the payload — retrying unchanged won't
    // help, so those ids are reported failed and stop blocking the queue.
    // Anything else (network down, 5xx) leaves them pending for the next pass.
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && !error.isAuthError) {
      return { synced: [], failed: pending.map((e) => e.id), offline: false };
    }
    return { synced: [], failed: [], offline: true };
  }
};

/** True when the browser believes it has a connection. */
export const isOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine;
