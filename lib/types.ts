/**
 * Shapes returned by the Tally API. These mirror the Mongoose models in
 * tally-backend/models — when a schema changes, this file changes with it.
 *
 * Money rule, everywhere: fields ending `Minor` are integers in the smallest
 * currency unit (poisha for BDT). Never render one directly — pass it through
 * `formatMoney` in lib/money.ts.
 */

// ── Envelope ───────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors?: { field: string; message: string }[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// ── Primitives ─────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" in the user's timezone. */
export type LocalDate = string;
/** "YYYY-MM" in the user's timezone. */
export type LocalMonth = string;
/** ISO week key, "2026-W31". */
export type WeekKey = string;

export type IconKey =
  | "tea"
  | "cig"
  | "rick"
  | "lunch"
  | "data"
  | "coffee"
  | "bag"
  | "bill"
  | "grocery"
  | "medicine"
  | "fuel"
  | "phone"
  | "gift"
  | "home";

export type ExpenseSource = "tap" | "manual" | "parsed" | "scanned" | "recurring";
export type CategorySource = "tile" | "keyword" | "ai" | "user" | "fallback";
export type Appearance = "light" | "dark" | "system";

// ── Models ─────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatarUrl?: string;
  currency: string;
  timezone: string;
  appearance: Appearance;
  hasPassword: boolean;
  authProviders: ("email" | "google")[];
  onboarding: {
    completed: boolean;
    step: 1 | 2 | 3;
    completedAt: string | null;
  };
  stats: {
    totalTaps: number;
    currentStreak: number;
    longestStreak: number;
    lastLoggedDate: LocalDate | null;
    firstLoggedDate: LocalDate | null;
  };
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  colorToken: string;
  colorHex: string;
  iconKey: IconKey;
  keywords: string[];
  isSystem: boolean;
  isArchived: boolean;
  sortIndex: number;
}

export interface Tile {
  id: string;
  name: string;
  iconKey: IconKey;
  category: Category | string;
  defaultAmountMinor: number;
  presetAmountsMinor: number[];
  usageCount: number;
  lastUsedAt: string | null;
  sortIndex: number;
  isPinned: boolean;
  isCustom: boolean;
  isArchived: boolean;
  seedKey: string | null;
  /** Today's logged quantity — served with the Tap Pad so tiles render tallies. */
  todayCount?: number;
}

export interface Expense {
  id: string;
  tile: string | null;
  category: Category | string;
  name: string;
  note?: string;
  merchant?: string;
  unitAmountMinor: number;
  quantity: number;
  totalAmountMinor: number;
  currency: string;
  occurredAt: string;
  localDate: LocalDate;
  localMonth: LocalMonth;
  source: ExpenseSource;
  origin?: {
    receipt: string | null;
    recurringRule: string | null;
    rawText: string | null;
    categorySource: CategorySource;
    confidence: number | null;
  };
  clientId?: string | null;
  createdAt: string;
}

export interface Budget {
  id: string;
  month: LocalMonth;
  overallLimitMinor: number;
  categoryLimits: { category: Category | string; limitMinor: number }[];
  currency: string;
  rollForward: boolean;
}

export interface Habit {
  id: string;
  tile: string;
  name: string;
  unitAmountMinor: number;
  baselineDailyCount: number;
  targetDailyCount: number | null;
  whatIfDailyCount: number | null;
  dailyCostMinor: number;
  monthlyCostMinor: number;
  yearlyCostMinor: number;
  streak: {
    current: number;
    longest: number;
    lastEvaluatedDate: LocalDate | null;
  };
  /** Today's count, for the 20-cell pack grid on the habit card. */
  todayCount?: number;
  sortIndex: number;
}

export interface Goal {
  id: string;
  title: string;
  note?: string;
  targetAmountMinor: number;
  savedAmountMinor: number;
  currency: string;
  linkedHabit: string | null;
  reductionPerDay: number | null;
  progressRatio: number;
  remainingMinor: number;
  startedAt: string;
  targetDate: string | null;
  achievedAt: string | null;
}

export interface RecurringRule {
  id: string;
  name: string;
  category: Category | string;
  amountMinor: number;
  currency: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  startDate: LocalDate;
  endDate: LocalDate | null;
  nextRunAt: string;
  lastRunAt: string | null;
  autoLog: boolean;
  isActive: boolean;
}

export interface ReceiptLineItem {
  id: string;
  label: string;
  amountMinor: number;
  quantity: number;
  categorySlug: string | null;
  confidence: number | null;
  isAccepted: boolean;
}

export interface Receipt {
  id: string;
  publicId: string;
  secureUrl: string;
  status: "uploaded" | "parsing" | "parsed" | "failed" | "confirmed";
  parsed: {
    merchant: string | null;
    totalMinor: number | null;
    currency: string | null;
    purchasedAt: string | null;
    lineItems: ReceiptLineItem[];
  };
  reconciliationDeltaMinor: number | null;
  expenses: string[];
  confirmedAt: string | null;
}

export interface Insight {
  id: string;
  kind: "weekly_summary" | "forecast" | "anomaly" | "qa";
  periodKey: string;
  content: {
    headline: string | null;
    sentences: string[];
    data: Record<string, unknown>;
  };
  question?: string | null;
  feedback: "helpful" | "not_helpful" | null;
  generatedAt: string;
}

// ── Derived / view payloads ────────────────────────────────────────────────

/** Everything the home screen needs in one request. */
export interface TapPadPayload {
  tiles: Tile[];
  recent: Tile[];
  today: {
    localDate: LocalDate;
    totalMinor: number;
    dailyAllowanceMinor: number;
    remainingMinor: number;
    ringRatio: number;
  };
}

export interface DashboardPayload {
  today: { totalMinor: number; deltaVsAllowanceMinor: number };
  month: {
    key: LocalMonth;
    spentMinor: number;
    limitMinor: number;
    dayOfMonth: number;
    daysInMonth: number;
  };
  previousMonth: { key: LocalMonth; spentToSamePointMinor: number };
  trend: { localDate: LocalDate; totalMinor: number }[];
  categories: {
    category: Category;
    totalMinor: number;
    ratio: number;
  }[];
  heatmap: { localDate: LocalDate; totalMinor: number; level: 0 | 1 | 2 | 3 | 4 }[];
  topDrivers: { name: string; totalMinor: number; detail: string }[];
}

export interface HistoryDay {
  localDate: LocalDate;
  label: string;
  totalMinor: number;
  markCount: number;
  rows: Expense[];
}

/** One parsed candidate from the Type tab, before the user confirms. */
export interface ParsedDraft {
  key: string;
  name: string;
  amountMinor: number | null;
  quantity: number;
  categorySlug: string;
  categoryName: string;
  iconKey: IconKey;
  categorySource: CategorySource;
  confidence: number | null;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthPayload {
  user: User;
  tokens: AuthTokens;
}
