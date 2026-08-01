import { iconPath, UI_ICONS, type UiIconKey } from "@/lib/icons";

interface IconProps {
  /** An expense icon key (tea, cig, …) or a UI glyph name (home, plus, …). */
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Defaults to currentColor so icons inherit their container's color. */
  color?: string;
}

const isUiIcon = (name: string): name is UiIconKey => name in UI_ICONS;

/**
 * One stroked 24×24 icon component for the whole app. Everything is drawn on
 * currentColor with round caps, which is what keeps the icon set reading as
 * one family across the pad, the nav and the cards.
 */
export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  className,
  color = "currentColor",
}: IconProps) {
  const path = isUiIcon(name) ? UI_ICONS[name] : iconPath(name);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

/** The search glyph needs a circle the single-path set can't express. */
export function SearchIcon({ size = 17, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

export default Icon;
