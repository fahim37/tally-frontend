"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

const ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/habits", label: "Habits", icon: "habits" },
  { href: "/profile", label: "Profile", icon: "profile" },
] as const;

interface BottomNavProps {
  onLogPress: () => void;
}

/**
 * The five-slot bottom bar: four destinations around the raised log button.
 *
 * The log button is the app's primary action and sits centre, lifted above the
 * bar, so it's the easiest thing to hit with a thumb.
 */
export function BottomNav({ onLogPress }: BottomNavProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className="grid grid-cols-5 items-end px-2 pt-3"
      style={{ paddingBottom: "calc(12px + var(--safe-b))" }}
    >
      {ITEMS.slice(0, 2).map((item) => (
        <NavLink key={item.href} {...item} active={isActive(item.href)} />
      ))}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onLogPress}
          aria-label="Log an expense"
          /**
           * Both offsets are expressed with the same property.
           *
           * This used to combine an inline `transform: translateY(-19px)` with
           * Tailwind's `active:translate-y-[-16px]`. In Tailwind v4 the
           * `translate-*` utilities compile to the standalone `translate`
           * property, which *composes* with `transform` rather than replacing
           * it — so pressing the app's most-used control sent it to -35px, a
           * 16px leap upward, when the intent was a 3px settle downward.
           */
          className="flex size-14 -translate-y-4.75 items-center justify-center rounded-tile transition-transform duration-[--dur-instant] ease-out active:-translate-y-3.75 active:scale-95"
          style={{
            background: "var(--blue)",
            color: "#FFFFFF",
            boxShadow: "var(--lift-btn)",
          }}
        >
          <Icon name="plus" size={26} strokeWidth={2.1} />
        </button>
      </div>

      {ITEMS.slice(2).map((item) => (
        <NavLink key={item.href} {...item} active={isActive(item.href)} />
      ))}
    </nav>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="relative flex flex-col items-center gap-1.5 py-1 transition-colors duration-[--dur-fast]"
      style={{ color: active ? "var(--blue)" : "var(--muted)" }}
    >
      {/* A destination you are already on should say so with more than a colour
          shift — at 13px, the label alone was carrying the whole signal. */}
      <span
        aria-hidden
        className="absolute -top-1 h-1 rounded-pill transition-all duration-[--dur-base] ease-out"
        style={{
          width: active ? 20 : 0,
          opacity: active ? 1 : 0,
          background: "var(--blue)",
        }}
      />
      <Icon name={icon} size={23} strokeWidth={active ? 2.1 : 1.8} />
      <span className="text-caption font-medium leading-none">{label}</span>
    </Link>
  );
}

export default BottomNav;
