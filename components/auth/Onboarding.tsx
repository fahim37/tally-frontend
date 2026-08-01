"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import { padTiles } from "@/lib/store/selectors";
import { CURRENCIES, formatMoney, getCurrency, toMinor } from "@/lib/money";
import { currentLocalMonth, daysInMonth } from "@/lib/date";

const SUGGESTED_BUDGETS = [1_200_000, 1_800_000, 2_500_000, 4_000_000];

/**
 * Three steps: what you spend in, what a month looks like, what you buy.
 *
 * Every step has a working default already applied, so "Next" is always
 * available and the whole flow is skippable — the account is usable before
 * this runs, and this only revises it. Step three teaches the tap gesture on
 * the real tiles before the home screen ever appears.
 */
export function Onboarding() {
  const { dispatch } = useTally();
  const router = useRouter();
  const [step, setStep] = useState(1);

  const finish = () => {
    dispatch({ type: "UPDATE_PROFILE", patch: { onboardingCompleted: true } });
    router.replace("/");
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10 pt-8">
      {/* Progress — the design's tally-stroke stepper */}
      <div className="mb-8 flex items-center gap-3">
        <span className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className="w-[2.5px] rounded-[2px]"
              style={{ height: 15, background: n <= step ? "var(--blue)" : "var(--line)" }}
            />
          ))}
        </span>
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: "var(--muted)" }}
        >
          Step {step} of 3
        </span>

        <button
          type="button"
          onClick={finish}
          className="tap-target ml-auto px-1.5 text-[13px] font-medium"
          style={{ color: "var(--muted)" }}
        >
          Skip
        </button>
      </div>

      {step === 1 && <CurrencyStep onNext={() => setStep(2)} />}
      {step === 2 && <BudgetStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <HabitsStep onFinish={finish} onBack={() => setStep(2)} />}

      <p className="mt-6 text-center text-[12px]" style={{ color: "var(--faint)" }}>
        You can change any of this later in Profile.
      </p>
    </div>
  );
}

// ── Step 1 ─────────────────────────────────────────────────────────────────

function CurrencyStep({ onNext }: { onNext: () => void }) {
  const { state, dispatch } = useTally();
  const selected = state.profile.currency;

  return (
    <div className="flex flex-1 flex-col">
      <h1
        className="mb-2.5 font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.035em]"
        style={{ color: "var(--text)" }}
      >
        Which currency do you spend in?
      </h1>
      <p className="mb-7 text-[15px] leading-[1.5]" style={{ color: "var(--muted)" }}>
        Every amount in Tally uses it.
      </p>

      <div className="flex flex-col gap-2.5">
        {Object.values(CURRENCIES).map((currency) => {
          const active = currency.code === selected;
          return (
            <button
              key={currency.code}
              type="button"
              onClick={() =>
                dispatch({ type: "UPDATE_PROFILE", patch: { currency: currency.code } })
              }
              aria-pressed={active}
              className="flex items-center gap-3.5 rounded-[14px] border p-4 text-left"
              style={{
                background: active ? "var(--sky)" : "transparent",
                borderColor: active ? "var(--blue)" : "var(--line)",
                borderWidth: active ? 1.5 : 1,
              }}
            >
              <span
                className="flex size-[38px] items-center justify-center rounded-[12px] font-mono text-[18px] font-semibold"
                style={{
                  background: active ? "var(--surf)" : "var(--bg)",
                  color: active ? "var(--blue)" : "var(--muted)",
                }}
              >
                {currency.symbol}
              </span>
              <span className="flex-1">
                <span
                  className="block text-[15px] font-medium leading-tight"
                  style={{ color: "var(--text)" }}
                >
                  {currency.code}
                </span>
                <span className="mt-[3px] block text-[12px]" style={{ color: "var(--muted)" }}>
                  {formatMoney(125_000, currency.code)}
                </span>
              </span>
              {active && (
                <span style={{ color: "var(--blue)" }}>
                  <Icon name="check" size={19} strokeWidth={2.2} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-8 w-full rounded-[14px] py-4 text-[15px] font-semibold"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        Next
      </button>
    </div>
  );
}

// ── Step 2 ─────────────────────────────────────────────────────────────────

function BudgetStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { state, dispatch } = useTally();
  const currency = state.profile.currency;
  const month = currentLocalMonth();

  const current =
    state.budgets.find((b) => b.month === month)?.overallLimitMinor ?? 1_800_000;
  const [text, setText] = useState(String(current / 100));

  const minor = toMinor(text, currency) ?? 0;
  const perDay = minor > 0 ? Math.round(minor / daysInMonth(month) / 100) * 100 : 0;

  const commit = (value: number) => {
    setText(String(value / 100));
    dispatch({ type: "SET_BUDGET", month, overallLimitMinor: value });
  };

  const next = () => {
    if (minor > 0) dispatch({ type: "SET_BUDGET", month, overallLimitMinor: minor });
    onNext();
  };

  return (
    <div className="flex flex-1 flex-col">
      <h1
        className="mb-2.5 font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.035em]"
        style={{ color: "var(--text)" }}
      >
        What&apos;s a normal month for you?
      </h1>
      <p className="mb-8 text-[15px] leading-[1.5]" style={{ color: "var(--muted)" }}>
        A rough number is enough. Tally works out the daily pace from it.
      </p>

      <div
        className="mb-3 flex items-baseline gap-1.5 border-b-2 pb-4"
        style={{ borderColor: "var(--blue)" }}
      >
        <span className="font-display text-[30px] font-semibold" style={{ color: "var(--muted)" }}>
          {getCurrency(currency).symbol}
        </span>
        <input
          value={text}
          onChange={(event) => setText(event.target.value.replace(/[^\d.]/g, ""))}
          inputMode="numeric"
          aria-label="Monthly budget"
          className="w-full min-w-0 bg-transparent font-display text-[46px] font-semibold tracking-[-0.04em] tabular-nums outline-none"
          style={{ color: "var(--text)" }}
        />
      </div>

      <p className="mb-7 text-[13px]" style={{ color: "var(--muted)" }}>
        {perDay > 0 ? (
          <>
            That&apos;s{" "}
            <span className="font-mono" style={{ color: "var(--text)" }}>
              {formatMoney(perDay, currency)}
            </span>{" "}
            a day.
          </>
        ) : (
          "Enter a number to see the daily pace."
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_BUDGETS.map((value) => {
          const active = value === minor;
          return (
            <button
              key={value}
              type="button"
              onClick={() => commit(value)}
              aria-pressed={active}
              className="tap-target rounded-pill border px-4 py-2.5 font-mono text-[13px] font-medium"
              style={{
                background: active ? "var(--sky)" : "transparent",
                borderColor: active ? "var(--blue)" : "var(--line)",
                color: active ? "var(--blue)" : "var(--muted)",
              }}
            >
              {formatMoney(value, currency)}
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex gap-2.5 pt-8">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[14px] border px-6 py-4 text-[15px] font-medium"
          style={{ borderColor: "var(--line)", color: "var(--text)" }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={next}
          disabled={minor <= 0}
          className="flex-1 rounded-[14px] py-4 text-[15px] font-semibold disabled:opacity-40"
          style={{ background: "var(--blue)", color: "#FFFFFF" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ── Step 3 ─────────────────────────────────────────────────────────────────

function HabitsStep({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const { state, dispatch } = useTally();
  const currency = state.profile.currency;
  const tiles = useMemo(() => padTiles(state), [state]);

  // Everything starts picked. Deselecting is a deliberate "I don't buy that",
  // whereas starting with four selected leaves a half-empty pad on first open
  // for anyone who taps straight through.
  const [picked, setPicked] = useState<string[]>(() => tiles.map((tile) => tile.id));
  const [tapped, setTapped] = useState<string | null>(null);

  const toggle = (id: string) => {
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
    // The point of this step is to teach the gesture, so the tile answers the
    // tap the same way it will on the home screen.
    setTapped(id);
    navigator.vibrate?.(8);
    window.setTimeout(() => setTapped(null), 160);
  };

  const finish = () => {
    // Anything not picked is archived rather than deleted — the user can bring
    // it back from Profile without recreating it.
    for (const tile of tiles) {
      if (!picked.includes(tile.id)) {
        dispatch({ type: "ARCHIVE_TILE", tileId: tile.id });
      }
    }
    for (const id of picked.slice(0, 3)) {
      dispatch({ type: "ADD_HABIT", tileId: id });
    }
    onFinish();
  };

  return (
    <div className="flex flex-1 flex-col">
      <h1
        className="mb-2.5 font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.035em]"
        style={{ color: "var(--text)" }}
      >
        What do you buy most days?
      </h1>
      <p className="mb-6 text-[15px] leading-[1.5]" style={{ color: "var(--muted)" }}>
        These become your tap tiles. Tap one now — that&apos;s the whole gesture.
      </p>

      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((tile) => {
          const active = picked.includes(tile.id);
          const isTapped = tapped === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              data-tap
              onClick={() => toggle(tile.id)}
              aria-pressed={active}
              className="relative flex h-[104px] flex-col items-start justify-between rounded-tile border p-3 text-left"
              style={{
                background: active ? "var(--sky)" : "var(--surf)",
                borderColor: active ? "var(--blue)" : "var(--line)",
                borderWidth: active ? 1.5 : 1,
                transform: isTapped ? "translateY(3px) scale(.982)" : "none",
                transition: "transform 90ms cubic-bezier(.3,.7,.4,1)",
              }}
            >
              <span style={{ color: "var(--blue)" }}>
                <Icon name={tile.iconKey} size={23} strokeWidth={1.6} />
              </span>
              <span>
                <span
                  className="block text-[13px] font-medium leading-[1.15]"
                  style={{ color: "var(--text)" }}
                >
                  {tile.name}
                </span>
                <span
                  className="mt-1 block font-mono text-[12px] tabular-nums"
                  style={{ color: "var(--muted)" }}
                >
                  {formatMoney(tile.amountMinor, currency)}
                </span>
              </span>

              {active && (
                <span
                  className="absolute right-2.5 top-2.5 flex size-[19px] items-center justify-center rounded-pill"
                  style={{ background: "var(--blue)" }}
                >
                  <Icon name="check" size={11} strokeWidth={3} color="#FFFFFF" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-[13px] leading-[1.45]" style={{ color: "var(--muted)" }}>
        {picked.length === 0
          ? "Pick at least one to get started."
          : `${picked.length} picked. You can add, rename or reprice any tile later by long-pressing it.`}
      </p>

      <div className="mt-auto flex gap-2.5 pt-8">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[14px] border px-6 py-4 text-[15px] font-medium"
          style={{ borderColor: "var(--line)", color: "var(--text)" }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={finish}
          disabled={picked.length === 0}
          className="flex-1 rounded-[14px] py-4 text-[15px] font-semibold disabled:opacity-40"
          style={{ background: "var(--blue)", color: "#FFFFFF" }}
        >
          Start tallying
        </button>
      </div>
    </div>
  );
}

export default Onboarding;
