"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import { toMinor } from "@/lib/money";
import { ICON_PATHS } from "@/lib/icons";
import type { IconKey } from "@/lib/types";

const PICKABLE_ICONS = Object.keys(ICON_PATHS) as IconKey[];

/** Creating a custom tile: a name, a price, an icon, a category. Nothing else. */
export function NewTileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useTally();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [iconKey, setIconKey] = useState<IconKey>("bag");
  const [categorySlug, setCategorySlug] = useState("other");

  const currency = state.profile.currency;
  const amountMinor = toMinor(amount, currency) ?? 0;
  const canSave = name.trim().length > 0 && amountMinor > 0;

  const save = () => {
    if (!canSave) return;
    dispatch({
      type: "ADD_TILE",
      tile: {
        name: name.trim(),
        iconKey,
        categorySlug,
        defaultAmountMinor: amountMinor,
        // Same ladder the seeded tiles use: base, ×2, ×5, ×10.
        presetAmountsMinor: [amountMinor, amountMinor * 2, amountMinor * 5, amountMinor * 10],
        isArchived: false,
        isCustom: true,
      },
    });
    setName("");
    setAmount("");
    setIconKey("bag");
    setCategorySlug("other");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} label="New tile">
      <p className="mb-5 font-display text-[20px] font-semibold" style={{ color: "var(--text)" }}>
        New tile
      </p>

      <label
        className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--muted)" }}
        htmlFor="tile-name"
      >
        What is it?
      </label>
      <input
        id="tile-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Paratha"
        className="mb-4 w-full rounded-[13px] border px-3.5 py-3.5 text-[15px] outline-none"
        style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--text)" }}
      />

      <label
        className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--muted)" }}
        htmlFor="tile-amount"
      >
        What does it cost?
      </label>
      <input
        id="tile-amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="20"
        inputMode="decimal"
        className="mb-4 w-full rounded-[13px] border px-3.5 py-3.5 font-mono text-[15px] tabular-nums outline-none"
        style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--text)" }}
      />

      <p
        className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--muted)" }}
      >
        Icon
      </p>
      <div data-scroll className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {PICKABLE_ICONS.map((key) => {
          const active = key === iconKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setIconKey(key)}
              aria-label={key}
              aria-pressed={active}
              className="flex size-11 shrink-0 items-center justify-center rounded-[13px] border"
              style={{
                background: active ? "var(--sky)" : "var(--bg)",
                borderColor: active ? "var(--blue)" : "var(--line)",
                color: active ? "var(--blue)" : "var(--muted)",
              }}
            >
              <Icon name={key} size={20} strokeWidth={1.6} />
            </button>
          );
        })}
      </div>

      <p
        className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--muted)" }}
      >
        Category
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        {state.categories.map((category) => {
          const active = category.slug === categorySlug;
          return (
            <button
              key={category.slug}
              type="button"
              onClick={() => setCategorySlug(category.slug)}
              aria-pressed={active}
              className="tap-target rounded-pill border px-3 py-2 text-[12px] font-medium"
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

      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="w-full rounded-[14px] py-4 text-[15px] font-semibold disabled:opacity-40"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        Add tile
      </button>
    </Sheet>
  );
}

export default NewTileSheet;
