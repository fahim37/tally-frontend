interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Small caps label above the content. */
  title?: string;
  action?: React.ReactNode;
}

/** The system's one boxed surface: 14px radius, hairline border, no shadow. */
export function Card({ children, className = "", title, action }: CardProps) {
  return (
    <section
      className={`rounded-card border p-4 ${className}`}
      style={{ background: "var(--surf)", borderColor: "var(--line)" }}
    >
      {(title || action) && (
        <div className="mb-3.5 flex items-baseline justify-between gap-3">
          {title && (
            <h2
              className="text-eyebrow uppercase"
              style={{ color: "var(--muted)" }}
            >
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * A labelled bar — used for budgets, month comparisons and category limits.
 *
 * The fill is always full width and scaled with a transform. Animating `width`
 * (which this did) relayouts and repaints the bar on every frame of the
 * transition, and the Budgets and Dashboard screens run several bars at once —
 * the textbook way to make a mid-range Android stutter. A transform is handed
 * to the compositor and costs nothing per frame.
 */
export function ProgressBar({
  ratio,
  color = "var(--blue)",
  height = 9,
  track = "var(--bg)",
}: {
  ratio: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  const clamped = Math.min(1, Math.max(0, ratio));

  return (
    <div
      className="w-full overflow-hidden rounded-pill"
      style={{ height, background: track }}
      role="presentation"
    >
      <div
        className="h-full w-full origin-left rounded-pill"
        style={{
          background: color,
          transform: `scaleX(${clamped})`,
          transition: "transform var(--dur-slow) var(--ease-out)",
        }}
      />
    </div>
  );
}

export default Card;
