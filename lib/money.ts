/**
 * Client-side mirror of tally-backend/utils/money.js. Amounts arrive from the
 * API as integer minor units and stay that way through state and props — this
 * module is the only place they become a string.
 */

export interface Currency {
  code: string;
  symbol: string;
  minorDigits: number;
  locale: string;
}

export const CURRENCIES: Record<string, Currency> = {
  BDT: { code: "BDT", symbol: "৳", minorDigits: 2, locale: "en-IN" },
  INR: { code: "INR", symbol: "₹", minorDigits: 2, locale: "en-IN" },
  USD: { code: "USD", symbol: "$", minorDigits: 2, locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", minorDigits: 2, locale: "en-IE" },
  GBP: { code: "GBP", symbol: "£", minorDigits: 2, locale: "en-GB" },
  PKR: { code: "PKR", symbol: "₨", minorDigits: 2, locale: "en-PK" },
  LKR: { code: "LKR", symbol: "Rs", minorDigits: 2, locale: "en-LK" },
  NPR: { code: "NPR", symbol: "रू", minorDigits: 2, locale: "en-NP" },
};

export const DEFAULT_CURRENCY = "BDT";

export const getCurrency = (code = DEFAULT_CURRENCY): Currency =>
  CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];

export const minorFactor = (code = DEFAULT_CURRENCY): number =>
  10 ** getCurrency(code).minorDigits;

export const toMinor = (value: string | number, code = DEFAULT_CURRENCY): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const numeric =
    typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * minorFactor(code));
};

export const toMajor = (minor: number, code = DEFAULT_CURRENCY): number =>
  Number.isFinite(minor) ? minor / minorFactor(code) : 0;

/**
 * "৳442" — whole amounts drop the decimals, matching the design. Fractional
 * amounts keep both digits so money never renders as "৳1,250.5".
 */
export const formatMoney = (
  minor: number | null | undefined,
  code = DEFAULT_CURRENCY,
  { withSymbol = true }: { withSymbol?: boolean } = {}
): string => {
  const currency = getCurrency(code);
  const value = minor ?? 0;
  const hasFraction = value % minorFactor(code) !== 0;

  const body = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: hasFraction ? currency.minorDigits : 0,
    maximumFractionDigits: currency.minorDigits,
  }).format(toMajor(value, code));

  return withSymbol ? `${currency.symbol}${body}` : body;
};

/**
 * Splits a formatted amount into the pieces the rolling-odometer total needs:
 * each digit gets its own column, separators render as static glyphs.
 * Mirrors the `totalDigits` structure in the design board's logic.
 */
export interface TotalDigit {
  key: string;
  char: string;
  isDigit: boolean;
  /** Column offset for the 0–9 strip, e.g. "translateY(-4em)". */
  shift: string;
}

export const toTotalDigits = (
  minor: number,
  code = DEFAULT_CURRENCY
): TotalDigit[] =>
  formatMoney(minor, code, { withSymbol: false })
    .split("")
    .map((char, i) => {
      const isDigit = /[0-9]/.test(char);
      return {
        key: `d${i}`,
        char,
        isDigit,
        shift: `translateY(-${isDigit ? Number(char) : 0}em)`,
      };
    });

/**
 * Tally marks: groups of `strikeAt` where the last stroke crosses the group.
 * Four-then-a-strike is the default, as on paper.
 */
export interface TallyGroup {
  key: number;
  full: boolean;
  bars: number[];
}

export const toTallyGroups = (count: number, strikeAt = 5): TallyGroup[] => {
  const groups: TallyGroup[] = [];
  let remaining = Math.max(0, Math.floor(count));
  let key = 0;

  while (remaining >= strikeAt) {
    groups.push({
      key: key++,
      full: true,
      bars: Array.from({ length: strikeAt - 1 }, (_, i) => i),
    });
    remaining -= strikeAt;
  }
  if (remaining > 0) {
    groups.push({
      key: key++,
      full: false,
      bars: Array.from({ length: remaining }, (_, i) => i),
    });
  }
  return groups;
};

export const ratioOf = (spentMinor: number, limitMinor: number): number =>
  limitMinor > 0 ? spentMinor / limitMinor : 0;
