import { todayLocalDate, toLocalMonth, fromLocalDate, currentLocalMonth } from "../date";
import type { AuthUser } from "../auth";
import {
  createInitialState,
  type LocalExpense,
  type LocalGoal,
  type LocalRecurring,
  type LocalTile,
  type TallyState,
} from "./state";

/**
 * All state transitions. Pure and synchronous — the provider persists the
 * result, so every mutation is replayable and the offline queue is just the
 * subset of expenses with `pendingSync: true`.
 */
export type TallyAction =
  /** `state: null` means nothing was persisted — keep the seed, just mark ready. */
  | { type: "HYDRATE"; state: TallyState | null }
  | { type: "TAP_TILE"; tileId: string }
  /** A "prompt" tile logging a one-off amount the user just entered.
   *  `label` optionally names *what* it was ("Biryani"), replacing the tile's
   *  own name on that one row. */
  | {
      type: "LOG_TILE_AMOUNT";
      tileId: string;
      amountMinor: number;
      quantity?: number;
      label?: string;
    }
  | { type: "SET_QUANTITY"; tileId: string; localDate: string; quantity: number }
  | { type: "SET_TILE_AMOUNT"; tileId: string; amountMinor: number }
  | { type: "ADD_TILE"; tile: Omit<LocalTile, "id" | "usageCount" | "lastUsedAt" | "sortIndex"> }
  | { type: "UPDATE_TILE"; tileId: string; patch: Partial<LocalTile> }
  | { type: "ARCHIVE_TILE"; tileId: string }
  | { type: "ADD_EXPENSES"; expenses: Omit<LocalExpense, "id" | "pendingSync" | "deletedAt">[] }
  | { type: "UPDATE_EXPENSE"; expenseId: string; patch: Partial<LocalExpense> }
  | { type: "DELETE_EXPENSE"; expenseId: string }
  | { type: "RESTORE_EXPENSE"; expenseId: string }
  | { type: "UNDO_LAST_TAP" }
  | { type: "SET_BUDGET"; month: string; overallLimitMinor: number }
  | { type: "SET_CATEGORY_LIMIT"; month: string; categorySlug: string; limitMinor: number }
  | { type: "SET_WHAT_IF"; habitId: string; count: number }
  | { type: "SET_HABIT_TARGET"; habitId: string; target: number | null }
  | { type: "ADD_HABIT"; tileId: string }
  | { type: "REMOVE_HABIT"; habitId: string }
  | { type: "UPDATE_GOAL"; goalId: string; patch: Partial<LocalGoal> }
  | { type: "TOGGLE_RECURRING"; ruleId: string }
  | { type: "ADD_RECURRING"; rule: Omit<LocalRecurring, "id"> }
  | { type: "REMOVE_RECURRING"; ruleId: string }
  | { type: "RUN_DUE_RECURRING" }
  | { type: "UPDATE_PROFILE"; patch: Partial<TallyState["profile"]> }
  | { type: "UPDATE_SETTINGS"; patch: Partial<TallyState["settings"]> }
  | { type: "SET_ONLINE"; online: boolean }
  | { type: "QUEUE_ALL_EXPENSES" }
  | { type: "MERGE_REMOTE_EXPENSES"; expenses: LocalExpense[] }
  | { type: "MARK_SYNCED"; expenseIds: string[] }
  | { type: "SIGN_IN"; user: AuthUser }
  | { type: "SIGN_OUT" }
  | { type: "RESET" };

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const withTotal = (expense: LocalExpense): LocalExpense => ({
  ...expense,
  totalAmountMinor: Math.round(expense.unitAmountMinor * expense.quantity),
});

/**
 * Tap-upsert: find today's live row for this tile and increment it, or open a
 * new one. This is what makes "×7" a single history row and lets the quantity
 * stepper and the tally marks edit the same record.
 */
const applyTap = (state: TallyState, tileId: string, delta: number): TallyState => {
  const tile = state.tiles.find((t) => t.id === tileId);
  if (!tile) return state;

  const localDate = todayLocalDate();
  const existing = state.expenses.find(
    (e) => e.tileId === tileId && e.localDate === localDate && !e.deletedAt
  );

  let expenses: LocalExpense[];

  if (existing) {
    const quantity = existing.quantity + delta;
    expenses =
      quantity <= 0
        ? // Dropping to zero removes the row rather than leaving a ×0 entry.
          state.expenses.filter((e) => e.id !== existing.id)
        : state.expenses.map((e) =>
            e.id === existing.id
              ? withTotal({ ...e, quantity, pendingSync: true, occurredAt: new Date().toISOString() })
              : e
          );
  } else {
    if (delta <= 0) return state;
    const now = new Date();
    expenses = [
      ...state.expenses,
      withTotal({
        id: uid("exp"),
        tileId: tile.id,
        categorySlug: tile.categorySlug,
        name: tile.name,
        unitAmountMinor: tile.defaultAmountMinor,
        quantity: delta,
        totalAmountMinor: 0,
        occurredAt: now.toISOString(),
        localDate,
        localMonth: toLocalMonth(now),
        source: "tap",
        pendingSync: true,
        deletedAt: null,
      }),
    ];
  }

  return {
    ...state,
    expenses,
    tiles: state.tiles.map((t) =>
      t.id === tileId
        ? {
            ...t,
            usageCount: Math.max(0, t.usageCount + delta),
            lastUsedAt: new Date().toISOString(),
          }
        : t
    ),
    profile: {
      ...state.profile,
      totalTaps: Math.max(0, state.profile.totalTaps + delta),
    },
  };
};

export const reducer = (state: TallyState, action: TallyAction): TallyState => {
  switch (action.type) {
    case "HYDRATE":
      // Persisted store wins wholesale, but connectivity is a live fact that
      // must come from the browser, not from whatever was saved. `hydrated`
      // lives in the reducer so the provider's mount effect only dispatches —
      // no setState, no cascading render.
      return action.state
        ? { ...action.state, online: state.online, hydrated: true }
        : { ...state, hydrated: true };

    case "TAP_TILE":
      return applyTap(state, action.tileId, 1);

    case "LOG_TILE_AMOUNT": {
      const tile = state.tiles.find((t) => t.id === action.tileId);
      if (!tile || action.amountMinor <= 0) return state;

      const quantity = Math.max(1, action.quantity ?? 1);
      const now = new Date();

      // Deliberately NOT the tap-upsert. A fixed-price tile can merge today's
      // taps into one "×7" row because every one of them cost the same. A
      // prompt tile's entries don't — folding a ৳60 breakfast and a ৳420
      // dinner into "Food ×2" would invent a unit price that was never paid
      // and make the day impossible to read back.
      const label = action.label?.trim();

      const expense = withTotal({
        id: uid("exp"),
        tileId: tile.id,
        categorySlug: tile.categorySlug,
        // The label replaces the tile's name on this row rather than sitting
        // in `note`, because History lists rows by name — "Biryani ৳420" is
        // the line worth reading back, not a third "Food" among five.
        // `tileId` still links it to the tile for every rollup.
        name: label || tile.name,
        unitAmountMinor: action.amountMinor,
        quantity,
        totalAmountMinor: 0,
        occurredAt: now.toISOString(),
        localDate: todayLocalDate(),
        localMonth: toLocalMonth(now),
        source: "tap",
        pendingSync: true,
        deletedAt: null,
      });

      return {
        ...state,
        expenses: [...state.expenses, expense],
        tiles: state.tiles.map((t) =>
          t.id === tile.id
            ? {
                ...t,
                usageCount: t.usageCount + quantity,
                lastUsedAt: now.toISOString(),
                // The amount just used becomes the one the keypad opens with
                // next time — the best available guess at what this costs.
                defaultAmountMinor: action.amountMinor,
              }
            : t
        ),
        profile: {
          ...state.profile,
          totalTaps: state.profile.totalTaps + quantity,
        },
      };
    }

    case "SET_QUANTITY": {
      const matching = state.expenses.filter(
        (e) => e.tileId === action.tileId && e.localDate === action.localDate && !e.deletedAt
      );
      const current = matching.reduce((sum, expense) => sum + expense.quantity, 0);
      const target = Math.max(0, Math.floor(action.quantity));
      const delta = target - current;

      if (delta === 0) return state;
      if (delta > 0) return applyTap(state, action.tileId, delta);

      // `todayCount` is an aggregate across every row for this tile. A tile can
      // have several rows after changing entry mode or logging custom amounts,
      // so reducing only the first row does not set the displayed total. Remove
      // units from the newest rows until the aggregate reaches the requested
      // value, preserving the amounts attached to earlier entries.
      let remaining = -delta;
      const adjusted = new Map<string, number>();
      const newestFirst = [...matching].sort((a, b) =>
        b.occurredAt.localeCompare(a.occurredAt)
      );

      for (const expense of newestFirst) {
        if (remaining === 0) break;
        const removed = Math.min(expense.quantity, remaining);
        adjusted.set(expense.id, expense.quantity - removed);
        remaining -= removed;
      }

      const changedAt = new Date().toISOString();

      return {
        ...state,
        expenses: state.expenses.map((expense) => {
          const quantity = adjusted.get(expense.id);
          if (quantity === undefined) return expense;

          // Keep a tombstone for sync instead of dropping an already-synced
          // row locally; selectors ignore deleted rows immediately.
          if (quantity === 0) {
            return { ...expense, pendingSync: true, deletedAt: changedAt };
          }

          return withTotal({ ...expense, quantity, pendingSync: true });
        }),
        tiles: state.tiles.map((tile) =>
          tile.id === action.tileId
            ? { ...tile, usageCount: Math.max(0, tile.usageCount + delta) }
            : tile
        ),
        profile: {
          ...state.profile,
          totalTaps: Math.max(0, state.profile.totalTaps + delta),
        },
      };
    }

    case "SET_TILE_AMOUNT": {
      const localDate = todayLocalDate();
      const tile = state.tiles.find((candidate) => candidate.id === action.tileId);
      return {
        ...state,
        tiles: state.tiles.map((t) =>
          t.id === action.tileId ? { ...t, defaultAmountMinor: action.amountMinor } : t
        ),
        // Repricing applies to today's open row (the user is correcting what
        // they just logged), but never to closed days.
        expenses: state.expenses.map((e) =>
          tile?.entry === "instant" &&
          e.tileId === action.tileId &&
          e.localDate === localDate &&
          !e.deletedAt
            ? withTotal({ ...e, unitAmountMinor: action.amountMinor, pendingSync: true })
            : e
        ),
      };
    }

    case "ADD_TILE":
      return {
        ...state,
        tiles: [
          ...state.tiles,
          {
            ...action.tile,
            id: uid("tile"),
            usageCount: 0,
            lastUsedAt: null,
            sortIndex: state.tiles.length,
          },
        ],
      };

    case "UPDATE_TILE":
      return {
        ...state,
        tiles: state.tiles.map((t) =>
          t.id === action.tileId ? { ...t, ...action.patch } : t
        ),
      };

    case "ARCHIVE_TILE":
      return {
        ...state,
        tiles: state.tiles.map((t) =>
          t.id === action.tileId ? { ...t, isArchived: true } : t
        ),
        habits: state.habits.filter((h) => h.tileId !== action.tileId),
      };

    case "ADD_EXPENSES": {
      const added = action.expenses.map((e) =>
        withTotal({ ...e, id: uid("exp"), pendingSync: true, deletedAt: null })
      );
      return {
        ...state,
        expenses: [...state.expenses, ...added],
        profile: {
          ...state.profile,
          totalTaps: state.profile.totalTaps + added.reduce((s, e) => s + e.quantity, 0),
        },
      };
    }

    case "UPDATE_EXPENSE":
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.expenseId
            ? withTotal({ ...e, ...action.patch, pendingSync: true })
            : e
        ),
      };

    case "DELETE_EXPENSE":
      // Soft delete, so the row can come back from an undo toast.
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.expenseId ? { ...e, deletedAt: new Date().toISOString() } : e
        ),
      };

    case "RESTORE_EXPENSE":
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.expenseId ? { ...e, deletedAt: null } : e
        ),
      };

    case "UNDO_LAST_TAP": {
      const localDate = todayLocalDate();
      const todays = state.expenses
        .filter((e) => e.localDate === localDate && !e.deletedAt && e.source === "tap")
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      const last = todays[0];
      if (!last?.tileId) return state;

      const tile = state.tiles.find((t) => t.id === last.tileId);

      // A prompt tile writes one row per entry, so undo has to remove *that*
      // row. Decrementing through applyTap would find the first row for the
      // tile today rather than the newest one — with three Food entries
      // logged, undoing the ৳420 dinner would quietly cancel the ৳60
      // breakfast instead.
      if (tile?.entry === "prompt") {
        return {
          ...state,
          expenses: state.expenses.filter((e) => e.id !== last.id),
          tiles: state.tiles.map((t) =>
            t.id === tile.id
              ? { ...t, usageCount: Math.max(0, t.usageCount - last.quantity) }
              : t
          ),
          profile: {
            ...state.profile,
            totalTaps: Math.max(0, state.profile.totalTaps - last.quantity),
          },
        };
      }

      return applyTap(state, last.tileId, -1);
    }

    case "SET_BUDGET": {
      const exists = state.budgets.some((b) => b.month === action.month);
      return {
        ...state,
        budgets: exists
          ? state.budgets.map((b) =>
              b.month === action.month
                ? { ...b, overallLimitMinor: action.overallLimitMinor }
                : b
            )
          : [
              ...state.budgets,
              {
                month: action.month,
                overallLimitMinor: action.overallLimitMinor,
                categoryLimits: [],
              },
            ],
      };
    }

    case "SET_CATEGORY_LIMIT":
      return {
        ...state,
        budgets: state.budgets.map((b) => {
          if (b.month !== action.month) return b;
          const exists = b.categoryLimits.some((c) => c.categorySlug === action.categorySlug);
          return {
            ...b,
            categoryLimits: exists
              ? b.categoryLimits.map((c) =>
                  c.categorySlug === action.categorySlug
                    ? { ...c, limitMinor: action.limitMinor }
                    : c
                )
              : [
                  ...b.categoryLimits,
                  { categorySlug: action.categorySlug, limitMinor: action.limitMinor },
                ],
          };
        }),
      };

    case "SET_WHAT_IF":
      return {
        ...state,
        habits: state.habits.map((h) =>
          h.id === action.habitId ? { ...h, whatIfDailyCount: action.count } : h
        ),
      };

    case "SET_HABIT_TARGET":
      return {
        ...state,
        habits: state.habits.map((h) =>
          h.id === action.habitId ? { ...h, targetDailyCount: action.target } : h
        ),
      };

    case "ADD_HABIT": {
      const tile = state.tiles.find((t) => t.id === action.tileId);
      if (!tile || state.habits.some((h) => h.tileId === tile.id)) return state;
      return {
        ...state,
        habits: [
          ...state.habits,
          {
            id: uid("habit"),
            tileId: tile.id,
            name: tile.name,
            iconKey: tile.iconKey,
            unitAmountMinor: tile.defaultAmountMinor,
            baselineDailyCount: 0,
            targetDailyCount: null,
            whatIfDailyCount: null,
            sortIndex: state.habits.length,
          },
        ],
      };
    }

    case "REMOVE_HABIT":
      return { ...state, habits: state.habits.filter((h) => h.id !== action.habitId) };

    case "UPDATE_GOAL":
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.goalId ? { ...g, ...action.patch } : g
        ),
      };

    case "TOGGLE_RECURRING":
      return {
        ...state,
        recurring: state.recurring.map((r) =>
          r.id === action.ruleId ? { ...r, isActive: !r.isActive } : r
        ),
      };

    case "ADD_RECURRING":
      return { ...state, recurring: [...state.recurring, { ...action.rule, id: uid("rec") }] };

    case "REMOVE_RECURRING":
      return { ...state, recurring: state.recurring.filter((r) => r.id !== action.ruleId) };

    case "RUN_DUE_RECURRING": {
      // Auto-log any active rule whose date has arrived. `lastRunDate` makes
      // this idempotent, so opening the app twice in a day charges rent once.
      const today = todayLocalDate();
      const due = state.recurring.filter(
        (r) => r.isActive && r.autoLog && r.nextRunDate <= today && r.lastRunDate !== r.nextRunDate
      );
      if (!due.length) return state;

      const added: LocalExpense[] = due.map((rule) => {
        const runDate = rule.nextRunDate;
        return withTotal({
          id: uid("exp"),
          tileId: null,
          categorySlug: rule.categorySlug,
          name: rule.name,
          unitAmountMinor: rule.amountMinor,
          quantity: 1,
          totalAmountMinor: 0,
          occurredAt: new Date(`${runDate}T09:00:00`).toISOString(),
          localDate: runDate,
          localMonth: toLocalMonth(fromLocalDate(runDate)),
          source: "recurring",
          pendingSync: true,
          deletedAt: null,
        });
      });

      const advance = (rule: LocalRecurring): LocalRecurring => {
        const date = fromLocalDate(rule.nextRunDate);
        if (rule.frequency === "daily") date.setDate(date.getDate() + 1);
        else if (rule.frequency === "weekly") date.setDate(date.getDate() + 7);
        else if (rule.frequency === "monthly") date.setMonth(date.getMonth() + 1);
        else date.setFullYear(date.getFullYear() + 1);
        return {
          ...rule,
          lastRunDate: rule.nextRunDate,
          nextRunDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        };
      };

      const dueIds = new Set(due.map((r) => r.id));
      return {
        ...state,
        expenses: [...state.expenses, ...added],
        recurring: state.recurring.map((r) => (dueIds.has(r.id) ? advance(r) : r)),
      };
    }

    case "UPDATE_PROFILE":
      return { ...state, profile: { ...state.profile, ...action.patch } };

    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case "SET_ONLINE":
      return { ...state, online: action.online };

    case "QUEUE_ALL_EXPENSES":
      return {
        ...state,
        expenses: state.expenses.map((expense) => ({ ...expense, pendingSync: true })),
      };

    case "MERGE_REMOTE_EXPENSES": {
      const localById = new Map(state.expenses.map((expense) => [expense.id, expense]));
      const remoteIds = new Set(action.expenses.map((expense) => expense.id));
      const expenses = action.expenses.map((remote) => {
        const local = localById.get(remote.id);
        // An unsent local correction is newer than the server snapshot. It
        // will win remotely as soon as the outbound queue drains.
        if (local?.pendingSync) return local;
        // Older server rows predate `clientTileId`. Preserve the association
        // this device already knows until the repaired snapshot writes it back.
        return {
          ...remote,
          tileId: remote.tileId ?? local?.tileId ?? null,
          pendingSync: false,
        };
      });

      // A local row absent from the snapshot may be an offline write or one
      // stranded by the old missing endpoint. Never erase it during a pull.
      for (const local of state.expenses) {
        if (!remoteIds.has(local.id)) expenses.push(local);
      }

      expenses.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

      const usageByTile = new Map<string, { count: number; lastUsedAt: string }>();
      let totalTaps = 0;
      for (const expense of expenses) {
        if (expense.deletedAt) continue;
        totalTaps += expense.quantity;
        if (!expense.tileId) continue;
        const usage = usageByTile.get(expense.tileId);
        usageByTile.set(expense.tileId, {
          count: (usage?.count ?? 0) + expense.quantity,
          lastUsedAt:
            !usage || expense.occurredAt > usage.lastUsedAt
              ? expense.occurredAt
              : usage.lastUsedAt,
        });
      }

      return {
        ...state,
        expenses,
        tiles: state.tiles.map((tile) => {
          const usage = usageByTile.get(tile.id);
          return {
            ...tile,
            usageCount: usage?.count ?? 0,
            lastUsedAt: usage?.lastUsedAt ?? null,
          };
        }),
        profile: { ...state.profile, totalTaps },
      };
    }

    case "MARK_SYNCED": {
      const ids = new Set(action.expenseIds);
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          ids.has(e.id) ? { ...e, pendingSync: false } : e
        ),
      };
    }

    case "SIGN_IN": {
      const { user } = action;
      return {
        ...state,
        profile: {
          ...state.profile,
          userId: user.id,
          email: user.email,
          displayName: user.displayName,
          currency: user.currency,
          appearance: user.appearance,
          signedIn: true,
          authProvider: user.authProviders.includes("google") ? "google" : "email",
          onboardingCompleted: user.onboarding.completed,
          // The server's tap count is authoritative across devices, but a
          // fresh install has nothing local to contradict it.
          totalTaps: Math.max(state.profile.totalTaps, user.stats.totalTaps),
        },
      };
    }

    case "SIGN_OUT":
      // A fresh state, not a cleared profile. Leaving the previous account's
      // expenses, budget and habits in memory would show them to whoever signs
      // in next on this device.
      return { ...createInitialState(), online: state.online, hydrated: true };

    case "RESET":
      // Was `return state` — a silent no-op, so "reset all data" in Profile
      // cleared localStorage and then reloaded straight back into the same
      // in-memory store.
      return { ...createInitialState(), online: state.online, hydrated: true };

    default:
      return state;
  }
};

export { uid, currentLocalMonth };
