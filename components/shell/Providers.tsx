"use client";

import { Suspense } from "react";
import { TallyProvider } from "@/lib/store/TallyProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "./AppShell";
import { ServiceWorker } from "./ServiceWorker";
import { InstallPrompt } from "./InstallPrompt";

/**
 * Client boundary for the whole app. The root layout stays a server component;
 * everything stateful hangs off here.
 *
 * AppShell reads `useSearchParams` (for the PWA shortcut deep-link), which
 * Next requires to sit inside a Suspense boundary.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TallyProvider>
      <ToastProvider>
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
        <ServiceWorker />
        <InstallPrompt />
      </ToastProvider>
    </TallyProvider>
  );
}

export default Providers;
