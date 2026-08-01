"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import { useToast } from "@/components/ui/Toast";
import { loggingStreak } from "@/lib/store/selectors";
import { CURRENCIES } from "@/lib/money";
import { toCsv, downloadCsv } from "@/lib/csv";
import { todayLocalDate } from "@/lib/date";

export function Profile() {
  const { state, dispatch, pendingCount, resetAll } = useTally();
  const { toast } = useToast();
  const [confirmingReset, setConfirmingReset] = useState(false);

  const streak = useMemo(() => loggingStreak(state), [state]);
  const activeTiles = state.tiles.filter((t) => !t.isArchived).length;
  const initials =
    (state.profile.displayName || state.profile.email)
      .split(/[\s@.]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "T";

  const exportCsv = () => {
    downloadCsv(
      toCsv(state.expenses, state.categories, state.profile.currency),
      `tally-${todayLocalDate()}.csv`
    );
    toast("Exported to CSV");
  };

  return (
    <div className="px-5 pb-8 pt-6">
      <PageHeader title="Profile" />

      {/* Account */}
      <Card className="mb-3">
        <div className="flex items-center gap-3.5">
          <span
            className="flex size-[46px] items-center justify-center rounded-[15px] font-display text-[17px] font-semibold"
            style={{ background: "var(--sky)", color: "var(--blue)" }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[15px] font-semibold leading-tight"
              style={{ color: "var(--text)" }}
            >
              {state.profile.displayName || "Your account"}
            </p>
            <p className="mt-[3px] truncate text-[12px]" style={{ color: "var(--muted)" }}>
              {state.profile.email}
            </p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="mb-3 flex gap-2.5">
        <Card className="flex-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--muted)" }}
          >
            Logged
          </p>
          <p
            className="mt-2 font-display text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
            style={{ color: "var(--text)" }}
          >
            {state.profile.totalTaps.toLocaleString("en-IN")}
          </p>
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
            taps all time
          </p>
        </Card>

        <Card className="flex-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--teal)" }}
          >
            Streak
          </p>
          <p
            className="mt-2 font-display text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
            style={{ color: "var(--teal)" }}
          >
            {streak}
          </p>
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
            days logged
          </p>
        </Card>
      </div>

      {/* Settings list */}
      <div
        className="mb-3 overflow-hidden rounded-card border"
        style={{ background: "var(--surf)", borderColor: "var(--line)" }}
      >
        <Row href="/budgets" icon="dashboard" label="Budgets & goals" />
        <Row href="/history" icon="edit" label="History" />
        <Row href="/insights" icon="warning" label="Insights" />

        {/* Currency */}
        <div
          className="flex items-center gap-3 border-b px-4 py-3.5"
          style={{ borderColor: "var(--line)" }}
        >
          <span style={{ color: "var(--muted)" }}>
            <Icon name="bill" size={18} strokeWidth={1.7} />
          </span>
          <span className="flex-1 text-[14px]" style={{ color: "var(--text)" }}>
            Currency
          </span>
          <select
            value={state.profile.currency}
            onChange={(event) =>
              dispatch({ type: "UPDATE_PROFILE", patch: { currency: event.target.value } })
            }
            aria-label="Currency"
            className="bg-transparent font-mono text-[13px] outline-none"
            style={{ color: "var(--muted)" }}
          >
            {Object.values(CURRENCIES).map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.symbol} {currency.code}
              </option>
            ))}
          </select>
        </div>

        {/* Appearance */}
        <div
          className="flex items-center gap-3 border-b px-4 py-3.5"
          style={{ borderColor: "var(--line)" }}
        >
          <span style={{ color: "var(--muted)" }}>
            <Icon name="theme" size={18} strokeWidth={1.7} />
          </span>
          <span className="flex-1 text-[14px]" style={{ color: "var(--text)" }}>
            Appearance
          </span>
          <span className="flex rounded-pill p-[3px]" style={{ background: "var(--bg)" }}>
            {(["light", "dark", "system"] as const).map((mode) => {
              const active = state.profile.appearance === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => dispatch({ type: "UPDATE_PROFILE", patch: { appearance: mode } })}
                  aria-pressed={active}
                  className="tap-target rounded-pill px-2.5 py-1.5 text-[11px] font-medium capitalize"
                  style={{
                    background: active ? "var(--surf)" : "transparent",
                    color: active ? "var(--text)" : "var(--muted)",
                    boxShadow: active ? "0 1px 2px rgba(11,18,32,.12)" : "none",
                  }}
                >
                  {mode}
                </button>
              );
            })}
          </span>
        </div>

        {/* Tally style */}
        <div
          className="flex items-center gap-3 border-b px-4 py-3.5"
          style={{ borderColor: "var(--line)" }}
        >
          <span style={{ color: "var(--muted)" }}>
            <Icon name="habits" size={18} strokeWidth={1.7} />
          </span>
          <span className="flex-1 text-[14px]" style={{ color: "var(--text)" }}>
            Strike every
          </span>
          <span className="flex rounded-pill p-[3px]" style={{ background: "var(--bg)" }}>
            {[4, 5, 6].map((value) => {
              const active = state.settings.strikeAt === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => dispatch({ type: "UPDATE_SETTINGS", patch: { strikeAt: value } })}
                  aria-pressed={active}
                  className="tap-target rounded-pill px-3 py-1.5 font-mono text-[11px] font-medium"
                  style={{
                    background: active ? "var(--surf)" : "transparent",
                    color: active ? "var(--text)" : "var(--muted)",
                  }}
                >
                  {value}
                </button>
              );
            })}
          </span>
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5">
          <span style={{ color: "var(--muted)" }}>
            <Icon name="home" size={18} strokeWidth={1.7} />
          </span>
          <span className="flex-1 text-[14px]" style={{ color: "var(--text)" }}>
            Tiles
          </span>
          <span className="text-[13px]" style={{ color: "var(--muted)" }}>
            {activeTiles} active
          </span>
        </div>
      </div>

      {/* Data */}
      <Card className="mb-3" title="Your data">
        <p className="mb-3.5 text-[13px] leading-[1.5]" style={{ color: "var(--muted)" }}>
          Everything is stored on this device and works offline.
          {pendingCount > 0
            ? ` ${pendingCount} ${pendingCount === 1 ? "entry is" : "entries are"} waiting to sync.`
            : " Nothing is waiting to sync."}
        </p>

        <button
          type="button"
          onClick={exportCsv}
          className="w-full rounded-[12px] border py-3.5 text-[14px] font-medium"
          style={{ borderColor: "var(--line)", color: "var(--text)" }}
        >
          Export everything as CSV
        </button>
      </Card>

      {confirmingReset ? (
        <Card>
          <p className="mb-3.5 text-[14px] leading-[1.5]" style={{ color: "var(--text)" }}>
            This clears every expense, tile and budget on this device. It can&apos;t be undone.
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="flex-1 rounded-[12px] border py-3.5 text-[14px] font-medium"
              style={{ borderColor: "var(--line)", color: "var(--text)" }}
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="flex-1 rounded-[12px] py-3.5 text-[14px] font-semibold"
              style={{ background: "var(--amber)", color: "#0B1220" }}
            >
              Erase everything
            </button>
          </div>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingReset(true)}
          className="w-full rounded-[14px] border py-3.5 text-[14px] font-medium"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          Reset all data
        </button>
      )}
    </div>
  );
}

function Row({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b px-4 py-3.5"
      style={{ borderColor: "var(--line)", color: "var(--text)" }}
    >
      <span style={{ color: "var(--muted)" }}>
        <Icon name={icon} size={18} strokeWidth={1.7} />
      </span>
      <span className="flex-1 text-[14px]">{label}</span>
      <span style={{ color: "var(--faint)" }}>
        <Icon name="chevronRight" size={16} strokeWidth={2} />
      </span>
    </Link>
  );
}

export default Profile;
