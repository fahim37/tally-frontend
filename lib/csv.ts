import type { LocalCategory, LocalExpense } from "./store/state";
import { toMajor } from "./money";

/**
 * CSV export.
 *
 * Amounts are written as decimal major units rather than the stored integers,
 * because the file's audience is a spreadsheet, not this app. The conversion
 * happens once, here, at the boundary.
 */

/** RFC 4180 quoting: wrap when the value could break the row, double inner quotes. */
const cell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const HEADERS = [
  "Date",
  "Time",
  "Name",
  "Category",
  "Quantity",
  "Unit amount",
  "Total",
  "Currency",
  "Source",
  "Merchant",
  "Note",
];

export const toCsv = (
  expenses: LocalExpense[],
  categories: LocalCategory[],
  currency: string
): string => {
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

  const rows = expenses
    .filter((expense) => !expense.deletedAt)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((expense) => {
      const time = new Date(expense.occurredAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });

      return [
        expense.localDate,
        time,
        expense.name,
        categoryName.get(expense.categorySlug) ?? expense.categorySlug,
        expense.quantity,
        toMajor(expense.unitAmountMinor, currency).toFixed(2),
        toMajor(expense.totalAmountMinor, currency).toFixed(2),
        currency,
        expense.source,
        expense.merchant ?? "",
        expense.note ?? "",
      ]
        .map(cell)
        .join(",");
    });

  return [HEADERS.join(","), ...rows].join("\r\n");
};

/** Triggers a download of `csv` as a dated file. */
export const downloadCsv = (csv: string, filename: string): void => {
  // The BOM makes Excel read it as UTF-8, so ৳ and names survive the trip.
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};
