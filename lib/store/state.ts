import type { IconKey } from "../types";
import type { LocalDate, LocalMonth } from "../date";

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

/**
 * How a tile behaves when it's tapped.
 *
 * Some things cost the same every single time — a cigarette, a bus fare — and
 * for those the whole point of the app is that one tap is the entire
 * interaction. Others ("food", "extras") are a category of spending whose
 * amount is different every time, and logging those at a fixed price would
 * just be recording a number nobody believes.
 *
 * So a tile declares which it is, and the pad does the right thing.
 */
export type TileEntry = "instant" | "prompt";

export interface LocalTile {
  id: string;
  name: string;
  iconKey: IconKey;
  categorySlug: string;
  /** For an "instant" tile this is what a tap logs. For a "prompt" tile it's
   *  only the amount the keypad opens pre-filled with. */
  defaultAmountMinor: number;
  presetAmountsMinor: number[];
  entry: TileEntry;
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
  /** The API's user id. Null until authenticated; also the key the persisted
   *  store is namespaced under, so two accounts on one device stay separate. */
  userId: string | null;
  email: string;
  displayName: string;
  currency: string;
  appearance: "light" | "dark" | "system";
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

/**
 * The account-owned state replicated between devices. Expense rows have their
 * own idempotent queue; runtime flags, authentication identity, and derived
 * usage counters deliberately stay out of this smaller snapshot.
 */
export interface SyncedProfile {
  displayName: string;
  currency: string;
  appearance: LocalProfile["appearance"];
  onboardingCompleted: boolean;
}

export type SyncedTile = Omit<LocalTile, "usageCount" | "lastUsedAt">;

export interface AccountSections {
  profile: SyncedProfile;
  settings: LocalSettings;
  categories: LocalCategory[];
  tiles: SyncedTile[];
  budgets: LocalBudget[];
  habits: LocalHabit[];
  goals: LocalGoal[];
  recurring: LocalRecurring[];
}

export type AccountSectionName = keyof AccountSections;

// ── Starting set ───────────────────────────────────────────────────────────
// The categories and their keyword tables, plus the tiles onboarding offers.
// Neither is user data: the keywords classify typed text without an AI call,
// and the tiles are a menu, not a history.

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

/**
 * The tiles a new account starts with.
 *
 * Four, not a screenful. One is a fixed-price thing you buy repeatedly, and
 * the other three are the broad buckets almost all day-to-day spending falls
 * into — because a tile you have to think about is a tile you won't tap.
 * Anything more specific is better added by the person who actually buys it.
 *
 * The split that matters is `entry`: Cigarette costs the same every time, so a
 * tap logs it and the interaction is over. Food, transport and extras vary
 * every time, so a tap asks how much — with the amounts you actually reach for
 * one press away.
 */
const STARTER_TILES: {
  id: string;
  name: string;
  iconKey: IconKey;
  categorySlug: string;
  amt: number;
  entry: TileEntry;
  presets: number[];
}[] = [
  {
    id: "tile-cig",
    name: "Cigarette",
    iconKey: "cig",
    categorySlug: "cigarettes",
    amt: 1600,
    entry: "instant",
    // Still offered on long-press, for when the price changes or a whole pack
    // gets bought at once.
    presets: [1600, 3200, 8000, 16000],
  },
  {
    id: "tile-food",
    name: "Food",
    iconKey: "lunch",
    categorySlug: "food-drink",
    amt: 5000,
    entry: "prompt",
    presets: [2000, 5000, 10000, 15000, 25000, 40000],
  },
  {
    id: "tile-transport",
    name: "Transport",
    iconKey: "rick",
    categorySlug: "transport",
    amt: 5000,
    entry: "prompt",
    presets: [2000, 3000, 5000, 8000, 12000, 20000],
  },
  {
    id: "tile-extras",
    name: "Extras",
    iconKey: "bag",
    categorySlug: "other",
    amt: 10000,
    entry: "prompt",
    presets: [5000, 10000, 20000, 50000, 100000, 200000],
  },
];

const seedTiles = (): LocalTile[] =>
  STARTER_TILES.map((t, i) => ({
    id: t.id,
    name: t.name,
    iconKey: t.iconKey,
    categorySlug: t.categorySlug,
    defaultAmountMinor: t.amt,
    presetAmountsMinor: t.presets,
    entry: t.entry,
    usageCount: 0,
    lastUsedAt: null,
    sortIndex: i,
    isArchived: false,
    isCustom: false,
  }));

/**
 * A brand-new account.
 *
 * Everything derived from behaviour starts empty — no expenses, no habits, no
 * goals, no budget, no recurring rules. The app used to fabricate 30 days of
 * history here so the charts had something to draw, which made every screen
 * look convincing and every number a lie. A first-run user now sees real
 * emptiness and the action that fills it.
 *
 * The tiles and categories are NOT data in that sense: they are the menu
 * onboarding step 2 offers ("What do you buy most days?"), and anything the
 * user doesn't pick is archived there. They start at zero usage.
 */
export const createInitialState = (): TallyState => ({
  profile: {
    userId: null,
    email: "",
    displayName: "",
    currency: "BDT",
    appearance: "system",
    signedIn: false,
    authProvider: null,
    onboardingCompleted: false,
    totalTaps: 0,
  },
  settings: { strikeAt: 5, longPressMs: 430, pressDepth: 3 },
  categories: CATEGORIES,
  tiles: seedTiles(),
  expenses: [],
  budgets: [],
  habits: [],
  goals: [],
  recurring: [],
  online: true,
  hydrated: false,
});
