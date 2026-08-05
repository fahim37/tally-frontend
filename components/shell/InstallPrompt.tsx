"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

const DISMISSED_AT_KEY = "tally.install-prompt-dismissed-at";
const PROMPT_DELAY_MS = 1200;
const PROMPT_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function isRunningAsApp() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isIOSDevice() {
  // iPadOS can identify itself as macOS, so touch capability is checked too.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function wasRecentlyDismissed() {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < PROMPT_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

/**
 * A cross-platform PWA install invitation.
 *
 * Chromium exposes a native install dialog through `beforeinstallprompt`.
 * iOS does not, so there the same card explains the Safari share-sheet path.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(() => {
    if (typeof window === "undefined") return false;
    const secureContext = window.isSecureContext || window.location.hostname === "localhost";
    return !wasRecentlyDismissed() && secureContext && isIOSDevice();
  });
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return isRunningAsApp();
  });
  const [installing, setInstalling] = useState(false);
  const primaryActionRef = useRef<HTMLButtonElement>(null);

  const rememberDismissal = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    } catch {
      // Storage can be unavailable in private mode; dismissal still works for
      // the current page because both eligible states are cleared below.
    }
    setDeferredPrompt(null);
    setShowIOSInstructions(false);
  }, []);

  useEffect(() => {
    if (installed) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!wasRecentlyDismissed()) setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      try {
        window.localStorage.removeItem(DISMISSED_AT_KEY);
      } catch {
        // Installation succeeded; storage cleanup is only housekeeping.
      }
      setInstalled(true);
      setDeferredPrompt(null);
      setShowIOSInstructions(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const timer = window.setTimeout(() => setReady(true), PROMPT_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installed]);

  const visible = ready && !installed && (deferredPrompt !== null || showIOSInstructions);

  useEffect(() => {
    if (!visible) return;

    const focusTimer = window.setTimeout(() => primaryActionRef.current?.focus(), 50);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !installing) rememberDismissal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [installing, rememberDismissal, visible]);

  const install = async () => {
    if (!deferredPrompt || installing) return;

    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "dismissed") rememberDismissal();
      else setDeferredPrompt(null);
    } catch {
      // A browser can invalidate a captured prompt after a navigation. Hide
      // this one; a future beforeinstallprompt event can offer it again.
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  if (!visible) return null;

  const isNativePrompt = deferredPrompt !== null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center px-3 pb-[max(12px,var(--safe-b))] sm:items-center sm:p-5"
      style={{ background: "var(--scrim)", animation: "fadeIn var(--dur-base) ease both" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !installing) rememberDismissal();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        aria-describedby="install-description"
        className="relative w-full max-w-[440px] rounded-tile border px-5 pb-5 pt-6"
        style={{
          background: "var(--surf)",
          borderColor: "var(--line)",
          boxShadow: "var(--lift-sheet)",
          animation: "sheetUp var(--dur-slow) var(--ease-drawer) both",
        }}
      >
        <button
          type="button"
          onClick={rememberDismissal}
          disabled={installing}
          aria-label="Close install prompt"
          className="tap-target absolute right-4 top-4 grid size-9 place-items-center rounded-full"
          style={{ background: "var(--bg)", color: "var(--muted)" }}
        >
          <Icon name="plus" size={18} strokeWidth={2} className="rotate-45" />
        </button>

        <div className="flex items-start gap-4 pr-10">
          <Image
            src="/icons/icon-192.png"
            width={64}
            height={64}
            alt=""
            priority
            className="size-16 shrink-0 rounded-card"
          />
          <div className="min-w-0 pt-1">
            <p className="text-eyebrow uppercase" style={{ color: "var(--blue)" }}>
              Tally for your device
            </p>
            <h2 id="install-title" className="mt-1 font-display text-title">
              Install the app
            </h2>
          </div>
        </div>

        <p id="install-description" className="mt-4 text-body" style={{ color: "var(--muted)" }}>
          {isNativePrompt
            ? "Add Tally to your home screen for faster access and an app-like, full-screen experience."
            : "Add Tally to your Home Screen for faster access and an app-like, full-screen experience."}
        </p>

        {isNativePrompt ? (
          <button
            ref={primaryActionRef}
            type="button"
            onClick={install}
            disabled={installing}
            className="mt-5 min-h-12 w-full rounded-card px-5 py-3 text-label font-semibold text-white disabled:cursor-wait disabled:opacity-70"
            style={{ background: "var(--blue)", boxShadow: "var(--lift-btn)" }}
          >
            {installing ? "Opening install…" : "Install Tally"}
          </button>
        ) : (
          <>
            <ol className="mt-5 space-y-3 text-body">
              <li className="flex items-center gap-3">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full font-mono text-meta font-semibold"
                  style={{ background: "var(--sky)", color: "var(--blue-deep)" }}
                >
                  1
                </span>
                Tap the <strong>Share</strong> button in Safari.
              </li>
              <li className="flex items-center gap-3">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full font-mono text-meta font-semibold"
                  style={{ background: "var(--sky)", color: "var(--blue-deep)" }}
                >
                  2
                </span>
                Choose <strong>Add to Home Screen</strong>.
              </li>
            </ol>
            <button
              ref={primaryActionRef}
              type="button"
              onClick={rememberDismissal}
              className="mt-5 min-h-12 w-full rounded-card px-5 py-3 text-label font-semibold text-white"
              style={{ background: "var(--blue)", boxShadow: "var(--lift-btn)" }}
            >
              Got it
            </button>
          </>
        )}

        <p className="mt-3 text-center text-caption" style={{ color: "var(--faint)" }}>
          No app store needed
        </p>
      </section>
    </div>
  );
}

export default InstallPrompt;
