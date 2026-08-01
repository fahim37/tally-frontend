import type { LocalCategory } from "./store/state";
import { toMinor } from "./money";
import type { IconKey } from "./types";

/**
 * Plain-language expense parsing — "lunch 250 and 40 rickshaw".
 *
 * This is the local parser. It runs on every keystroke so the Type tab stays
 * responsive and, crucially, keeps working with no network: an offline user can
 * still type an expense and log it. When the connection is up, the AI endpoint
 * refines the same input (better at odd phrasing, multiple currencies, implied
 * quantities) and its result replaces this one — but the user is never blocked
 * waiting for it.
 *
 * Category assignment is always keyword lookup, never the model, matching the
 * backend rule.
 */

export interface ParsedItem {
  key: string;
  /** Cleaned label, title-cased for display. */
  name: string;
  amountMinor: number | null;
  quantity: number;
  categorySlug: string;
  categoryName: string;
  iconKey: IconKey;
  /** False when no keyword matched, so the UI can offer a category picker. */
  matched: boolean;
}

/** Words that carry no meaning for matching and shouldn't survive into a label. */
const NOISE =
  /\b(taka|tk|bdt|rs|rupees?|for|on|at|spent|paid|of|the|a|an|some|today|yesterday|and)\b/gi;

/** Splits on connectives, so one line can hold several expenses. */
const SPLIT = /\s+and\s+|\s*[,;+&]\s*|\s+plus\s+/i;

/** "2x tea", "3 teas", "tea x2" — a leading or trailing multiplier. */
const LEADING_QTY = /^(\d+)\s*[x×]\s*/i;
const TRAILING_QTY = /\s*[x×]\s*(\d+)$/i;

const titleCase = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Longest keyword wins, and matching is word-boundary aware so "cha" can't
 * fire inside "charger". Mirrors matchCategory in the backend.
 */
export const matchCategory = (
  label: string,
  categories: LocalCategory[]
): { slug: string; matched: boolean } => {
  const text = label.toLowerCase().trim();
  if (!text) return { slug: "other", matched: false };

  let bestSlug = "other";
  let bestLength = 0;

  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (keyword.length <= bestLength) continue;
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(text)) {
        bestSlug = category.slug;
        bestLength = keyword.length;
      }
    }
  }

  return { slug: bestSlug, matched: bestLength > 0 };
};

export const parseExpenseText = (
  text: string,
  categories: LocalCategory[],
  currency = "BDT"
): ParsedItem[] => {
  const source = String(text ?? "").trim();
  if (!source) return [];

  return source
    .split(SPLIT)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => {
      let working = chunk;
      let quantity = 1;

      // Pull an explicit multiplier off either end before touching the amount,
      // so "2x tea 20" reads as two teas at 20, not a quantity of 220.
      const leading = working.match(LEADING_QTY);
      if (leading) {
        quantity = Math.max(1, Number(leading[1]));
        working = working.replace(LEADING_QTY, "");
      } else {
        const trailing = working.match(TRAILING_QTY);
        if (trailing) {
          quantity = Math.max(1, Number(trailing[1]));
          working = working.replace(TRAILING_QTY, "");
        }
      }

      // The amount is the last number in the chunk — "lunch 250" and "250
      // lunch" both mean the same thing, and a trailing number is the more
      // common shape.
      const numbers = working.match(/\d+(?:\.\d+)?/g);
      const amountText = numbers?.[numbers.length - 1] ?? null;
      const amountMinor = amountText ? toMinor(amountText, currency) : null;

      const label = working
        .replace(/[৳₹$£€]/g, " ")
        .replace(/\d+(?:\.\d+)?/g, " ")
        .replace(NOISE, " ")
        .replace(/\s+/g, " ")
        .trim();

      const { slug, matched } = matchCategory(label || chunk, categories);
      const category =
        categories.find((c) => c.slug === slug) ?? categories[categories.length - 1];

      return {
        key: `parsed-${index}`,
        name: label ? titleCase(label) : "Expense",
        amountMinor,
        quantity,
        categorySlug: category.slug,
        categoryName: category.name,
        iconKey: category.iconKey,
        matched,
      };
    })
    // A chunk with neither a label nor an amount is punctuation, not an expense.
    .filter((item) => item.amountMinor !== null || item.name !== "Expense");
};

export const parsedTotalMinor = (items: ParsedItem[]): number =>
  items.reduce((total, item) => total + (item.amountMinor ?? 0) * item.quantity, 0);
