"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { OfflineBanner } from "./OfflineBanner";
import { AddDrawer } from "@/components/add/AddDrawer";
import { useTally } from "@/lib/store/TallyProvider";

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

  const isBare = BARE_ROUTES.some((route) => pathname.startsWith(route));

  // Route to the right entry screen once the persisted store has been read —
  // doing it before hydration would bounce a signed-in user to /signin on
  // every refresh.
  useEffect(() => {
    if (!hydrated || isBare) return;
    if (!state.profile.signedIn) router.replace("/signin");
    else if (!state.profile.onboardingCompleted) router.replace("/onboarding");
  }, [hydrated, isBare, state.profile.signedIn, state.profile.onboardingCompleted, router]);

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
            control on a long screen sits under it mid-scroll and can't be hit. */}
        <main className="flex-1 pb-[124px]">{children}</main>
      </div>

      {/* The bar spans the full width so it reads as the app's chrome; only its
          contents are capped. Centred at 520px on a wide screen it looked like
          a detached island floating over the page. */}
      <div
        className="sticky bottom-0 z-30 w-full"
        style={{ background: "var(--surf)", borderTop: "1px solid var(--line)" }}
      >
        <div className="mx-auto w-full max-w-[520px]">
          <BottomNav onLogPress={() => setDrawerOpen(true)} />
        </div>
      </div>

      <AddDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

export default AppShell;
