"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon, SearchIcon } from "@/components/ui/Icon";
import { TallyMarks } from "@/components/ui/TallyMarks";
import { Sheet } from "@/components/ui/Sheet";
import { SwipeRow } from "./SwipeRow";
import { useTally } from "@/lib/store/TallyProvider";
import { useToast } from "@/components/ui/Toast";
import { historyDays } from "@/lib/store/selectors";
import { formatMoney, toMinor } from "@/lib/money";
import { toCsv, downloadCsv } from "@/lib/csv";
import { todayLocalDate } from "@/lib/date";
import type { LocalExpense } from "@/lib/store/state";

export function History() {
  const { state, dispatch } = useTally();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [editing, setEditing] = useState<LocalExpense | null>(null);

  const currency = state.profile.currency;

  // Deferred so typing in the search box stays responsive: the filter runs a
  // full pass over every expense, rebuilds the day map and re-sorts each day's
  // rows, and doing that synchronously per keystroke is what makes the field
  // feel laggy on a long history.
  const deferredSearch = useDeferredValue(search);

  // Keyed on the expenses and categories rather than the whole state object.
  // With `state` as the dependency this recomputed on *every* dispatch in the
  // app — including every tap on the home screen, which cannot affect this
  // list's contents at all.
  const days = useMemo(
    () => historyDays(state, { search: deferredSearch, categorySlug }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.expenses, state.categories, deferredSearch, categorySlug]
  );

  const iconFor = (slug: string) =>
    state.categories.find((c) => c.slug === slug)?.iconKey ?? "bag";

  const remove = (expense: LocalExpense) => {
    dispatch({ type: "DELETE_EXPENSE", expenseId: expense.id });
    toast(`${expense.name} deleted`, {
      actionLabel: "Undo",
      onAction: () => dispatch({ type: "RESTORE_EXPENSE", expenseId: expense.id }),
    });
  };

  const exportCsv = () => {
    const csv = toCsv(state.expenses, state.categories, currency);
    downloadCsv(csv, `tally-${todayLocalDate()}.csv`);
    toast("Exported to CSV");
  };

  const isEmpty = days.length === 0;
  const isFiltered = search.trim().length > 0 || categorySlug !== null;

  return (
    <div className="flex flex-col px-5 pb-8 pt-6">
      <PageHeader
        title="History"
        action={
          <button
            type="button"
            onClick={exportCsv}
            className="tap-target rounded-pill border px-3 py-2 text-meta font-medium"
            style={{ borderColor: "var(--line)", color: "var(--text)" }}
          >
            Export CSV
          </button>
        }
      />

      {/* Search */}
      <label
        htmlFor="history-search"
        className="mb-3 flex cursor-text items-center gap-2.5 rounded-card border px-3.5 py-3"
        style={{ background: "var(--surf)", borderColor: "var(--line)" }}
      >
        <span style={{ color: "var(--faint)" }}>
          <SearchIcon size={16} />
        </span>
        <input
          id="history-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search expenses"
          aria-label="Search expenses"
          className="min-w-0 flex-1 bg-transparent text-label outline-none"
          style={{ color: "var(--text)" }}
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
            <Icon name="plus" size={16} strokeWidth={2} className="rotate-45" />
          </button>
        )}
      </label>

      {/* Category filters */}
      <div data-scroll className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[{ slug: null, name: "All" }, ...state.categories].map((category) => {
          const active = categorySlug === category.slug;
          return (
            <button
              key={category.slug ?? "all"}
              type="button"
              onClick={() => setCategorySlug(category.slug)}
              aria-pressed={active}
              className="tap-target shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-2 text-meta font-medium"
              style={{
                background: active ? "var(--sky)" : "transparent",
                borderColor: active ? "var(--blue)" : "var(--line)",
                color: active ? "var(--blue)" : "var(--muted)",
              }}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      {isEmpty ? (
        <EmptyState filtered={isFiltered} onClear={() => { setSearch(""); setCategorySlug(null); }} />
      ) : (
        <div className="flex flex-col gap-5">
          {days.map((day) => (
            /* `list-section` (globals.css) applies content-visibility: auto
               with an intrinsic size, so off-screen days skip layout and
               paint. A year of daily logging is ~1,000 swipe rows and ~8,000
               DOM nodes; without this the browser lays all of them out on
               every render of this screen. */
            <section key={day.localDate} className="list-section">
              <div className="flex items-center gap-2.5 px-0.5 pb-2.5 pt-2">
                <span className="text-meta font-semibold" style={{ color: "var(--text)" }}>
                  {day.label}
                </span>
                <span className="text-meta" style={{ color: "var(--faint)" }}>
                  {day.dateLabel}
                </span>
                <span className="flex-1" style={{ color: "var(--blue)" }}>
                  <TallyMarks
                    count={day.markCount}
                    strikeAt={state.settings.strikeAt}
                    height={10}
                  />
                </span>
                <span
                  className="font-mono text-body font-semibold tabular-nums"
                  style={{ color: "var(--text)" }}
                >
                  {formatMoney(day.totalMinor, currency)}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {day.rows.map((row) => (
                  <SwipeRow
                    key={row.id}
                    label={row.name}
                    onEdit={() => setEditing(row)}
                    onDelete={() => remove(row)}
                  >
                    <div
                      className="flex items-center gap-3 rounded-card border px-3.5 py-3"
                      style={{ background: "var(--surf)", borderColor: "var(--line)" }}
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-card"
                        style={{ background: "var(--bg)", color: "var(--muted)" }}
                      >
                        <Icon name={iconFor(row.categorySlug)} size={18} strokeWidth={1.6} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className="block text-label font-medium leading-tight"
                          style={{ color: "var(--text)" }}
                        >
                          {row.name}
                        </span>
                        <span
                          className="mt-1 block truncate text-caption"
                          style={{ color: "var(--muted)" }}
                        >
                          {state.categories.find((c) => c.slug === row.categorySlug)?.name}
                          {row.quantity > 1 && ` · ×${row.quantity}`}
                          {row.merchant && ` · ${row.merchant}`}
                          {row.pendingSync && " · waiting to sync"}
                        </span>
                      </span>

                      <span
                        className="font-mono text-label font-medium tabular-nums"
                        style={{ color: "var(--text)" }}
                      >
                        {formatMoney(row.totalAmountMinor, currency)}
                      </span>
                    </div>
                  </SwipeRow>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <EditSheet expense={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  if (filtered) {
    return (
      <div className="py-16 text-center">
        <p className="text-label font-medium" style={{ color: "var(--text)" }}>
          Nothing matches that.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="mt-3 text-body font-medium"
          style={{ color: "var(--blue)" }}
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start py-14">
      <div className="mb-6 flex items-center gap-2" style={{ color: "var(--line)" }}>
        <span className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="w-[2.5px] rounded-xs" style={{ height: 34, background: "currentColor" }} />
          ))}
        </span>
        <span
          className="ml-2 w-[2.5px] rounded-xs"
          style={{ height: 34, background: "var(--blue)" }}
        />
      </div>

      <h2
        className="mb-3 max-w-[270px] font-display text-display"
        style={{ color: "var(--text)" }}
      >
        Nothing logged yet.
      </h2>
      <p className="mb-6 max-w-[290px] text-label leading-[1.55]" style={{ color: "var(--muted)" }}>
        Tap a tile once and the first mark lands here. Four marks then a strike-through, the
        way you&apos;d keep score on paper.
      </p>

      <Link
        href="/"
        className="inline-flex items-center gap-2.5 rounded-card px-5 py-4 text-label font-semibold"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        <Icon name="plus" size={18} strokeWidth={2} />
        Log your first expense
      </Link>
    </div>
  );
}

function EditSheet({ expense, onClose }: { expense: LocalExpense | null; onClose: () => void }) {
  const { state, dispatch } = useTally();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const currency = state.profile.currency;

  // Load the row's values once per expense, without an effect: comparing the
  // id to what's loaded is enough, and it avoids a render-then-sync flash.
  if (expense && expense.id !== loadedId) {
    setLoadedId(expense.id);
    setName(expense.name);
    setAmount(String(expense.unitAmountMinor / 100));
    setQuantity(expense.quantity);
  }

  if (!expense) return null;

  const save = () => {
    const unit = toMinor(amount, currency);
    dispatch({
      type: "UPDATE_EXPENSE",
      expenseId: expense.id,
      patch: {
        name: name.trim() || expense.name,
        unitAmountMinor: unit ?? expense.unitAmountMinor,
        quantity: Math.max(1, quantity),
      },
    });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} label={`Edit ${expense.name}`}>
      <p className="mb-5 font-display text-title" style={{ color: "var(--text)" }}>
        Edit expense
      </p>

      <label
        className="mb-2 block text-eyebrow uppercase"
        style={{ color: "var(--muted)" }}
        htmlFor="edit-name"
      >
        What was it?
      </label>
      <input
        id="edit-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="mb-4 w-full rounded-card border px-3.5 py-3.5 text-label outline-none"
        style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--text)" }}
      />

      <label
        className="mb-2 block text-eyebrow uppercase"
        style={{ color: "var(--muted)" }}
        htmlFor="edit-amount"
      >
        Amount each
      </label>
      <input
        id="edit-amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        inputMode="decimal"
        className="mb-4 w-full rounded-card border px-3.5 py-3.5 font-mono text-label tabular-nums outline-none"
        style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--text)" }}
      />

      <p
        className="mb-2 text-eyebrow uppercase"
        style={{ color: "var(--muted)" }}
      >
        Quantity
      </p>
      <div
        className="mb-6 flex items-center justify-between rounded-card border px-2.5 py-2"
        style={{ borderColor: "var(--line)" }}
      >
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          aria-label="One fewer"
          className="flex size-10 items-center justify-center rounded-card"
          style={{ background: "var(--bg)" }}
        >
          <Icon name="minus" size={18} strokeWidth={2} />
        </button>
        <span
          className="font-display text-display tabular-nums"
          style={{ color: "var(--text)" }}
        >
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => setQuantity((q) => q + 1)}
          aria-label="One more"
          className="flex size-10 items-center justify-center rounded-card"
          style={{ background: "var(--bg)" }}
        >
          <Icon name="plus" size={18} strokeWidth={2} />
        </button>
      </div>

      <button
        type="button"
        onClick={save}
        className="w-full rounded-card py-4 text-label font-semibold"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        Save changes
      </button>
    </Sheet>
  );
}

export default History;
