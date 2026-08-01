"use client";

import { useTally } from "@/lib/store/TallyProvider";
import { Icon } from "@/components/ui/Icon";

/**
 * The offline strip. It appears only when there is something to say — either
 * the connection is gone, or it's back and a queue is still draining.
 *
 * The wording matters: taps are never blocked by the network, so the message
 * is a reassurance ("still count"), not a warning.
 */
export function OfflineBanner() {
  const { state, pendingCount, syncNow } = useTally();
  const offline = !state.online;

  if (!offline && pendingCount === 0) return null;

  return (
    <div
      role="status"
      className="mx-4 mt-2 flex items-center gap-3 rounded-[13px] border px-3.5 py-3"
      style={{
        background: "var(--surf)",
        borderColor: "var(--line)",
        borderLeft: `3px solid ${offline ? "var(--amber)" : "var(--teal)"}`,
      }}
    >
      <span style={{ color: offline ? "var(--amber)" : "var(--teal)" }}>
        <Icon name={offline ? "offline" : "retry"} size={17} strokeWidth={1.9} />
      </span>

      <div className="flex-1">
        <p className="text-[13px] font-medium leading-tight" style={{ color: "var(--text)" }}>
          {offline ? "You're offline. Taps still count." : "Syncing your taps…"}
        </p>
        {pendingCount > 0 && (
          <p className="mt-[3px] text-[11px] leading-tight" style={{ color: "var(--muted)" }}>
            {pendingCount} waiting to sync
          </p>
        )}
      </div>

      {!offline && pendingCount > 0 && (
        <button
          type="button"
          onClick={syncNow}
          className="rounded-[10px] px-3 py-2 text-[12px] font-medium"
          style={{ color: "var(--blue)" }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default OfflineBanner;
