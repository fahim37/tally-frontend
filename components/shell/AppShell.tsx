"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { OfflineBanner } from "./OfflineBanner";
import { AddDrawer } from "@/components/add/AddDrawer";
import { useTally } from "@/lib/store/TallyProvider";
import { useKeyboardInset } from "@/lib/useKeyboardInset";

/** Screens that own the full viewport — no nav, no offline strip. */
const BARE_ROUTES = ["/signin", "/onboarding"];

/**
 * The app frame: offline strip, the page, the bottom bar, and the one Add
 * drawer that every screen opens.
 *
 * Mobile-first. The column is capped at 520px and centred so the layout stays
 * a phone layout on a laptop rather than stretching into something the design
 * never described — the Dashboard is the one screen that opts into a wider
 * grid, and it does that internally.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state, hydrated } = useTally();

  // Publishes the soft-keyboard height as --kb and flags <html> while it's up.
  // Mounted here, once, because both the nav below and every Sheet read it.
  const keyboardInset = useKeyboardInset();
  const keyboardOpen = keyboardInset > 0;

  const isBare = BARE_ROUTES.some((route) => pathname.startsWith(route));
  const { signedIn, onboardingCompleted } = state.profile;

  /**
   * Where this visitor belongs, given what we know. Computed as a value rather
   * than as a sequence of `replace` calls so the effect below can compare it
   * to the current route and stay silent when they already agree — the old
   * version re-ran its redirects on every profile change and could bounce.
   */
  const destination = (() => {
    if (!hydrated) return null;
    if (!signedIn) return isBare && pathname.startsWith("/signin") ? null : "/signin";
    if (!onboardingCompleted) return pathname.startsWith("/onboarding") ? null : "/onboarding";
    // A signed-in user sitting on /signin used to stay there indefinitely.
    if (pathname.startsWith("/signin") || pathname.startsWith("/onboarding")) return "/";
    return null;
  })();

  useEffect(() => {
    if (destination && destination !== pathname) router.replace(destination);
  }, [destination, pathname, router]);

  // Both of these react to a route change, which React handles by adjusting
  // state during render rather than in an effect — an effect would paint the
  // wrong frame first, then correct it.
  // https://react.dev/learn/you-might-not-need-an-effect
  const routeKey = `${pathname}?${searchParams.get("action") ?? ""}`;
  const [lastRoute, setLastRoute] = useState(routeKey);

  if (routeKey !== lastRoute) {
    setLastRoute(routeKey);
    // Close the drawer on navigation, except when the PWA "Log an expense"
    // shortcut deep-links to /?action=log — that route is asking for it open.
    setDrawerOpen(searchParams.get("action") === "log");
  }

  // Until the persisted store has been read we don't know who this is. Showing
  // the signed-out screen would flash sign-in at a signed-in user on every
  // reload; showing nothing flashes a blank page. A skeleton of the frame is
  // honest about what's happening and doesn't move the layout when it resolves.
  if (!hydrated) return <BootSkeleton />;

  if (isBare) {
    return <div className="mx-auto w-full max-w-[520px]">{children}</div>;
  }

  // Mobile-first everywhere; the Dashboard is the one screen the brief gives a
  // desktop layout, so it's the only route allowed past the phone column.
  const wide = pathname.startsWith("/dashboard");

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <div
        className={`mx-auto flex w-full flex-1 flex-col ${wide ? "max-w-none" : "max-w-[520px]"}`}
      >
        <div className="mx-auto w-full max-w-[520px]">
          <OfflineBanner />
        </div>
        {/* The nav is sticky, so it pins over the page while scrolling and only
            settles into flow at the very bottom. Without this reserve, the last
            control on a long screen sits under it mid-scroll and can't be hit —
            and when the keyboard hides the nav, the reserve goes with it. */}
        <main
          key={pathname}
          className="animate-screen-in flex-1"
          style={{
            paddingBottom: keyboardOpen ? 16 : 124,
            transition: "padding-bottom var(--dur-base) var(--ease-out)",
          }}
        >
          {children}
        </main>
      </div>

      {/* The bar spans the full width so it reads as the app's chrome; only its
          contents are capped. Centred at 520px on a wide screen it looked like
          a detached island floating over the page.

          It translates out of the way when the soft keyboard opens: at the
          bottom of the viewport it would otherwise sit directly on top of the
          keyboard, covering the row of keys nearest the thumb. */}
      <div
        className="sticky bottom-0 z-30 w-full"
        style={{
          background: "var(--surf)",
          borderTop: "1px solid var(--line)",
          transform: keyboardOpen ? "translate3d(0, 100%, 0)" : "none",
          transition: "transform var(--dur-base) var(--ease-drawer)",
          pointerEvents: keyboardOpen ? "none" : undefined,
        }}
        // Hidden from the a11y tree while it's off-screen, so a screen reader
        // doesn't offer navigation the user can't see or reach.
        aria-hidden={keyboardOpen || undefined}
      >
        <div className="mx-auto w-full max-w-[520px]">
          <BottomNav onLogPress={() => setDrawerOpen(true)} />
        </div>
      </div>

      <AddDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

/**
 * The frame, without content. Deliberately not a spinner: the shape is already
 * known, so showing it means nothing jumps when the real thing arrives.
 */
function BootSkeleton() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pt-8" aria-busy>
      <span className="sr-only">Loading Tally</span>
      {/* The shapes have to match what replaces them, or the "nothing moves"
          promise breaks — this is the Tap Pad's boxed total and its 136px
          tiles, not the loose text block the screen used to open with. */}
      <SkeletonBlock className="mt-2 h-33 rounded-tile" />
      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonBlock key={i} className="h-34 rounded-tile" />
        ))}
      </div>
    </div>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block rounded-[10px] ${className}`}
      style={{
        background:
          "linear-gradient(90deg, var(--line) 25%, var(--bg) 50%, var(--line) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s linear infinite",
      }}
    />
  );
}

export default AppShell;
