"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const { state, dispatch, pendingCount, resetAll, signOut } = useTally();
  const { toast } = useToast();
  const router = useRouter();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const leave = async () => {
    setSigningOut(true);
    // `signOut` revokes the refresh token, wipes the persisted store and
    // resets the reducer. It resolves even if the network call fails —
    // otherwise a dead connection would trap someone in an account.
    await signOut();
    router.replace("/signin");
  };

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
        <div className="flex items-center gap-3">
          <span
            className="flex size-12 items-center justify-center rounded-card font-display text-subhead"
            style={{ background: "var(--sky)", color: "var(--blue)" }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-subhead"
              style={{ color: "var(--text)" }}
            >
              {state.profile.displayName || "Your account"}
            </p>
            <p className="mt-1 truncate text-meta" style={{ color: "var(--muted)" }}>
              {state.profile.email}
            </p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="mb-3 flex gap-2.5">
        <Card className="flex-1">
          <p
            className="text-eyebrow uppercase"
            style={{ color: "var(--muted)" }}
          >
            Logged
          </p>
          <p
            className="mt-2 font-display text-display tabular-nums"
            style={{ color: "var(--text)" }}
          >
            {state.profile.totalTaps.toLocaleString("en-IN")}
          </p>
          <p className="mt-1.5 text-caption" style={{ color: "var(--muted)" }}>
            taps all time
          </p>
        </Card>

        <Card className="flex-1">
          <p
            className="text-eyebrow uppercase"
            style={{ color: "var(--teal-text)" }}
          >
            Streak
          </p>
          <p
            className="mt-2 font-display text-display tabular-nums"
            style={{ color: "var(--teal-text)" }}
          >
            {streak}
          </p>
          <p className="mt-1.5 text-caption" style={{ color: "var(--muted)" }}>
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
          <span className="flex-1 text-label" style={{ color: "var(--text)" }}>
            Currency
          </span>
          <select
            value={state.profile.currency}
            onChange={(event) =>
              dispatch({ type: "UPDATE_PROFILE", patch: { currency: event.target.value } })
            }
            aria-label="Currency"
            className="bg-transparent font-mono text-body outline-none"
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
          <span className="flex-1 text-label" style={{ color: "var(--text)" }}>
            Appearance
          </span>
          <span className="flex rounded-pill p-1" style={{ background: "var(--bg)" }}>
            {(["light", "dark", "system"] as const).map((mode) => {
              const active = state.profile.appearance === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => dispatch({ type: "UPDATE_PROFILE", patch: { appearance: mode } })}
                  aria-pressed={active}
                  className="tap-target rounded-pill px-2.5 py-1.5 text-caption font-medium capitalize"
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
          <span className="flex-1 text-label" style={{ color: "var(--text)" }}>
            Strike every
          </span>
          <span className="flex rounded-pill p-1" style={{ background: "var(--bg)" }}>
            {[4, 5, 6].map((value) => {
              const active = state.settings.strikeAt === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => dispatch({ type: "UPDATE_SETTINGS", patch: { strikeAt: value } })}
                  aria-pressed={active}
                  className="tap-target rounded-pill px-3 py-1.5 font-mono text-caption font-medium"
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
          <span className="flex-1 text-label" style={{ color: "var(--text)" }}>
            Tiles
          </span>
          <span className="text-body" style={{ color: "var(--muted)" }}>
            {activeTiles} active
          </span>
        </div>
      </div>

      {/* Data */}
      <Card className="mb-3" title="Your data">
        <p className="mb-3.5 text-body leading-[1.5]" style={{ color: "var(--muted)" }}>
          Your account data syncs across devices and stays available offline.
          {pendingCount > 0
            ? ` ${pendingCount} expense ${pendingCount === 1 ? "entry is" : "entries are"} waiting to sync.`
            : " Changes sync automatically when you’re online."}
        </p>

        <button
          type="button"
          onClick={exportCsv}
          className="w-full rounded-card border py-3.5 text-label font-medium"
          style={{ borderColor: "var(--line)", color: "var(--text)" }}
        >
          Export everything as CSV
        </button>
      </Card>

      {confirmingReset ? (
        <Card>
          <p className="mb-3.5 text-label leading-[1.5]" style={{ color: "var(--text)" }}>
            This clears Tally&apos;s locally stored data from this device. Synced account data
            stays on the server and can return after you refresh or sign in again. Any unsynced
            changes will be lost.
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="flex-1 rounded-card border py-3.5 text-label font-medium"
              style={{ borderColor: "var(--line)", color: "var(--text)" }}
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="flex-1 rounded-card py-3.5 text-label font-semibold"
              style={{ background: "var(--amber)", color: "#0B1220" }}
            >
              Clear this device
            </button>
          </div>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingReset(true)}
          className="w-full rounded-card border py-3.5 text-label font-medium"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          Clear this device
        </button>
      )}

      {/* Sign out */}
      {confirmingSignOut ? (
        <Card className="mt-3">
          <p className="mb-3.5 text-label" style={{ color: "var(--text)" }}>
            Signing out clears this device. Your account keeps everything that has synced —
            {pendingCount > 0 ? (
              <>
                {" "}
                but{" "}
                <strong style={{ color: "var(--amber-text)" }}>
                  {pendingCount} {pendingCount === 1 ? "entry hasn't" : "entries haven't"}{" "}
                  synced yet
                </strong>{" "}
                and will be lost.
              </>
            ) : (
              <> and nothing is waiting to sync.</>
            )}
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmingSignOut(false)}
              disabled={signingOut}
              className="flex-1 rounded-card border py-3.5 text-label font-medium disabled:opacity-50"
              style={{ borderColor: "var(--line)", color: "var(--text)" }}
            >
              Stay
            </button>
            <button
              type="button"
              onClick={leave}
              disabled={signingOut}
              className="flex-1 rounded-card py-3.5 text-label font-semibold disabled:opacity-60"
              style={{ background: "var(--text)", color: "var(--bg)" }}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingSignOut(true)}
          className="mt-3 w-full rounded-card border py-3.5 text-label font-medium"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          Sign out
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
      <span className="flex-1 text-label">{label}</span>
      <span style={{ color: "var(--faint)" }}>
        <Icon name="chevronRight" size={16} strokeWidth={2} />
      </span>
    </Link>
  );
}

export default Profile;
