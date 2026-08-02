interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

/** The heading every screen except the Tap Pad opens with. */
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1
          className="font-display text-display leading-none tracking-[-0.03em]"
          style={{ color: "var(--text)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-body leading-[1.45]" style={{ color: "var(--muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

export default PageHeader;
