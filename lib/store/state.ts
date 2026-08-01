import type { IconKey } from "../types";
import type { LocalDate, LocalMonth } from "../date";
import { currentLocalMonth, lastNLocalDates, todayLocalDate, toLocalMonth, fromLocalDate } from "../date";

/**
 * The client-side state shape.
 *
 * It deliberately mirrors the API models rather than inventing a parallel
 * vocabulary — same field names, same `*Minor` money rule, same tap-upsert
 * semantics — so wiring the real endpoints in later is a swap of the
 * persistence layer, not a rewrite of every screen.
 */

export interface LocalCategory {
  id: string;
  slug: string;
  name: string;
  colorVar: string;
  iconKey: IconKey;
  keywords: string[];
  sortIndex: number;
}

export interface LocalTile {
  id: string;
  name: string;
  iconKey: IconKey;
  categorySlug: string;
  defaultAmountMinor: number;
  presetAmountsMinor: number[];
  usageCount: number;
  lastUsedAt: string | null;
  sortIndex: number;
  isArchived: boolean;
  isCustom: boolean;
}

export interface LocalExpense {
  id: string;
  tileId: string | null;
  categorySlug: string;
  name: string;
  note?: string;
  merchant?: string;
  unitAmountMinor: number;
  quantity: number;
  totalAmountMinor: number;
  occurredAt: string;
  localDate: LocalDate;
  localMonth: LocalMonth;
  source: "tap" | "manual" | "parsed" | "scanned" | "recurring";
  /** Queued while offline, cleared once the API accepts it. */
  pendingSync: boolean;
  deletedAt: string | null;
}

export interface LocalHabit {
  id: string;
  tileId: string;
  name: string;
  iconKey: IconKey;
  unitAmountMinor: number;
  baselineDailyCount: number;
  targetDailyCount: number | null;
  whatIfDailyCount: number | null;
  sortIndex: number;
}

export interface LocalGoal {
  id: string;
  title: string;
  note: string;
  targetAmountMinor: number;
  savedAmountMinor: number;
  linkedHabitId: string | null;
  reductionPerDay: number | null;
  targetDate: string | null;
}

export interface LocalBudget {
  month: LocalMonth;
  overallLimitMinor: number;
  categoryLimits: { categorySlug: string; limitMinor: number }[];
}

export interface LocalRecurring {
  id: string;
  name: string;
  categorySlug: string;
  amountMinor: number;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  dayOfMonth: number | null;
  nextRunDate: LocalDate;
  lastRunDate: LocalDate | null;
  autoLog: boolean;
  isActive: boolean;
}

export interface LocalProfile {
  email: string;
  displayName: string;
  currency: string;
  appearance: "light" | "dark" | "system";
  /** False until sign-in. Local-only until the auth endpoints are wired. */
  signedIn: boolean;
  authProvider: "email" | "google" | null;
  onboardingCompleted: boolean;
  totalTaps: number;
}

export interface LocalSettings {
  /** Marks per group before the strike-through. Four-then-a-strike by default. */
  strikeAt: number;
  /** Hold duration that opens the amount sheet. */
  longPressMs: number;
  /** How far a tile sinks on press, in px. */
  pressDepth: number;
}

export interface TallyState {
  profile: LocalProfile;
  settings: LocalSettings;
  categories: LocalCategory[];
  tiles: LocalTile[];
  expenses: LocalExpense[];
  budgets: LocalBudget[];
  habits: LocalHabit[];
  goals: LocalGoal[];
  recurring: LocalRecurring[];
  /** Set false by the offline banner / navigator events. */
  online: boolean;
  /** False until persisted state has been read, so screens can avoid painting
   *  seed data over real data on the first client tick. */
  hydrated: boolean;
}

// ── Seed ───────────────────────────────────────────────────────────────────

export const CATEGORIES: LocalCategory[] = [
  {
    id: "cat-food",
    slug: "food-drink",
    name: "Food & drink",
    colorVar: "var(--blue)",
    iconKey: "lunch",
    sortIndex: 0,
    keywords: [
      "tea", "cha", "chai", "coffee", "lunch", "dinner", "breakfast", "snack",
      "biryani", "kacchi", "burger", "pizza", "restaurant", "cafe", "canteen",
      "delivery", "foodpanda", "juice", "water", "cake", "meal", "food",
    ],
  },
  {
    id: "cat-cig",
    slug: "cigarettes",
    name: "Cigarettes",
    colorVar: "var(--amber)",
    iconKey: "cig",
    sortIndex: 1,
    keywords: ["cigarette", "cig", "smoke", "benson", "gold leaf", "pack"],
  },
  {
    id: "cat-transport",
    slug: "transport",
    name: "Transport",
    colorVar: "var(--color-blue-400)",
    iconKey: "rick",
    sortIndex: 2,
    keywords: [
      "rickshaw", "riksha", "cng", "uber", "pathao", "bus", "train", "ride",
      "fare", "taxi", "ticket", "metro", "auto", "transport", "parking",
    ],
  },
  {
    id: "cat-bills",
    slug: "bills-data",
    name: "Bills & data",
    colorVar: "var(--color-blue-200)",
    iconKey: "data",
    sortIndex: 3,
    keywords: [
      "data", "recharge", "internet", "wifi", "broadband", "electricity",
      "gas bill", "water bill", "rent", "bill", "subscription", "netflix",
      "spotify", "mobile", "flexiload", "topup",
    ],
  },
  {
    id: "cat-grocery",
    slug: "groceries",
    name: "Groceries",
    colorVar: "var(--teal)",
    iconKey: "grocery",
    sortIndex: 4,
    keywords: [
      "grocery", "groceries", "bazar", "bazaar", "market", "vegetable", "rice",
      "fish", "meat", "egg", "milk", "oil", "shwapno", "agora",
    ],
  },
  {
    id: "cat-health",
    slug: "health",
    name: "Health",
    colorVar: "#2BC49B",
    iconKey: "medicine",
    sortIndex: 5,
    keywords: ["medicine", "pharmacy", "doctor", "hospital", "clinic", "test", "health"],
  },
  {
    id: "cat-shopping",
    slug: "shopping",
    name: "Shopping",
    colorVar: "#8B5CF6",
    iconKey: "bag",
    sortIndex: 6,
    keywords: ["shirt", "shoe", "clothes", "dress", "daraz", "gift", "salon", "haircut", "shopping"],
  },
  {
    id: "cat-other",
    slug: "other",
    name: "Other",
    colorVar: "var(--line)",
    iconKey: "bag",
    sortIndex: 7,
    keywords: [],
  },
];

const seedTiles = (): LocalTile[] =>
  [
    { id: "tile-tea", name: "Tea", iconKey: "tea" as IconKey, categorySlug: "food-drink", amt: 2000 },
    { id: "tile-cig", name: "Cigarette", iconKey: "cig" as IconKey, categorySlug: "cigarettes", amt: 1600 },
    { id: "tile-rick", name: "Rickshaw", iconKey: "rick" as IconKey, categorySlug: "transport", amt: 5000 },
    { id: "tile-lunch", name: "Lunch", iconKey: "lunch" as IconKey, categorySlug: "food-drink", amt: 15000 },
    { id: "tile-data", name: "Data pack", iconKey: "data" as IconKey, categorySlug: "bills-data", amt: 30000 },
    { id: "tile-coffee", name: "Coffee", iconKey: "coffee" as IconKey, categorySlug: "food-drink", amt: 25000 },
  ].map((t, i) => ({
    id: t.id,
    name: t.name,
    iconKey: t.iconKey,
    categorySlug: t.categorySlug,
    defaultAmountMinor: t.amt,
    presetAmountsMinor: [t.amt, t.amt * 2, t.amt * 5, t.amt * 10],
    usageCount: 0,
    lastUsedAt: null,
    sortIndex: i,
    isArchived: false,
    isCustom: false,
  }));

/**
 * 30 days of plausible history so the Dashboard, Habits and History screens
 * have something real to show on first run. Today is left empty — the first
 * tap the user makes is the first mark of the day, which is the point.
 */
const seedExpenses = (tiles: LocalTile[]): LocalExpense[] => {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const dates = lastNLocalDates(30);
  const today = todayLocalDate();
  const rows: LocalExpense[] = [];

  dates.forEach((localDate, dayIndex) => {
    if (localDate === today) return;

    const weekday = fromLocalDate(localDate).getDay();
    const isWeekend = weekday === 5 || weekday === 6;

    const plan: [string, number][] = [
      ["tile-tea", 3 + (dayIndex % 4)],
      ["tile-cig", isWeekend ? 13 : 7 + (dayIndex % 5)],
      ["tile-rick", isWeekend ? 4 : 2],
      ["tile-lunch", 1],
      ["tile-coffee", isWeekend ? 1 : 0],
      ["tile-data", dayIndex === 16 ? 1 : 0],
    ];

    for (const [tileId, quantity] of plan) {
      if (!quantity) continue;
      const tile = byId.get(tileId);
      if (!tile) continue;

      const occurredAt = new Date(`${localDate}T12:30:00`).toISOString();
      rows.push({
        id: `seed-${localDate}-${tileId}`,
        tileId: tile.id,
        categorySlug: tile.categorySlug,
        name: tile.name,
        unitAmountMinor: tile.defaultAmountMinor,
        quantity,
        totalAmountMinor: tile.defaultAmountMinor * quantity,
        occurredAt,
        localDate,
        localMonth: toLocalMonth(fromLocalDate(localDate)),
        source: "tap",
        pendingSync: false,
        deletedAt: null,
      });
    }
  });

  return rows;
};

/** "YYYY-MM-DD" for `day` of next month — where a monthly rule next falls due. */
const nextMonthOn = (day: number): string => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, day);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
};

export const createInitialState = (): TallyState => {
  const tiles = seedTiles();
  const expenses = seedExpenses(tiles);

  // Reflect the seeded history in the usage counts so the pad's
  // frequency ordering is meaningful from the start.
  const usage = new Map<string, number>();
  for (const e of expenses) {
    if (e.tileId) usage.set(e.tileId, (usage.get(e.tileId) ?? 0) + e.quantity);
  }

  return {
    profile: {
      email: "",
      displayName: "",
      currency: "BDT",
      appearance: "system",
      signedIn: false,
      authProvider: null,
      onboardingCompleted: false,
      totalTaps: expenses.reduce((sum, e) => sum + e.quantity, 0),
    },
    settings: { strikeAt: 5, longPressMs: 430, pressDepth: 3 },
    categories: CATEGORIES,
    tiles: tiles.map((t) => ({ ...t, usageCount: usage.get(t.id) ?? 0 })),
    expenses,
    budgets: [
      {
        month: currentLocalMonth(),
        overallLimitMinor: 1_800_000, // ৳18,000
        categoryLimits: [
          { categorySlug: "food-drink", limitMinor: 500_000 },
          { categorySlug: "cigarettes", limitMinor: 400_000 },
          { categorySlug: "transport", limitMinor: 250_000 },
          { categorySlug: "bills-data", limitMinor: 200_000 },
        ],
      },
    ],
    habits: [
      {
        id: "habit-cig",
        tileId: "tile-cig",
        name: "Cigarettes",
        iconKey: "cig",
        unitAmountMinor: 1600,
        baselineDailyCount: 12,
        targetDailyCount: 8,
        whatIfDailyCount: 8,
        sortIndex: 0,
      },
      {
        id: "habit-tea",
        tileId: "tile-tea",
        name: "Tea",
        iconKey: "tea",
        unitAmountMinor: 2000,
        baselineDailyCount: 6,
        targetDailyCount: null,
        whatIfDailyCount: 4,
        sortIndex: 1,
      },
      {
        id: "habit-rick",
        tileId: "tile-rick",
        name: "Rickshaw",
        iconKey: "rick",
        unitAmountMinor: 5000,
        baselineDailyCount: 2,
        targetDailyCount: null,
        whatIfDailyCount: 1,
        sortIndex: 2,
      },
    ],
    goals: [
      {
        id: "goal-phone",
        title: "A new phone by March",
        note: "Four fewer a day puts the difference aside.",
        targetAmountMinor: 4_200_000,
        savedAmountMinor: 729_600,
        linkedHabitId: "habit-cig",
        reductionPerDay: 4,
        targetDate: null,
      },
    ],
    // Seeded as already run for the current month, so opening the app for the
    // first time doesn't immediately auto-log a month's rent into *today* and
    // send the daily ring to 2000%.
    recurring: [
      {
        id: "rec-rent",
        name: "Rent",
        categorySlug: "bills-data",
        amountMinor: 1_200_000,
        frequency: "monthly",
        dayOfMonth: 1,
        nextRunDate: nextMonthOn(1),
        lastRunDate: `${currentLocalMonth()}-01`,
        autoLog: true,
        isActive: true,
      },
      {
        id: "rec-net",
        name: "Internet",
        categorySlug: "bills-data",
        amountMinor: 120_000,
        frequency: "monthly",
        dayOfMonth: 5,
        nextRunDate: nextMonthOn(5),
        lastRunDate: `${currentLocalMonth()}-05`,
        autoLog: true,
        isActive: true,
      },
    ],
    online: true,
    hydrated: false,
  };
};
