"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import { toMinor } from "@/lib/money";
import { ICON_PATHS } from "@/lib/icons";
import type { IconKey } from "@/lib/types";
import type { TileEntry } from "@/lib/store/state";
import { TileArt } from "./TileArt";

const PICKABLE_ICONS = Object.keys(ICON_PATHS) as IconKey[];

/** Creating a custom tile: a name, how it logs, a price, an icon, a category. */
export function NewTileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useTally();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [entry, setEntry] = useState<TileEntry>("instant");
  const [iconKey, setIconKey] = useState<IconKey>("bag");
  const [categorySlug, setCategorySlug] = useState("other");

  const currency = state.profile.currency;
  const amountMinor = toMinor(amount, currency) ?? 0;

  // A fixed-price tile is meaningless without its price. One that asks every
  // time only needs a starting point, so an empty field is fine there.
  const canSave = name.trim().length > 0 && (entry === "prompt" || amountMinor > 0);

  const reset = () => {
    setName("");
    setAmount("");
    setEntry("instant");
    setIconKey("bag");
    setCategorySlug("other");
  };

  const save = () => {
    if (!canSave) return;
    const base = amountMinor > 0 ? amountMinor : 5000;

    dispatch({
      type: "ADD_TILE",
      tile: {
        name: name.trim(),
        iconKey,
        categorySlug,
        defaultAmountMinor: base,
        entry,
        // A fixed-price tile only needs a few multiples for the odd bulk buy.
        // One that asks every time needs a spread to choose from, so the
        // keypad is a fallback rather than the main road.
        presetAmountsMinor:
          entry === "instant"
            ? [base, base * 2, base * 5, base * 10]
            : [
                Math.round(base / 2),
                base,
                base * 2,
                base * 3,
                base * 5,
                base * 10,
              ],
        isArchived: false,
        isCustom: true,
      },
    });

    reset();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} label="New tile">
      <p className="mb-5 font-display text-title" style={{ color: "var(--text)" }}>
        New tile
      </p>

      <label
        className="mb-2 block text-eyebrow uppercase"
        style={{ color: "var(--muted)" }}
        htmlFor="tile-name"
      >
        What is it?
      </label>
      <input
        id="tile-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Groceries"
        className="mb-5 w-full rounded-card border px-4 py-3.5 text-label outline-none"
        style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--text)" }}
      />

      <p className="mb-2 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
        When you tap it
      </p>
      <div className="mb-5 flex flex-col gap-2">
        <EntryOption
          active={entry === "instant"}
          onSelect={() => setEntry("instant")}
          title="Log it straight away"
          detail="For things that cost the same every time — one tap and it's recorded."
        />
        <EntryOption
          active={entry === "prompt"}
          onSelect={() => setEntry("prompt")}
          title="Ask how much"
          detail="For things that vary. Opens a keypad with your usual amounts."
        />
      </div>

      <label
        className="mb-2 block text-eyebrow uppercase"
        style={{ color: "var(--muted)" }}
        htmlFor="tile-amount"
      >
        {entry === "instant" ? "What does it cost?" : "Roughly how much? (optional)"}
      </label>
      <input
        id="tile-amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="20"
        inputMode="decimal"
        className="mb-5 w-full rounded-card border px-4 py-3.5 font-mono text-label tabular-nums outline-none"
        style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--text)" }}
      />

      <p className="mb-2 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
        Icon
      </p>
      <div data-scroll className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {PICKABLE_ICONS.map((key) => {
          const active = key === iconKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setIconKey(key)}
              aria-label={`Use ${key} artwork`}
              aria-pressed={active}
              className="flex size-14 shrink-0 items-center justify-center rounded-card border transition-colors"
              style={{
                background: active ? "var(--sky)" : "var(--bg)",
                borderColor: active ? "var(--blue)" : "var(--line)",
              }}
            >
              <TileArt iconKey={key} size={40} />
            </button>
          );
        })}
      </div>

      <p className="mb-2 text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
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
              className="tap-target rounded-pill border px-4 py-2.5 text-meta font-medium transition-colors"
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
        className="w-full rounded-card py-4 text-label font-semibold transition-all duration-[--dur-fast] active:scale-[0.99] disabled:opacity-40"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        Add tile
      </button>
    </Sheet>
  );
}

function EntryOption({
  active,
  onSelect,
  title,
  detail,
}: {
  active: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="flex items-start gap-3 rounded-card border p-3.5 text-left transition-colors"
      style={{
        background: active ? "var(--sky)" : "transparent",
        // Constant width, colour-only change: switching between 1 and 1.5px
        // relayouts the row and makes the options twitch as you compare them.
        border: `1.5px solid ${active ? "var(--blue)" : "var(--line)"}`,
      }}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill"
        style={{
          background: active ? "var(--blue)" : "transparent",
          border: active ? "none" : "1.5px solid var(--line)",
        }}
      >
        {active && <Icon name="check" size={12} strokeWidth={3} color="#FFFFFF" />}
      </span>
      <span>
        <span
          className="block text-body font-medium"
          style={{ color: active ? "var(--blue)" : "var(--text)" }}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-caption" style={{ color: "var(--muted)" }}>
          {detail}
        </span>
      </span>
    </button>
  );
}

export default NewTileSheet;
