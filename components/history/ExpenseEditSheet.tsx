"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import { toMinor } from "@/lib/money";
import type { LocalExpense } from "@/lib/store/state";

interface ExpenseEditSheetProps {
  expense: LocalExpense | null;
  onClose: () => void;
  allowDelete?: boolean;
}

/** Shared by History and a variable-price tile's long-press flow. */
export function ExpenseEditSheet({
  expense,
  onClose,
  allowDelete = false,
}: ExpenseEditSheetProps) {
  if (!expense) return null;
  return (
    <ExpenseEditor
      key={expense.id}
      expense={expense}
      onClose={onClose}
      allowDelete={allowDelete}
    />
  );
}

function ExpenseEditor({
  expense,
  onClose,
  allowDelete,
}: {
  expense: LocalExpense;
  onClose: () => void;
  allowDelete: boolean;
}) {
  const { state, dispatch } = useTally();
  const [name, setName] = useState(expense.name);
  const [amount, setAmount] = useState(String(expense.unitAmountMinor / 100));
  const [quantity, setQuantity] = useState(expense.quantity);
  const currency = state.profile.currency;

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

  const remove = () => {
    dispatch({ type: "DELETE_EXPENSE", expenseId: expense.id });
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

      <p className="mb-2 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
        Quantity
      </p>
      <div
        className="mb-6 flex items-center justify-between rounded-card border px-2.5 py-2"
        style={{ borderColor: "var(--line)" }}
      >
        <button
          type="button"
          onClick={() => setQuantity((current) => Math.max(1, current - 1))}
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
          onClick={() => setQuantity((current) => current + 1)}
          aria-label="One more"
          className="flex size-10 items-center justify-center rounded-card"
          style={{ background: "var(--bg)" }}
        >
          <Icon name="plus" size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="flex gap-2.5">
        {allowDelete && (
          <button
            type="button"
            onClick={remove}
            className="rounded-card border px-5 py-4 text-label font-medium"
            style={{ borderColor: "var(--line)", color: "var(--amber-text)" }}
          >
            Remove
          </button>
        )}
        <button
          type="button"
          onClick={save}
          className="flex-1 rounded-card py-4 text-label font-semibold"
          style={{ background: "var(--blue)", color: "#FFFFFF" }}
        >
          Save changes
        </button>
      </div>
    </Sheet>
  );
}

export default ExpenseEditSheet;
