"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import { useToast } from "@/components/ui/Toast";
import { formatMoney, toMinor } from "@/lib/money";
import { matchCategory } from "@/lib/parse";
import { todayLocalDate, toLocalMonth } from "@/lib/date";

interface ScanTabProps {
  onClose: () => void;
}

interface DraftLine {
  key: string;
  label: string;
  amountText: string;
  categorySlug: string;
  accepted: boolean;
}

/**
 * Receipt scanning.
 *
 * Reading a receipt is the one part of this flow that genuinely needs the
 * network, so the tab is explicit about it: offline, it offers manual entry
 * of the lines instead of pretending to scan. Either way nothing reaches the
 * ledger unreviewed — the read produces a draft the user edits and confirms,
 * because a misread total would quietly poison every chart downstream.
 */
export function ScanTab({ onClose }: ScanTabProps) {
  const { state, dispatch } = useTally();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "review" | "failed">("idle");
  const [merchant, setMerchant] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  const currency = state.profile.currency;

  const pickFile = (file: File | undefined) => {
    if (!file) return;

    setPreview(URL.createObjectURL(file));

    if (!state.online) {
      // No round trip available — go straight to a blank draft so the user can
      // still capture the receipt now and type what it said.
      setStatus("review");
      setLines([blankLine()]);
      return;
    }

    setStatus("reading");
    // The upload + Gemini read lands here once /receipts is live. Until then
    // the flow stops honestly rather than inventing line items.
    window.setTimeout(() => setStatus("failed"), 900);
  };

  const blankLine = (): DraftLine => ({
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: "",
    amountText: "",
    categorySlug: "other",
    accepted: true,
  });

  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        // Re-categorize as the label is typed — keyword lookup, no AI call.
        if (patch.label !== undefined) {
          next.categorySlug = matchCategory(patch.label, state.categories).slug;
        }
        return next;
      })
    );

  const total = lines
    .filter((line) => line.accepted)
    .reduce((sum, line) => sum + (toMinor(line.amountText, currency) ?? 0), 0);

  const commit = () => {
    const usable = lines.filter(
      (line) => line.accepted && line.label.trim() && toMinor(line.amountText, currency)
    );
    if (!usable.length) return;

    const now = new Date();
    dispatch({
      type: "ADD_EXPENSES",
      expenses: usable.map((line) => ({
        tileId: null,
        categorySlug: line.categorySlug,
        name: line.label.trim(),
        merchant: merchant.trim() || undefined,
        unitAmountMinor: toMinor(line.amountText, currency) as number,
        quantity: 1,
        totalAmountMinor: 0,
        occurredAt: now.toISOString(),
        localDate: todayLocalDate(),
        localMonth: toLocalMonth(now),
        source: "scanned" as const,
      })),
    });

    toast(`${usable.length} from receipt · ${formatMoney(total, currency)}`);
    onClose();
  };

  // ── Capture ──────────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <div>
        <div
          className="relative flex h-[240px] items-center justify-center overflow-hidden rounded-card"
          style={{ background: "#0B1220" }}
        >
          <div className="absolute inset-0" style={{ background: "linear-gradient(#151E31,#0B1220)" }} />
          {(["left top", "right top", "left bottom", "right bottom"] as const).map((corner) => {
            const [x, y] = corner.split(" ");
            return (
              <span
                key={corner}
                className="absolute size-[26px]"
                style={{
                  [x]: 44,
                  [y]: 34,
                  [`border${x === "left" ? "Left" : "Right"}`]: "2px solid #1B4DFF",
                  [`border${y === "top" ? "Top" : "Bottom"}`]: "2px solid #1B4DFF",
                  borderRadius:
                    corner === "left top"
                      ? "5px 0 0 0"
                      : corner === "right top"
                        ? "0 5px 0 0"
                        : corner === "left bottom"
                          ? "0 0 0 5px"
                          : "0 0 5px 0",
                } as React.CSSProperties}
              />
            );
          })}
          <p className="relative px-8 text-center text-body" style={{ color: "#B7C6FF" }}>
            Point at the receipt total.
          </p>
        </div>

        <p className="mt-4 text-center text-body leading-[1.5]" style={{ color: "var(--muted)" }}>
          {state.online
            ? "Tally reads the amount and the shop name. You check it before anything is logged."
            : "You're offline — capture it now and type the lines in yourself."}
        </p>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => pickFile(event.target.files?.[0])}
        />

        <div className="mt-5 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label="Choose a photo"
            className="flex size-11 items-center justify-center rounded-card border"
            style={{ borderColor: "var(--line)", color: "var(--muted)" }}
          >
            <Icon name="image" size={20} />
          </button>

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label="Take a photo"
            className="flex size-[70px] items-center justify-center rounded-pill"
            style={{ border: "3px solid var(--blue)" }}
          >
            <span className="block size-[52px] rounded-pill" style={{ background: "var(--blue)" }} />
          </button>

          <button
            type="button"
            onClick={() => {
              setStatus("review");
              setLines([blankLine()]);
            }}
            aria-label="Enter the lines by hand"
            className="flex size-11 items-center justify-center rounded-card border"
            style={{ borderColor: "var(--line)", color: "var(--muted)" }}
          >
            <Icon name="edit" size={20} />
          </button>
        </div>
      </div>
    );
  }

  // ── Reading ──────────────────────────────────────────────────────────────
  if (status === "reading") {
    return (
      <div className="py-14 text-center" aria-busy>
        {/* The keyframe lives in globals.css now. Declaring it in a <style>
            element inside the JSX re-parsed a stylesheet every time this
            branch mounted, and put a global animation name outside the file
            that owns the design tokens — so the reduced-motion rules couldn't
            see it, and the spinner froze into a dead ring under this exact
            message. `.animate-spin-slow` has a no-motion fallback. */}
        <div
          className="animate-spin-slow mx-auto mb-5 size-10 rounded-pill border-2"
          style={{ borderColor: "var(--line)", borderTopColor: "var(--blue)" }}
        />
        <p className="text-label font-medium" style={{ color: "var(--text)" }}>
          Reading the receipt…
        </p>
      </div>
    );
  }

  // ── Failed ───────────────────────────────────────────────────────────────
  if (status === "failed") {
    return (
      <div className="py-10 text-center">
        <span style={{ color: "var(--amber-text)" }}>
          <Icon name="warning" size={26} strokeWidth={1.9} />
        </span>
        <p className="mt-3 text-label font-medium" style={{ color: "var(--text)" }}>
          Couldn&apos;t read that one
        </p>
        <p className="mx-auto mt-2 max-w-[280px] text-body leading-[1.5]" style={{ color: "var(--muted)" }}>
          Receipt reading needs the server, which isn&apos;t connected yet. You can type
          the lines in instead.
        </p>

        <div className="mt-5 flex justify-center gap-2.5">
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="rounded-card border px-4 py-3 text-body font-medium"
            style={{ borderColor: "var(--line)", color: "var(--text)" }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus("review");
              setLines([blankLine()]);
            }}
            className="rounded-card px-4 py-3 text-body font-semibold"
            style={{ background: "var(--blue)", color: "#FFFFFF" }}
          >
            Type it in
          </button>
        </div>
      </div>
    );
  }

  // ── Review ───────────────────────────────────────────────────────────────
  return (
    <div>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a remote asset
        <img
          src={preview}
          alt="The receipt you captured"
          className="mb-4 h-32 w-full rounded-card object-cover"
        />
      )}

      <label
        className="mb-2 block text-eyebrow uppercase"
        style={{ color: "var(--muted)" }}
        htmlFor="scan-merchant"
      >
        Shop
      </label>
      <input
        id="scan-merchant"
        value={merchant}
        onChange={(event) => setMerchant(event.target.value)}
        placeholder="Where was it?"
        className="mb-5 w-full rounded-card border px-3.5 py-3 text-label outline-none"
        style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--text)" }}
      />

      <div className="mb-2.5 flex items-center justify-between">
        <span
          className="text-eyebrow uppercase"
          style={{ color: "var(--muted)" }}
        >
          Lines
        </span>
        <span className="font-mono text-meta tabular-nums" style={{ color: "var(--text)" }}>
          {formatMoney(total, currency)}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {lines.map((line) => (
          <div
            key={line.key}
            className="flex items-center gap-2 rounded-card border p-2.5"
            style={{ background: "var(--bg)", borderColor: "var(--line)" }}
          >
            <input
              value={line.label}
              onChange={(event) => updateLine(line.key, { label: event.target.value })}
              placeholder="What was it?"
              aria-label="Item"
              className="min-w-0 flex-1 bg-transparent text-label outline-none"
              style={{ color: "var(--text)" }}
            />
            <input
              value={line.amountText}
              onChange={(event) => updateLine(line.key, { amountText: event.target.value })}
              placeholder="0"
              inputMode="decimal"
              aria-label="Amount"
              className="w-20 bg-transparent text-right font-mono text-label tabular-nums outline-none"
              style={{ color: "var(--text)" }}
            />
            <button
              type="button"
              onClick={() => setLines((c) => c.filter((l) => l.key !== line.key))}
              aria-label={`Remove ${line.label || "line"}`}
              style={{ color: "var(--faint)" }}
            >
              <Icon name="trash" size={16} strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setLines((current) => [...current, blankLine()])}
        className="mt-2.5 w-full rounded-card border border-dashed py-3 text-body font-medium"
        style={{ borderColor: "var(--line)", color: "var(--muted)" }}
      >
        Add a line
      </button>

      <button
        type="button"
        onClick={commit}
        disabled={!total}
        className="mt-4 w-full rounded-card py-4 text-label font-semibold disabled:opacity-40"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        Log {formatMoney(total, currency)}
      </button>
    </div>
  );
}

export default ScanTab;
