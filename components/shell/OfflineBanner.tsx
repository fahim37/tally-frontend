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
  const shouldShow = offline || pendingCount > 0;

  // It used to return null outright, so the strip popped in and out and shoved
  // the whole page down by its height with no transition — a jolt on a screen
  // the user is probably mid-tap on.
  //
  // It stays mounted and collapses instead, via a 1fr → 0fr grid row, which is
  // the one way to transition to and from an auto height without measuring it.
  // Always rendering it is cheaper than the mount/unmount state it replaced:
  // it's a handful of nodes, and it means no effect and no cascading render.
  return (
    <div
      className="grid"
      aria-hidden={!shouldShow || undefined}
      style={{
        gridTemplateRows: shouldShow ? "1fr" : "0fr",
        opacity: shouldShow ? 1 : 0,
        transition:
          "grid-template-rows var(--dur-base) var(--ease-out), opacity var(--dur-fast) ease",
      }}
    >
      <div className="overflow-hidden">
        <div
          role="status"
          className="mx-5 mt-2 flex items-center gap-3 rounded-card border px-4 py-3"
          style={{
            background: "var(--surf)",
            borderColor: "var(--line)",
            borderLeft: `3px solid ${offline ? "var(--amber)" : "var(--teal)"}`,
          }}
        >
          <span style={{ color: offline ? "var(--amber-text)" : "var(--teal-text)" }}>
            <Icon
              name={offline ? "offline" : "retry"}
              size={19}
              strokeWidth={1.9}
              className={offline ? undefined : "animate-spin-slow"}
            />
          </span>

          <div className="flex-1">
            <p className="text-body font-medium leading-tight" style={{ color: "var(--text)" }}>
              {offline ? "You're offline. Taps still count." : "Syncing your taps…"}
            </p>
            {pendingCount > 0 && (
              <p className="mt-1 text-caption leading-tight" style={{ color: "var(--muted)" }}>
                {pendingCount} waiting to sync
              </p>
            )}
          </div>

          {!offline && pendingCount > 0 && (
            <button
              type="button"
              onClick={syncNow}
              className="tap-target rounded-[10px] px-3 py-2 text-meta font-medium"
              style={{ color: "var(--blue)" }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OfflineBanner;
