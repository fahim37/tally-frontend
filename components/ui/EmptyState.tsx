import Link from "next/link";
import { Icon } from "./Icon";

interface EmptyStateProps {
  icon?: string;
  title: string;
  body: string;
  action?: { href: string; label: string };
  /** Rendered instead of a link when the action isn't a navigation. */
  children?: React.ReactNode;
}

/**
 * What a screen shows before it has anything to show.
 *
 * Worth having as one component because the alternative is what this app did
 * before: every analytics screen rendered its full furniture over an empty
 * store — a heatmap of 35 blank cells, a 30-bar chart of zero-height bars, a
 * "vs last month" comparison of ৳0 against ৳0. That doesn't read as a new
 * account, it reads as a broken one.
 *
 * The copy rule: say what will appear here, and name the action that produces
 * it. No exclamation marks, no encouragement, no emoji.
 */
export function EmptyState({ icon = "logo", title, body, action, children }: EmptyStateProps) {
  return (
    <div
      className="animate-row-in rounded-card border px-5 py-10 text-center"
      style={{ background: "var(--surf)", borderColor: "var(--line)" }}
    >
      <span
        className="mx-auto mb-4 flex size-12 items-center justify-center rounded-card"
        style={{ background: "var(--bg)", color: "var(--faint)" }}
      >
        <Icon name={icon} size={24} strokeWidth={1.6} />
      </span>

      <p className="mb-2 font-display text-subhead" style={{ color: "var(--text)" }}>
        {title}
      </p>
      <p
        className="mx-auto max-w-[320px] text-body"
        style={{ color: "var(--muted)" }}
      >
        {body}
      </p>

      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-block rounded-card px-6 py-3 text-body font-semibold transition-transform active:scale-[0.98]"
          style={{ background: "var(--blue)", color: "#FFFFFF" }}
        >
          {action.label}
        </Link>
      )}

      {children}
    </div>
  );
}

export default EmptyState;
