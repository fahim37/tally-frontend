/**
 * Client-side date helpers, mirroring tally-backend/utils/date.js.
 *
 * A "day" is the user's local day. These use the browser's own timezone via
 * Intl, so no date library is shipped to the client.
 */

export type LocalDate = string; // "YYYY-MM-DD"
export type LocalMonth = string; // "YYYY-MM"

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for a Date, in local time (never UTC — `toISOString` shifts). */
export const toLocalDate = (date: Date = new Date()): LocalDate =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const toLocalMonth = (date: Date = new Date()): LocalMonth =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const monthOf = (localDate: LocalDate): LocalMonth => localDate.slice(0, 7);

export const todayLocalDate = (): LocalDate => toLocalDate();
export const currentLocalMonth = (): LocalMonth => toLocalMonth();

/** Parses "YYYY-MM-DD" into a local-midnight Date. */
export const fromLocalDate = (localDate: LocalDate): Date => {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (localDate: LocalDate, days: number): LocalDate => {
  const date = fromLocalDate(localDate);
  date.setDate(date.getDate() + days);
  return toLocalDate(date);
};

export const diffInDays = (from: LocalDate, to: LocalDate): number =>
  Math.round(
    (fromLocalDate(to).getTime() - fromLocalDate(from).getTime()) / 86_400_000
  );

/** The N local dates ending today, oldest first — the 30-day trend axis. */
export const lastNLocalDates = (n: number): LocalDate[] => {
  const today = todayLocalDate();
  return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)));
};

export const daysInMonth = (month: LocalMonth): number => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

export const dayOfMonth = (localDate: LocalDate): number =>
  fromLocalDate(localDate).getDate();

export const previousMonth = (month: LocalMonth): LocalMonth => {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 2, 1);
  return toLocalMonth(date);
};

/** Monday = 0 … Sunday = 6, matching the heatmap's column order. */
export const weekdayIndex = (localDate: LocalDate): number =>
  (fromLocalDate(localDate).getDay() + 6) % 7;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Today" / "Yesterday" / "Sunday" — the History day heading. */
export const dayLabel = (localDate: LocalDate): string => {
  const today = todayLocalDate();
  if (localDate === today) return "Today";
  if (localDate === addDays(today, -1)) return "Yesterday";
  return DAY_NAMES[fromLocalDate(localDate).getDay()];
};

/** "18 Aug" — the secondary date on a History heading. */
export const shortDate = (localDate: LocalDate): string => {
  const date = fromLocalDate(localDate);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
};

/** "Mon 18 Aug" */
export const longDate = (localDate: LocalDate): string => {
  const date = fromLocalDate(localDate);
  return `${DAY_NAMES[date.getDay()].slice(0, 3)} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
};

/** "August" — the dashboard month picker label. */
export const monthLabel = (month: LocalMonth): string =>
  MONTH_FULL[Number(month.split("-")[1]) - 1];

export const monthShort = (month: LocalMonth): string =>
  MONTH_NAMES[Number(month.split("-")[1]) - 1];

/** "12–18 August" — the weekly insight heading. */
export const weekRangeLabel = (start: LocalDate, end: LocalDate): string => {
  const a = fromLocalDate(start);
  const b = fromLocalDate(end);
  const sameMonth = a.getMonth() === b.getMonth();
  return sameMonth
    ? `${a.getDate()}–${b.getDate()} ${MONTH_FULL[b.getMonth()]}`
    : `${a.getDate()} ${MONTH_NAMES[a.getMonth()]} – ${b.getDate()} ${MONTH_NAMES[b.getMonth()]}`;
};

/** Monday-anchored start of the week containing `localDate`. */
export const startOfWeek = (localDate: LocalDate): LocalDate =>
  addDays(localDate, -weekdayIndex(localDate));

/** "18:24" — the status bar clock. */
export const clockLabel = (date: Date = new Date()): string =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;
