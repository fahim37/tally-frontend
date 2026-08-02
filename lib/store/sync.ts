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

const SYNC_BATCH_SIZE = 500;

/** Download the account snapshot for a newly signed-in or returning device. */
export const fetchExpenses = async (): Promise<LocalExpense[] | null> => {
  try {
    const result = await api.get<{ expenses: LocalExpense[] }>("/expenses/sync");
    return result.expenses ?? [];
  } catch {
    // Local state remains usable offline; focus/reconnect polling tries again.
    return null;
  }
};

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

const flushBatch = async (batch: LocalExpense[]): Promise<SyncResult> => {
  try {
    const result = await api.post<{ synced: string[]; failed: string[] }>(
      "/expenses/sync",
      { expenses: batch.map(toPayload) }
    );
    return {
      synced: result.synced ?? [],
      failed: result.failed ?? [],
      offline: false,
    };
  } catch (error) {
    const itemError =
      error instanceof ApiError && [400, 409, 413, 422].includes(error.status);

    if (!itemError) return { synced: [], failed: [], offline: true };
    if (batch.length === 1) {
      return { synced: [], failed: [batch[0].id], offline: false };
    }

    // Validation reports reject a request as a whole. Split it until the one
    // malformed legacy row is isolated, allowing every valid neighbour to
    // sync instead of discarding an entire offline queue with it.
    const middle = Math.ceil(batch.length / 2);
    const first = await flushBatch(batch.slice(0, middle));
    if (first.offline) return first;
    const second = await flushBatch(batch.slice(middle));

    return {
      synced: [...first.synced, ...second.synced],
      failed: [...first.failed, ...second.failed],
      offline: second.offline,
    };
  }
};

/**
 * Pushes pending expenses in one batch. Returns which ids the server accepted
 * so the caller can clear their `pendingSync` flag.
 */
export const flushExpenses = async (pending: LocalExpense[]): Promise<SyncResult> => {
  if (!pending.length) return { synced: [], failed: [], offline: false };

  const synced: string[] = [];
  const failed: string[] = [];

  for (let index = 0; index < pending.length; index += SYNC_BATCH_SIZE) {
    const batch = pending.slice(index, index + SYNC_BATCH_SIZE);
    const result = await flushBatch(batch);
    synced.push(...result.synced);
    failed.push(...result.failed);
    if (result.offline) return { synced, failed, offline: true };
  }

  return { synced, failed, offline: false };
};

/** True when the browser believes it has a connection. */
export const isOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine;
