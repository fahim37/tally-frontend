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
      className="grid grid-cols-5 items-end px-1.5 pt-2.5"
      style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}
    >
      {ITEMS.slice(0, 2).map((item) => (
        <NavLink key={item.href} {...item} active={isActive(item.href)} />
      ))}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onLogPress}
          aria-label="Log an expense"
          className="flex size-14 items-center justify-center rounded-[19px] transition-transform active:translate-y-[-16px]"
          style={{
            background: "var(--blue)",
            color: "#FFFFFF",
            transform: "translateY(-19px)",
            boxShadow: "var(--lift-btn)",
          }}
        >
          <Icon name="plus" size={25} strokeWidth={2.1} />
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
      className="flex flex-col items-center gap-[5px]"
      style={{ color: active ? "var(--blue)" : "var(--muted)" }}
    >
      <Icon name={icon} size={21} strokeWidth={1.8} />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </Link>
  );
}

export default BottomNav;
