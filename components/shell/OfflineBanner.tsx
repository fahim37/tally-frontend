"use client";

import { useTally } from "@/lib/store/TallyProvider";
import { Icon } from "@/components/ui/Icon";

/** A fixed connection notice. Online syncing stays silent and this overlay is
 * outside document flow, so neither state can move the screen underneath it. */
export function OfflineBanner() {
  const { state, pendingCount } = useTally();
  if (state.online) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 px-5 pt-[max(8px,env(safe-area-inset-top))]"
      style={{ animation: "fadeIn var(--dur-fast) ease both" }}
    >
      <div
        role="status"
        aria-live="polite"
        className="mx-auto flex w-full max-w-[480px] items-center gap-3 rounded-card border px-4 py-3"
        style={{
          background: "var(--surf)",
          borderColor: "var(--line)",
          borderLeft: "3px solid var(--amber)",
          boxShadow: "var(--lift)",
        }}
      >
        <span style={{ color: "var(--amber-text)" }}>
          <Icon name="offline" size={19} strokeWidth={1.9} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-body font-medium leading-tight" style={{ color: "var(--text)" }}>
            You&apos;re offline. Changes will sync later.
          </p>
          {pendingCount > 0 && (
            <p className="mt-1 text-caption leading-tight" style={{ color: "var(--muted)" }}>
              {pendingCount} {pendingCount === 1 ? "expense" : "expenses"} saved on this device
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default OfflineBanner;
