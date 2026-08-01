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
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
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

/** A labelled bar — used for budgets, month comparisons and category limits. */
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
  return (
    <div
      className="w-full overflow-hidden rounded-pill"
      style={{ height, background: track }}
    >
      <div
        className="h-full rounded-pill"
        style={{
          width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
          background: color,
          transition: "width .4s cubic-bezier(.2,.85,.25,1)",
        }}
      />
    </div>
  );
}

export default Card;
